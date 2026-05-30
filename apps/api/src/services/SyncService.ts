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
  /**
   * True when the rejection is deterministic and will never succeed on retry
   * (unknown questionId, out-of-window timestamp). The client marks these as
   * a terminal REJECTED status instead of retrying forever. Transient
   * rejections (DB error, generic server error) omit this flag so the client
   * keeps them retryable.
   */
  permanent?: boolean;
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

    // P2: Sort by createdAt ASC so server-derived `isReview` is independent
    // of the payload's item ordering. Without this, a batch that lists a
    // newer attempt before its older prerequisite would evaluate the newer
    // one first (no prior in DB yet → isReview=false), then the older one,
    // leaving identical history graded differently from the chronological
    // case. Sorting up front lets each attempt's prior-attempt lookup see
    // the already-persisted predecessors from the same batch.
    const sortedAttempts = [...attempts].sort((a, b) => {
      const aTs = new Date(a.createdAt).getTime();
      const bTs = new Date(b.createdAt).getTime();
      // Stable on equal timestamps: keep payload order.
      return aTs - bTs;
    });

    let isFirst = true;
    for (const attempt of sortedAttempts) {
      try {
        // P2: Idempotency check FIRST — before the throttle and the timestamp
        // window. An attempt already persisted on the server (e.g. its sync
        // response was lost) might be re-sent after the 30-day window; without
        // this short-circuit the age guard below would permanently reject a
        // row that actually succeeded, and the client would mark its local
        // copy REJECTED. Returning `duplicate` lets the client mark it SYNCED.
        const alreadyPersisted = await this.syncRepo.findAttemptByClientEventId(
          attempt.clientEventId
        );
        if (alreadyPersisted) {
          results.push({
            clientEventId: attempt.clientEventId,
            status: 'duplicate',
            serverId: alreadyPersisted.id,
          });
          continue;
        }

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
            permanent: true,
          });
          continue;
        }

        // P1: Server-Side Correctness Verification.
        // Recompute correctness server-side by checking submitted answers
        // against canonical curriculum answers before persistence.
        //
        // If the questionId can't be resolved against the curriculum, we
        // refuse the attempt entirely rather than fall back to the client's
        // claimed isCorrect — otherwise a forged offline payload with a
        // bogus questionId could inflate XP / quest progression via
        // recalculateUserStats. A real lookup error (DB outage) keeps the
        // attempt retryable on the client (status: rejected).
        let question: any = null;
        try {
          question = await this.curriculumRepo.findQuestionById(attempt.questionId);
        } catch (err) {
          console.error(
            `Failed to verify correctness for question ${attempt.questionId} server-side:`,
            err
          );
          results.push({
            clientEventId: attempt.clientEventId,
            status: 'rejected',
            reason: '問題の検証に失敗しました。後で再試行されます。',
          });
          continue;
        }

        if (!question) {
          results.push({
            clientEventId: attempt.clientEventId,
            status: 'rejected',
            reason: '不明な問題IDのため受け付けできません。',
            permanent: true,
          });
          continue;
        }

        const isCorrect = question.answers.some(
          (ans: string) =>
            ans.toLowerCase().trim() === attempt.answerSubmitted.toLowerCase().trim()
        );

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

    // P2: Award badges from the reconciled attempt history. recalculateUserStats
    // only writes XP/level/streak, so thresholds crossed entirely offline
    // (e.g. 5 correct answers, 3-day streak) would otherwise never award their
    // badge until a later online submission happened to re-check. Mirror the
    // /lessons/submit badge logic here. Best-effort: a badge failure must not
    // fail the whole sync batch.
    try {
      await this.reconcileBadges(userId, stats);
    } catch (err) {
      console.error('Failed to reconcile badges during offline sync:', err);
    }

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

  /**
   * Award achievement badges from the user's full attempt history after an
   * offline sync (P2). This mirrors the badge logic in /api/lessons/submit
   * (apps/api/src/routes/lessons/attempts.ts) so offline-earned thresholds
   * are not lost. addUserBadge is idempotent (unique (userId, badgeId) +
   * existence check), so re-running across syncs is safe.
   *
   * @param userId - The user to reconcile badges for
   * @param stats - The freshly recomputed XP / level / streak aggregates
   */
  private async reconcileBadges(
    userId: string,
    stats: { currentXp: number; level: number; streakCount: number }
  ): Promise<void> {
    const attempts = await this.attemptRepo.findAttemptsByUser(userId);
    const earned = await this.attemptRepo.getUserBadges(userId);
    const has = (name: string) => earned.some((b) => b.includes(name));

    const correctCount = attempts.filter((a: any) => a.isCorrect).length;
    const gritAttempts = attempts.filter((a: any) => a.hintsUsed >= 1);
    const gritSuccess = gritAttempts.filter((a: any) => a.isCorrect);
    const gritScore =
      gritAttempts.length > 0
        ? Math.round((gritSuccess.length / gritAttempts.length) * 100)
        : 0;
    const totalDurationSeconds = attempts.reduce(
      (sum: number, a: any) => sum + (a.durationSeconds || 0),
      0
    );

    // Longest run of consecutive correct answers (chronological order).
    const sorted = [...attempts].sort(
      (a: any, b: any) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    let consecutive = 0;
    let maxConsecutive = 0;
    for (const a of sorted) {
      if (a.isCorrect) {
        consecutive++;
        if (consecutive > maxConsecutive) maxConsecutive = consecutive;
      } else {
        consecutive = 0;
      }
    }

    const toAward: string[] = [];
    if ((stats.currentXp > 0 || stats.level > 1) && !has('冒険のはじまり')) {
      toAward.push('冒険のはじまり');
    }
    if (stats.streakCount >= 3 && !has('あきらめない心')) {
      toAward.push('あきらめない心');
    }
    if (correctCount >= 5 && !has('数学マスターの卵')) {
      toAward.push('数学マスターの卵');
    }
    if (
      attempts.length >= 5 &&
      gritAttempts.length >= 1 &&
      gritScore >= 90 &&
      !has('Gritの達人')
    ) {
      toAward.push('Gritの達人');
    }
    if (totalDurationSeconds >= 36000 && !has('無限の探求者')) {
      toAward.push('無限の探求者');
    }
    if (stats.streakCount >= 7 && !has('ストリークの鬼')) {
      toAward.push('ストリークの鬼');
    }
    if (maxConsecutive >= 10 && !has('完璧主義者')) {
      toAward.push('完璧主義者');
    }

    for (const name of toAward) {
      await this.attemptRepo.addUserBadge(userId, name);
    }
  }
}
