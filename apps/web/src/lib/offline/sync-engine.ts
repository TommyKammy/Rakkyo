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
  // Reset any stuck SYNCING rows from previous interrupted runs back to PENDING (P1-8)
  db.exec(
    `UPDATE offline_attempts SET syncStatus = ? WHERE syncStatus = ?`,
    [SYNC_STATUS.PENDING, SYNC_STATUS.SYNCING]
  );

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

  let synced = 0;
  let duplicates = 0;
  let failed = 0;
  let serverStats: { currentXp: number; level: number; streakCount: number } | undefined;

  for (let i = 0; i < pending.length; i++) {
    const p = pending[i];

    // Mark current attempt as SYNCING
    db.exec(
      `UPDATE offline_attempts SET syncStatus = ? WHERE clientEventId = ?`,
      [SYNC_STATUS.SYNCING, p.clientEventId]
    );

    // D-7: Throttle per attempt upload to prevent server side bursty traffic (P2-12)
    if (i > 0) {
      await sleep(SYNC_RATE_LIMIT_MS);
    }

    // D-8: Decrypt the answerSubmitted field
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

    const attemptInput = {
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

    try {
      const response = await fetch(`${API_BASE}/api/sync/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          attempts: [attemptInput],
          schemaVersion: OFFLINE_SCHEMA_VERSION,
          deviceId,
        }),
      });

      // D-4: JWT expired — revert current and remaining attempts to PENDING, do NOT delete local data
      if (response.status === 401) {
        const remaining = pending.slice(i);
        for (const rem of remaining) {
          db.exec(
            `UPDATE offline_attempts SET syncStatus = ? WHERE clientEventId = ?`,
            [SYNC_STATUS.PENDING, rem.clientEventId]
          );
        }
        return { synced, duplicates, failed, serverStats, jwtExpired: true };
      }

      // D-6: Schema version mismatch — revert current and remaining to PENDING, count them as failed
      if (response.status === 409) {
        const remaining = pending.slice(i);
        for (const rem of remaining) {
          db.exec(
            `UPDATE offline_attempts SET syncStatus = ? WHERE clientEventId = ?`,
            [SYNC_STATUS.PENDING, rem.clientEventId]
          );
        }
        return {
          synced,
          duplicates,
          failed: failed + remaining.length,
          serverStats,
        };
      }

      if (!response.ok) {
        // Server/Network error for this attempt — revert to PENDING for retry later
        db.exec(
          `UPDATE offline_attempts SET syncStatus = ? WHERE clientEventId = ?`,
          [SYNC_STATUS.PENDING, p.clientEventId]
        );
        failed++;
        continue;
      }

      const result = await response.json();
      if (result.serverStats) {
        serverStats = result.serverStats;
      }

      const r = result.results?.[0];
      if (r) {
        if (r.status === 'created') {
          synced++;
          db.exec(
            `UPDATE offline_attempts SET syncStatus = ? WHERE clientEventId = ?`,
            [SYNC_STATUS.SYNCED, r.clientEventId]
          );
        } else if (r.status === 'duplicate') {
          duplicates++;
          db.exec(
            `UPDATE offline_attempts SET syncStatus = ? WHERE clientEventId = ?`,
            [SYNC_STATUS.SYNCED, r.clientEventId]
          );
        } else {
          failed++;
          db.exec(
            `UPDATE offline_attempts SET syncStatus = ? WHERE clientEventId = ?`,
            [SYNC_STATUS.FAILED, r.clientEventId]
          );
        }
      } else {
        failed++;
        db.exec(
          `UPDATE offline_attempts SET syncStatus = ? WHERE clientEventId = ?`,
          [SYNC_STATUS.FAILED, p.clientEventId]
        );
      }
    } catch (err) {
      console.error('Network error during offline sync:', err);
      // Revert current attempt to PENDING (D-1: don't lose data)
      db.exec(
        `UPDATE offline_attempts SET syncStatus = ? WHERE clientEventId = ?`,
        [SYNC_STATUS.PENDING, p.clientEventId]
      );
      failed++;
    }
  }

  return {
    synced,
    duplicates,
    failed,
    serverStats,
  };
}

/** Simple sleep utility for rate limiting. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
