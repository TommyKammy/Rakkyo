/**
 * Hint prefetch and AI response cache for offline use (P16D-003, D-5).
 *
 * Pre-fetches static hint hierarchies and recent AI diagnosis responses
 * into the local SQLite database for offline availability.
 *
 * @module offline/hint-prefetch
 */

import { OfflineDb } from './db';
import {
  AI_CACHE_MAX_BYTES,
  AI_CACHE_STALE_THRESHOLD_MS,
  HINT_PREFETCH_COUNT,
} from '@rakkyo/shared';

/** API base URL. */
const API_BASE = 'http://localhost:4000';

/**
 * Prefetch static hints for a lesson into local SQLite (P16D-003).
 * Overwrites existing cached hints for the same lesson.
 *
 * @param db - The user's OfflineDb handle
 * @param lessonId - The lesson to prefetch hints for
 * @param token - JWT bearer token
 */
export async function prefetchHints(
  db: OfflineDb,
  lessonId: string,
  token: string
): Promise<void> {
  try {
    const response = await fetch(
      `${API_BASE}/api/sync/hints/${lessonId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!response.ok) return;

    const data = await response.json();
    for (const q of data.questions) {
      db.exec(
        `INSERT OR REPLACE INTO offline_hint_cache
           (lessonId, questionId, hints_json, fetchedAt)
         VALUES (?, ?, ?, ?)`,
        [lessonId, q.questionId, JSON.stringify(q.hints), new Date().toISOString()]
      );
    }
  } catch {
    // Silently fail — hints are best-effort prefetch
  }
}

/**
 * Get cached hints for a question from local SQLite.
 * Returns null if not cached.
 *
 * P2: `offline_hint_cache` is keyed by `(lessonId, questionId)` because
 * the same questionId can exist across lessons (the fallback path uses
 * prompt-based IDs which collide). Scoping the read by lessonId avoids
 * returning hints from the wrong lesson.
 *
 * @param db - The user's OfflineDb handle
 * @param lessonId - The lesson the question belongs to
 * @param questionId - The question ID
 * @returns Cached hints with staleness metadata, or null
 */
export function getCachedHints(
  db: OfflineDb,
  lessonId: string,
  questionId: string
): {
  hints: string[];
  fetchedAt: string;
  isStale: boolean;
  staleLabel: string | null;
} | null {
  const row = db.selectOne<{ hints_json: string; fetchedAt: string }>(
    `SELECT hints_json, fetchedAt
       FROM offline_hint_cache
      WHERE lessonId = ? AND questionId = ?`,
    [lessonId, questionId]
  );

  if (!row) return null;

  const fetchedAt = new Date(row.fetchedAt);
  const ageMs = Date.now() - fetchedAt.getTime();
  const isStale = ageMs > AI_CACHE_STALE_THRESHOLD_MS;

  // D-5: Honest staleness labeling — mirrors getCachedAiDiagnosis so the
  // OfflineHintBadge can render a consistent "X時間前のキャッシュ" message.
  let staleLabel: string | null = null;
  if (isStale) {
    const hoursAgo = Math.floor(ageMs / (60 * 60 * 1000));
    if (hoursAgo < 48) {
      staleLabel = `${hoursAgo}時間前のキャッシュです`;
    } else {
      const daysAgo = Math.floor(hoursAgo / 24);
      staleLabel = `${daysAgo}日前のキャッシュです`;
    }
  }

  return {
    hints: JSON.parse(row.hints_json),
    fetchedAt: row.fetchedAt,
    isStale,
    staleLabel,
  };
}

/**
 * Prefetch recent AI diagnosis responses for offline use (P16D-003, D-5).
 * Fetches the latest AI diagnoses for the user's recent questions.
 *
 * @param db - The user's OfflineDb handle
 * @param token - JWT bearer token
 */
export async function prefetchAiCache(
  db: OfflineDb,
  token: string
): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/api/sync/ai-cache`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) return;

    const data = await response.json();
    for (const entry of data.entries.slice(0, HINT_PREFETCH_COUNT).reverse()) {
      // P2: Skip entries without a lessonId — the cache is lesson-scoped to
      // avoid cross-lesson prompt-id collisions.
      if (!entry.lessonId) continue;
      const diagnosisJson = JSON.stringify(entry.diagnosis);
      const sizeBytes = new TextEncoder().encode(diagnosisJson).length;

      db.exec(
        `INSERT OR REPLACE INTO offline_ai_cache
           (lessonId, questionId, diagnosis_json, generatedAt, sizeBytes)
         VALUES (?, ?, ?, ?, ?)`,
        [entry.lessonId, entry.questionId, diagnosisJson, entry.generatedAt, sizeBytes]
      );
    }

    // Enforce cache size limit with LRU eviction (D-5)
    evictStaleCache(db);
  } catch {
    // Silently fail — AI cache is best-effort
  }
}

/**
 * Get a cached AI diagnosis for a question.
 * Returns null if not cached.
 *
 * P2: Scoped by `(lessonId, questionId)` because prompt-fallback IDs collide
 * across lessons; a questionId-only lookup could surface another lesson's
 * diagnosis. Matches the offline_hint_cache scoping.
 *
 * @param db - The user's OfflineDb handle
 * @param lessonId - The lesson the question belongs to
 * @param questionId - The question ID
 * @returns Cached diagnosis with staleness metadata, or null
 */
export function getCachedAiDiagnosis(
  db: OfflineDb,
  lessonId: string,
  questionId: string
): {
  diagnosis: string;
  generatedAt: string;
  isStale: boolean;
  staleLabel: string | null;
} | null {
  const row = db.selectOne<{
    diagnosis_json: string;
    generatedAt: string;
  }>(
    `SELECT diagnosis_json, generatedAt FROM offline_ai_cache
     WHERE lessonId = ? AND questionId = ?`,
    [lessonId, questionId]
  );

  if (!row) return null;

  const generatedAt = new Date(row.generatedAt);
  const ageMs = Date.now() - generatedAt.getTime();
  const isStale = ageMs > AI_CACHE_STALE_THRESHOLD_MS;

  // D-5: Honest staleness labeling
  let staleLabel: string | null = null;
  if (isStale) {
    const hoursAgo = Math.floor(ageMs / (60 * 60 * 1000));
    if (hoursAgo < 48) {
      staleLabel = `${hoursAgo}時間前のキャッシュです`;
    } else {
      const daysAgo = Math.floor(hoursAgo / 24);
      staleLabel = `${daysAgo}日前のキャッシュです`;
    }
  }

  return {
    diagnosis: JSON.parse(row.diagnosis_json),
    generatedAt: row.generatedAt,
    isStale,
    staleLabel,
  };
}

/**
 * Evict oldest AI cache entries when total size exceeds the limit (D-5).
 * Uses LRU (Least Recently Used = oldest generatedAt) eviction.
 */
function evictStaleCache(db: OfflineDb): void {
  const totalRow = db.selectOne<{ total: number }>(
    `SELECT COALESCE(SUM(sizeBytes), 0) as total FROM offline_ai_cache`
  );

  if (!totalRow || totalRow.total <= AI_CACHE_MAX_BYTES) return;

  // Delete oldest entries until under limit. Key by (lessonId, questionId)
  // since that's now the composite primary key (P2 lesson scoping).
  const entries = db.selectAll<{
    lessonId: string;
    questionId: string;
    sizeBytes: number;
  }>(
    `SELECT lessonId, questionId, sizeBytes FROM offline_ai_cache
     ORDER BY generatedAt ASC`
  );

  let currentTotal = totalRow.total;
  for (const entry of entries) {
    if (currentTotal <= AI_CACHE_MAX_BYTES) break;
    db.exec(
      `DELETE FROM offline_ai_cache WHERE lessonId = ? AND questionId = ?`,
      [entry.lessonId, entry.questionId]
    );
    currentTotal -= entry.sizeBytes;
  }
}
