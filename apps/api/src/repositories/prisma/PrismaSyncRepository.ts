import { SyncRepository } from '../SyncRepository';
import prisma from '../../db';
import { withPrismaRetry } from '../../utils/prismaRetry';

/** XP earned per correct answer. */
const XP_PER_CORRECT = 10;
/** XP earned per incorrect answer where hints were used (grit reward). */
const XP_PER_GRIT = 5;
/** XP required per level. */
const XP_PER_LEVEL = 100;

/**
 * Prisma implementation of SyncRepository (Phase 16-D).
 * Uses `clientEventId` unique constraint for idempotent upsert.
 */
export class PrismaSyncRepository implements SyncRepository {
  /** @inheritdoc */
  async createAttemptIdempotent(data: {
    clientEventId: string;
    userId: string;
    questionId: string;
    isCorrect: boolean;
    hintsUsed: number;
    answerSubmitted: string;
    durationSeconds?: number | null;
    errorType?: string | null;
    isReview?: boolean | null;
    createdAt: Date;
  }): Promise<{ created: boolean; attempt: { id: string; clientEventId: string } }> {
    // Check if duplicate already exists (D-1)
    const existing = await prisma.attempt.findUnique({
      where: { clientEventId: data.clientEventId },
      select: { id: true, clientEventId: true },
    });

    if (existing) {
      return {
        created: false,
        attempt: {
          id: existing.id,
          clientEventId: existing.clientEventId ?? data.clientEventId,
        },
      };
    }

    try {
      const created = await prisma.attempt.create({
        data: {
          userId: data.userId,
          questionId: data.questionId,
          isCorrect: data.isCorrect,
          hintsUsed: data.hintsUsed,
          answerSubmitted: data.answerSubmitted,
          durationSeconds: data.durationSeconds ?? null,
          errorType: data.errorType ?? null,
          clientEventId: data.clientEventId,
          isReview: data.isReview ?? false,
          createdAt: data.createdAt,
        },
        select: { id: true, clientEventId: true },
      });

      return {
        created: true,
        attempt: {
          id: created.id,
          clientEventId: created.clientEventId ?? data.clientEventId,
        },
      };
    } catch (error: any) {
      // P2002 is Prisma's error code for unique key constraint violation.
      // We also check for 'Unique constraint' in the error message for robustness.
      if (error && (error.code === 'P2002' || error.message?.includes('Unique constraint'))) {
        const existingAfterRace = await prisma.attempt.findUnique({
          where: { clientEventId: data.clientEventId },
          select: { id: true, clientEventId: true },
        });
        if (existingAfterRace) {
          return {
            created: false,
            attempt: {
              id: existingAfterRace.id,
              clientEventId: existingAfterRace.clientEventId ?? data.clientEventId,
            },
          };
        }
      }
      throw error;
    }
  }

  /** @inheritdoc */
  async findAttemptByClientEventId(
    clientEventId: string
  ): Promise<{ id: string } | null> {
    const existing = await prisma.attempt.findUnique({
      where: { clientEventId },
      select: { id: true },
    });
    return existing ? { id: existing.id } : null;
  }

  /** @inheritdoc */
  async createSyncLog(data: {
    userId: string;
    deviceId: string;
    attemptCount: number;
    status: string;
    errorDetails?: string | null;
  }): Promise<{ id: string }> {
    const log = await prisma.offlineSyncLog.create({
      data: {
        userId: data.userId,
        deviceId: data.deviceId,
        attemptCount: data.attemptCount,
        status: data.status,
        errorDetails: data.errorDetails ?? null,
      },
      select: { id: true },
    });
    return log;
  }

  /**
   * Recalculate XP, level, and streak from all Attempts (D-2).
   * Server is the single source of truth — client values are optimistic.
   */
  async recalculateUserStats(userId: string): Promise<{
    currentXp: number;
    level: number;
    streakCount: number;
  }> {
    // P1: Wrap read-compute-write in a Serializable transaction with
    // P2034 retry. Two concurrent /api/sync/batch requests for the same
    // user would otherwise each read a snapshot, compute aggregate XP /
    // streak from it, and `user.update` blindly — the later writer would
    // overwrite the earlier (newer) aggregate with a stale value until
    // some later sync ran. Serializable isolation forces one of the
    // concurrent transactions to abort with P2034 and `withPrismaRetry`
    // re-runs it against the now-fresh snapshot.
    return withPrismaRetry(() =>
      prisma.$transaction(
        async (tx) => this.recalculateUserStatsInTx(tx, userId),
        { isolationLevel: 'Serializable' }
      )
    );
  }

  /**
   * Inner implementation of recalculateUserStats running inside a
   * Serializable transaction. All reads + the single user.update happen
   * against the same snapshot, so concurrent recomputes either both see
   * each other's writes (one retries) or one wins outright.
   */
  private async recalculateUserStatsInTx(
    tx: typeof prisma | Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    userId: string
  ): Promise<{ currentXp: number; level: number; streakCount: number }> {
    const attempts = await tx.attempt.findMany({
      where: { userId },
      select: { isCorrect: true, hintsUsed: true, questionId: true, createdAt: true, isReview: true },
      orderBy: { createdAt: 'asc' },
    });

    if (attempts.length === 0) {
      await tx.user.update({
        where: { id: userId },
        data: { currentXp: 0, level: 1, streakCount: 0 },
      });
      return { currentXp: 0, level: 1, streakCount: 0 };
    }

    // Helper to format Date into JST YYYY-MM-DD
    const getJstDate = (date: Date): string => {
      const jstTime = date.getTime() + (9 * 60 * 60 * 1000);
      const jstDate = new Date(jstTime);
      return jstDate.toISOString().split('T')[0];
    };

    // Group attempts by JST date
    const attemptsByDay = new Map<string, any[]>();
    for (const a of attempts) {
      const dayStr = getJstDate(a.createdAt);
      if (!attemptsByDay.has(dayStr)) {
        attemptsByDay.set(dayStr, []);
      }
      attemptsByDay.get(dayStr)!.push(a);
    }

    const sortedDays = [...attemptsByDay.keys()].sort();
    
    let currentXp = 0;
    let currentLevel = 1;
    let currentStreak = 0;
    let lastActiveStr: string | null = null;
    const questionMissedOrHinted = new Map<string, boolean>();
    // P2: Derive review status from history rather than trusting the stored
    // `isReview` column. The Phase-16-D migration adds isReview with a default
    // of false, so review attempts that predate the column would otherwise be
    // scored as normal 10-XP answers on first recompute and silently reduce a
    // user's accumulated XP. A "review" is a correct answer to a question the
    // user already answered correctly earlier (chronologically).
    const answeredCorrectlyBefore = new Set<string>();

    for (const dayStr of sortedDays) {
      // 1. Update streak day-by-day
      if (!lastActiveStr) {
        currentStreak = 1;
      } else {
        const lastActiveDate = new Date(lastActiveStr);
        const currentDate = new Date(dayStr);
        const diffMs = currentDate.getTime() - lastActiveDate.getTime();
        const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
        if (diffDays === 1) {
          currentStreak += 1;
        } else if (diffDays > 1) {
          currentStreak = 1;
        }
      }
      lastActiveStr = dayStr;

      // 2. Process day's attempts chronologically
      const dayAttempts = attemptsByDay.get(dayStr)!.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      
      let adventureCompleted = false;
      let gritCompleted = false;
      let intuitionCompleted = false;
      let attemptsCountToday = 0;

      for (const a of dayAttempts) {
        attemptsCountToday++;
        const isCorrect = a.isCorrect;
        
        // O(1) Check Grit retry bonus
        const isGritBonus = isCorrect && !!questionMissedOrHinted.get(a.questionId);

        // Derived review: correct answer to a previously-correct question.
        const effectiveIsReview = answeredCorrectlyBefore.has(a.questionId);

        const xpAwarded = isCorrect ? (isGritBonus ? 30 : (effectiveIsReview ? 25 : 10)) : 0;
        let questXp = 0;

        if (!adventureCompleted && attemptsCountToday >= 3) {
          adventureCompleted = true;
          questXp += 50;
        }
        if (!gritCompleted && isCorrect && a.hintsUsed >= 1) {
          gritCompleted = true;
          questXp += 50;
        }
        if (!intuitionCompleted && isCorrect && a.hintsUsed === 0) {
          intuitionCompleted = true;
          questXp += 50;
        }

        currentXp += xpAwarded + questXp;
        let xpNeeded = currentLevel * 100;
        while (currentXp >= xpNeeded) {
          currentXp -= xpNeeded;
          currentLevel += 1;
          xpNeeded = currentLevel * 100;
        }

        // Update tracking maps for future attempts on this question
        if (!isCorrect || a.hintsUsed >= 2) {
          questionMissedOrHinted.set(a.questionId, true);
        }
        if (isCorrect) {
          answeredCorrectlyBefore.add(a.questionId);
        }
      }
    }

    // Update user record atomically — runs inside the Serializable tx.
    const updateData: any = {
      currentXp,
      level: currentLevel,
      streakCount: currentStreak,
    };
    if (lastActiveStr) {
      updateData.lastActiveDate = new Date(lastActiveStr);
    }

    await tx.user.update({
      where: { id: userId },
      data: updateData,
    });

    return { currentXp, level: currentLevel, streakCount: currentStreak };
  }

  /** @inheritdoc */
  async isBossBattleAcceptingDamage(
    battleId: string,
    atTimestamp: Date
  ): Promise<boolean> {
    const battle = await prisma.bossBattle.findUnique({
      where: { id: battleId },
      select: { endsAt: true, isAlive: true },
    });

    if (!battle) return false;
    return battle.isAlive && battle.endsAt > atTimestamp;
  }

  /**
   * Calculate streak count from a sorted list of attempt dates.
   * A streak is consecutive calendar days (JST) with at least 1 attempt.
   */
  private calculateStreak(dates: Date[]): number {
    if (dates.length === 0) return 0;

    const uniqueDays = new Set<string>();
    for (const d of dates) {
      // Convert to JST date string
      const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
      uniqueDays.add(jst.toISOString().slice(0, 10));
    }

    const sortedDays = [...uniqueDays].sort().reverse();
    let streak = 1;
    for (let i = 1; i < sortedDays.length; i++) {
      const prev = new Date(sortedDays[i - 1]);
      const curr = new Date(sortedDays[i]);
      const diffMs = prev.getTime() - curr.getTime();
      const diffDays = diffMs / (24 * 60 * 60 * 1000);
      if (Math.abs(diffDays - 1) < 0.01) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }
}
