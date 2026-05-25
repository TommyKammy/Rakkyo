import { SyncRepository } from '../SyncRepository';
import prisma from '../../db';

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
    const attempts = await prisma.attempt.findMany({
      where: { userId },
      select: { isCorrect: true, hintsUsed: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    let totalXp = 0;
    for (const a of attempts) {
      totalXp += a.isCorrect ? XP_PER_CORRECT : (a.hintsUsed > 0 ? XP_PER_GRIT : 0);
    }

    const level = Math.floor(totalXp / XP_PER_LEVEL) + 1;
    const streakCount = this.calculateStreak(attempts.map((a) => a.createdAt));

    // Update user record atomically
    await prisma.user.update({
      where: { id: userId },
      data: { currentXp: totalXp, level, streakCount },
    });

    return { currentXp: totalXp, level, streakCount };
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
