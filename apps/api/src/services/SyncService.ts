import { SyncRepository } from '../repositories/SyncRepository';
import { CurriculumRepository } from '../repositories/CurriculumRepository';
import { AttemptRepository } from '../repositories/AttemptRepository';
import {
  OFFLINE_SYNC_FUTURE_SKEW_MS,
  OFFLINE_SYNC_MAX_AGE_MS,
  SYNC_RATE_LIMIT_MS,
} from '@rakkyo/shared';

/**
 * Upper bound on `hintsUsed` accepted from offline payloads.
 *
 * The curriculum exposes 3 progressive hint stages, so any value beyond 3 is
 * a forged payload. Clamping here prevents a malicious offline client from
 * inflating grit-quest / level progression by sending arbitrary hint counts.
 */
const MAX_HINTS_USED = 3;

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
    private curriculumRepo: CurriculumRepository,
    private attemptRepo: AttemptRepository
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

        // P1: Reject attempts with forged timestamps only when they fall outside the
        // legitimate offline window. Reject future-skewed timestamps beyond a small
        // clock-drift allowance, and reject timestamps older than the offline retention
        // window (30 days) so genuine multi-day offline sessions can still sync.
        // NOTE: clientEventId already gives us idempotency, so we do NOT need a
        // 1-hour abuse window here — that broke the core offline-first flow.
        if (
          timeDiff < -OFFLINE_SYNC_FUTURE_SKEW_MS ||
          timeDiff > OFFLINE_SYNC_MAX_AGE_MS
        ) {
          results.push({
            clientEventId: attempt.clientEventId,
            status: 'rejected',
            reason: '送信日時のタイムスタンプが許容範囲外（未来または30日以上前）です。',
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

        // P1: Reject client-controlled review / hint fields.
        // These directly drive XP / quest bonus computation in
        // recalculateUserStats, so untrusted offline payloads must be
        // sanitized before persistence.
        //
        // - hintsUsed: clamp to the curriculum's stage cap (0..3). A forged
        //   higher value would inflate grit-quest XP via the per-day quest
        //   trigger `isCorrect && hintsUsed >= 1`.
        // - isReview: derived server-side. A "review" attempt means the
        //   user is re-doing a question they previously got correct, so
        //   look for a prior correct attempt with `createdAt` strictly
        //   before this one. If none exists, isReview is forced to false
        //   regardless of what the client claims — preventing forged
        //   payloads from claiming the 25-XP review bonus.
        const sanitizedHintsUsed = Math.max(
          0,
          Math.min(MAX_HINTS_USED, Math.floor(Number(attempt.hintsUsed) || 0))
        );

        let derivedIsReview = false;
        try {
          const priorAttempts = await this.attemptRepo.findAttemptsByQuestion(
            userId,
            attempt.questionId
          );
          derivedIsReview = priorAttempts.some(
            (a: any) =>
              a.isCorrect === true &&
              new Date(a.createdAt).getTime() < attemptDate.getTime()
          );
        } catch (err) {
          console.error(
            `Failed to derive isReview server-side for question ${attempt.questionId}:`,
            err
          );
          // Fail closed: when uncertain, treat as a normal first attempt
          // rather than awarding the review bonus.
          derivedIsReview = false;
        }

        const { created, attempt: savedAttempt } =
          await this.syncRepo.createAttemptIdempotent({
            clientEventId: attempt.clientEventId,
            userId,
            questionId: attempt.questionId,
            isCorrect,
            hintsUsed: sanitizedHintsUsed,
            answerSubmitted: attempt.answerSubmitted,
            durationSeconds: attempt.durationSeconds ?? null,
            errorType: attempt.errorType ?? null,
            isReview: derivedIsReview,
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
