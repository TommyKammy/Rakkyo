import { SyncRepository } from '../repositories/SyncRepository';
import { ABUSE_WINDOW_MS, SYNC_RATE_LIMIT_MS } from '@rakkyo/shared';

/** Individual attempt sync result for the batch response. */
interface AttemptSyncResult {
  clientEventId: string;
  status: 'created' | 'duplicate' | 'rejected';
  serverId?: string;
  reason?: string;
}

/** Full batch sync response including server-recalculated stats. */
interface BatchSyncResponse {
  results: AttemptSyncResult[];
  serverStats: {
    currentXp: number;
    level: number;
    streakCount: number;
  };
  syncedAt: string;
}

/** Input for a single offline attempt within a batch. */
interface SyncAttemptInput {
  clientEventId: string;
  userId: string;
  questionId: string;
  isCorrect: boolean;
  hintsUsed: number;
  answerSubmitted: string;
  durationSeconds?: number | null;
  errorType?: string | null;
  createdAt: string;
}

/**
 * Service handling offline sync batch processing (Phase 16-D).
 * Processes CRDT append-only attempt logs with idempotent merge.
 *
 * Design decision (D-2): XP/level/streak are NOT calculated client-side.
 * After all attempts are inserted, the server recalculates from the full
 * Attempt history to guarantee order-independent deterministic results.
 */
export class SyncService {
  constructor(private syncRepo: SyncRepository) {}

  /**
   * Process a batch of offline attempts.
   * Each attempt is inserted idempotently using clientEventId (D-1).
   * @param userId - The authenticated user's ID
   * @param attempts - Array of offline attempt data
   * @param deviceId - Client device identifier for audit
   * @returns Batch sync response with per-attempt results and server stats
   */
  async processBatch(
    userId: string,
    attempts: SyncAttemptInput[],
    deviceId: string
  ): Promise<BatchSyncResponse> {
    const results: AttemptSyncResult[] = [];
    const now = new Date();

    let isFirst = true;
    for (const attempt of attempts) {
      try {
        if (!isFirst && process.env.NODE_ENV !== 'test') {
          // D-7: Throttle database update attempts (1 entry/sec) to prevent load/abuse bursts (P2-11)
          await new Promise((resolve) => setTimeout(resolve, SYNC_RATE_LIMIT_MS));
        }
        isFirst = false;

        const attemptDate = new Date(attempt.createdAt);

        // D-7: Offline attempts older than 1h are outside the abuse window.
        // This prevents burst false-positives when a batch of old attempts
        // arrives at once after reconnection.
        const _isWithinAbuseWindow =
          now.getTime() - attemptDate.getTime() < ABUSE_WINDOW_MS;

        const { created, attempt: savedAttempt } =
          await this.syncRepo.createAttemptIdempotent({
            clientEventId: attempt.clientEventId,
            userId,
            questionId: attempt.questionId,
            isCorrect: attempt.isCorrect,
            hintsUsed: attempt.hintsUsed,
            answerSubmitted: attempt.answerSubmitted,
            durationSeconds: attempt.durationSeconds ?? null,
            errorType: attempt.errorType ?? null,
            createdAt: attemptDate,
          });

        results.push({
          clientEventId: attempt.clientEventId,
          status: created ? 'created' : 'duplicate',
          serverId: savedAttempt.id,
        });
      } catch {
        results.push({
          clientEventId: attempt.clientEventId,
          status: 'rejected',
          reason: 'サーバーエラーが発生しました',
        });
      }
    }

    // D-2: Recalculate from full Attempt history (server = single source of truth)
    const stats = await this.syncRepo.recalculateUserStats(userId);

    // Record sync in audit log
    const createdCount = results.filter((r) => r.status === 'created').length;
    const failedCount = results.filter((r) => r.status === 'rejected').length;
    const status =
      failedCount === 0
        ? 'SUCCESS'
        : createdCount > 0
          ? 'PARTIAL'
          : 'FAILED';

    await this.syncRepo.createSyncLog({
      userId,
      deviceId,
      attemptCount: attempts.length,
      status,
      errorDetails:
        failedCount > 0 ? `${failedCount} attempts failed` : null,
    });

    return {
      results,
      serverStats: stats,
      syncedAt: new Date().toISOString(),
    };
  }
}
