import { SyncRepository } from '../repositories/SyncRepository';
import { CurriculumRepository } from '../repositories/CurriculumRepository';
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
  isReview?: boolean | null;
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
  constructor(
    private syncRepo: SyncRepository,
    private curriculumRepo: CurriculumRepository
  ) {}

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
        const timeDiff = now.getTime() - attemptDate.getTime();

        // P1: Reject attempts with forged timestamps (e.g. in the future or older than the 1h abuse window)
        // Allow up to 5 minutes (300,000 ms) in the future for potential clock skew.
        if (timeDiff < -300000 || timeDiff > ABUSE_WINDOW_MS) {
          results.push({
            clientEventId: attempt.clientEventId,
            status: 'rejected',
            reason: '送信日時のタイムスタンプが時間枠外（未来または1時間以上前）です。',
          });
          continue;
        }

        // P1: Server-Side Correctness Verification.
        // Recompute correctness server-side by checking submitted answers against curriculum answers before persistence.
        let isCorrect = attempt.isCorrect;
        try {
          const question = await this.curriculumRepo.findQuestionById(attempt.questionId);
          if (question) {
            isCorrect = question.answers.some(
              (ans: string) => ans.toLowerCase().trim() === attempt.answerSubmitted.toLowerCase().trim()
            );
          }
        } catch (err) {
          console.error(`Failed to verify correctness for question ${attempt.questionId} server-side:`, err);
          // Keep original client-reported isCorrect if database check errors out
          isCorrect = attempt.isCorrect;
        }

        const { created, attempt: savedAttempt } =
          await this.syncRepo.createAttemptIdempotent({
            clientEventId: attempt.clientEventId,
            userId,
            questionId: attempt.questionId,
            isCorrect,
            hintsUsed: attempt.hintsUsed,
            answerSubmitted: attempt.answerSubmitted,
            durationSeconds: attempt.durationSeconds ?? null,
            errorType: attempt.errorType ?? null,
            isReview: attempt.isReview ?? false,
            createdAt: attemptDate,
          });

        results.push({
          clientEventId: attempt.clientEventId,
          status: created ? 'created' : 'duplicate',
          serverId: savedAttempt.id,
        });
      } catch (error) {
        console.error('Error processing offline attempt:', error);
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
