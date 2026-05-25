/**
 * CRDT append-only sync engine for offline attempt logs (P16D-002).
 *
 * Manages the queue of pending offline attempts and flushes them
 * to the server with rate-limited idempotent uploads.
 *
 * Design: Every Attempt gets a `clientEventId` (UUID v4) at creation time.
 * The server uses this as a unique dedup key, so re-sending the same
 * Attempt is always safe — at-least-once delivery, exactly-once effect (D-1).
 *
 * @module offline/sync-engine
 */

import { OfflineDb } from './db';
import {
  SYNC_STATUS,
  MAX_SYNC_BATCH_SIZE,
  SYNC_RATE_LIMIT_MS,
  OFFLINE_SCHEMA_VERSION,
} from '@rakkyo/shared';
import { getOrCreateUserKey, getUserKey, encrypt, decrypt } from './crypto';

/** API base URL — mirrors the existing hardcoded pattern in the codebase. */
const API_BASE = 'http://localhost:4000';

/** Shape of a locally-queued offline attempt. */
export interface PendingAttempt {
  clientEventId: string;
  userId: string;
  questionId: string;
  isCorrect: boolean;
  hintsUsed: number;
  answerSubmitted: string;
  durationSeconds: number | null;
  errorType: string | null;
  createdAt: string;
  syncStatus: string;
}

/**
 * Enqueue an attempt in the local SQLite offline queue.
 * Generates a `clientEventId` via `crypto.randomUUID()` (D-1).
 * Encrypts the `answerSubmitted` field using AES-GCM at rest (D-8).
 *
 * @param db - The user's OfflineDb handle
 * @param data - The attempt data (without clientEventId)
 * @returns The generated clientEventId
 */
export async function enqueuePendingAttempt(
  db: OfflineDb,
  data: Omit<PendingAttempt, 'clientEventId' | 'syncStatus'>
): Promise<string> {
  const clientEventId = crypto.randomUUID();

  // D-8: Encrypt answerSubmitted at rest before SQLite insertion
  const key = await getOrCreateUserKey(data.userId);
  const encryptedAnswer = await encrypt(data.answerSubmitted, key);

  db.exec(
    `INSERT INTO offline_attempts
       (clientEventId, userId, questionId, isCorrect, hintsUsed,
        answerSubmitted, durationSeconds, errorType, createdAt, syncStatus)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      clientEventId,
      data.userId,
      data.questionId,
      data.isCorrect ? 1 : 0,
      data.hintsUsed,
      encryptedAnswer,
      data.durationSeconds,
      data.errorType,
      data.createdAt,
      SYNC_STATUS.PENDING,
    ]
  );

  return clientEventId;
}

/**
 * Get the count of pending (unsynced) attempts.
 * @param db - The user's OfflineDb handle
 */
export function getPendingCount(db: OfflineDb): number {
  const row = db.selectOne<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM offline_attempts WHERE syncStatus = ? OR syncStatus = ?`,
    [SYNC_STATUS.PENDING, SYNC_STATUS.FAILED]
  );
  return row?.cnt ?? 0;
}

/**
 * Flush pending attempts to the server in rate-limited batches (D-7).
 *
 * @param db - The user's OfflineDb handle
 * @param token - JWT bearer token for auth
 * @param deviceId - Client device identifier
 * @returns Object with counts of synced, duplicated, and failed attempts
 * @throws If the server returns 401 (JWT expired → re-login required, D-4)
 */
export async function flushPendingAttempts(
  db: OfflineDb,
  token: string,
  deviceId: string
): Promise<{
  synced: number;
  duplicates: number;
  failed: number;
  serverStats?: { currentXp: number; level: number; streakCount: number };
  jwtExpired?: boolean;
}> {
  // Get pending attempts (oldest first) - retry FAILED attempts as well
  const pending = db.selectAll<PendingAttempt>(
    `SELECT * FROM offline_attempts
     WHERE syncStatus = ? OR syncStatus = ?
     ORDER BY createdAt ASC
     LIMIT ?`,
    [SYNC_STATUS.PENDING, SYNC_STATUS.FAILED, MAX_SYNC_BATCH_SIZE]
  );

  if (pending.length === 0) {
    return { synced: 0, duplicates: 0, failed: 0 };
  }

  // Mark as SYNCING
  const ids = pending.map((p) => `'${p.clientEventId}'`).join(',');
  db.exec(
    `UPDATE offline_attempts SET syncStatus = ?
     WHERE clientEventId IN (${ids})`,
    [SYNC_STATUS.SYNCING]
  );

  // D-7: Rate-limit — wait between sending batches
  await sleep(SYNC_RATE_LIMIT_MS);

  try {
    // D-8: Decrypt the answerSubmitted fields before forming the server API body
    const attempts = await Promise.all(
      pending.map(async (p) => {
        let answer = p.answerSubmitted;
        try {
          const key = await getUserKey(p.userId);
          if (!key) {
            throw new Error('Encryption key is missing - cannot decrypt attempt');
          }
          answer = await decrypt(p.answerSubmitted, key);
        } catch (e) {
          console.error('Failed to decrypt local attempt answer for sync:', e);
          answer = 'WIPED_OR_CORRUPT_DATA';
        }
        return {
          clientEventId: p.clientEventId,
          userId: p.userId,
          questionId: p.questionId,
          isCorrect: Boolean(p.isCorrect),
          hintsUsed: p.hintsUsed,
          answerSubmitted: answer,
          durationSeconds: p.durationSeconds,
          errorType: p.errorType,
          createdAt: p.createdAt,
        };
      })
    );

    const response = await fetch(`${API_BASE}/api/sync/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        attempts,
        schemaVersion: OFFLINE_SCHEMA_VERSION,
        deviceId,
      }),
    });

    // D-4: JWT expired — do NOT delete local data
    if (response.status === 401) {
      // Revert to PENDING so they can be re-sent after re-login
      db.exec(
        `UPDATE offline_attempts SET syncStatus = ?
         WHERE clientEventId IN (${ids})`,
        [SYNC_STATUS.PENDING]
      );
      return { synced: 0, duplicates: 0, failed: 0, jwtExpired: true };
    }

    // D-6: Schema version mismatch
    if (response.status === 409) {
      db.exec(
        `UPDATE offline_attempts SET syncStatus = ?
         WHERE clientEventId IN (${ids})`,
        [SYNC_STATUS.PENDING]
      );
      return { synced: 0, duplicates: 0, failed: pending.length };
    }

    if (!response.ok) {
      // D-1: Server error — revert to PENDING for retry
      db.exec(
        `UPDATE offline_attempts SET syncStatus = ?
         WHERE clientEventId IN (${ids})`,
        [SYNC_STATUS.PENDING]
      );
      return { synced: 0, duplicates: 0, failed: pending.length };
    }

    const result = await response.json();
    let synced = 0;
    let duplicates = 0;
    let failed = 0;

    for (const r of result.results) {
      if (r.status === 'created') {
        synced++;
        db.exec(
          `UPDATE offline_attempts SET syncStatus = ?
           WHERE clientEventId = ?`,
          [SYNC_STATUS.SYNCED, r.clientEventId]
        );
      } else if (r.status === 'duplicate') {
        duplicates++;
        db.exec(
          `UPDATE offline_attempts SET syncStatus = ?
           WHERE clientEventId = ?`,
          [SYNC_STATUS.SYNCED, r.clientEventId]
        );
      } else {
        failed++;
        db.exec(
          `UPDATE offline_attempts SET syncStatus = ?
           WHERE clientEventId = ?`,
          [SYNC_STATUS.FAILED, r.clientEventId]
        );
      }
    }

    return {
      synced,
      duplicates,
      failed,
      serverStats: result.serverStats,
    };
  } catch {
    // Network error — revert to PENDING (D-1: don't lose data)
    db.exec(
      `UPDATE offline_attempts SET syncStatus = ?
       WHERE clientEventId IN (${ids})`,
      [SYNC_STATUS.PENDING]
    );
    return { synced: 0, duplicates: 0, failed: pending.length };
  }
}

/** Simple sleep utility for rate limiting. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
