import { SyncRepository } from '../SyncRepository';
import { inMemoryState } from './state';
import type { AttemptMock } from './state';
import crypto from 'crypto';

/** XP earned per correct answer. */
const XP_PER_CORRECT = 10;
/** XP earned per incorrect answer where hints were used (grit reward). */
const XP_PER_GRIT = 5;
/** XP required per level. */
const XP_PER_LEVEL = 100;

/** In-memory sync log entry. */
interface SyncLogEntry {
  id: string;
  userId: string;
  deviceId: string;
  attemptCount: number;
  status: string;
  errorDetails: string | null;
  syncedAt: string;
}

/** Module-level sync log store. Cleared in tests via resetSyncLogs(). */
const syncLogs: SyncLogEntry[] = [];

/**
 * Reset sync logs — call from `afterEach` in tests.
 * // TODO(phase-16-D): Redis化必須 for production multi-process deployments.
 */
export function resetSyncLogs(): void {
  syncLogs.length = 0;
}

/**
 * In-memory implementation of SyncRepository for tests (Phase 16-D).
 * Contract-identical to PrismaSyncRepository per §3-1.
 */
export class InMemorySyncRepository implements SyncRepository {
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
    // Check for duplicate clientEventId (D-1)
    const existing = inMemoryState.attempts.find(
      (a) => a.clientEventId === data.clientEventId
    );

    if (existing) {
      return {
        created: false,
        attempt: {
          id: existing.id,
          clientEventId: data.clientEventId,
        },
      };
    }

    const id = crypto.randomUUID();
    const attempt: AttemptMock = {
      id,
      userId: data.userId,
      questionId: data.questionId,
      isCorrect: data.isCorrect,
      hintsUsed: data.hintsUsed,
      answerSubmitted: data.answerSubmitted,
      durationSeconds: data.durationSeconds ?? null,
      errorType: data.errorType ?? null,
      createdAt: data.createdAt.toISOString(),
      clientEventId: data.clientEventId,
    };

    inMemoryState.attempts.push(attempt);

    return {
      created: true,
      attempt: { id, clientEventId: data.clientEventId },
    };
  }

  /** @inheritdoc */
  async createSyncLog(data: {
    userId: string;
    deviceId: string;
    attemptCount: number;
    status: string;
    errorDetails?: string | null;
  }): Promise<{ id: string }> {
    const id = crypto.randomUUID();
    syncLogs.push({
      id,
      userId: data.userId,
      deviceId: data.deviceId,
      attemptCount: data.attemptCount,
      status: data.status,
      errorDetails: data.errorDetails ?? null,
      syncedAt: new Date().toISOString(),
    });
    return { id };
  }

  /** @inheritdoc */
  async recalculateUserStats(userId: string): Promise<{
    currentXp: number;
    level: number;
    streakCount: number;
  }> {
    const attempts = inMemoryState.attempts
      .filter((a) => a.userId === userId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    let totalXp = 0;
    for (const a of attempts) {
      totalXp += a.isCorrect ? XP_PER_CORRECT : (a.hintsUsed > 0 ? XP_PER_GRIT : 0);
    }

    const level = Math.floor(totalXp / XP_PER_LEVEL) + 1;
    const streakCount = this.calculateStreak(attempts.map((a) => new Date(a.createdAt)));

    // Update user record
    const user = inMemoryState.users.find((u) => u.id === userId);
    if (user) {
      user.currentXp = totalXp;
      user.level = level;
      user.streakCount = streakCount;
    }

    return { currentXp: totalXp, level, streakCount };
  }

  /** @inheritdoc */
  async isBossBattleAcceptingDamage(
    battleId: string,
    atTimestamp: Date
  ): Promise<boolean> {
    const battle = inMemoryState.bossBattles.find((b) => b.id === battleId);
    if (!battle) return false;
    return battle.isAlive && new Date(battle.endsAt) > atTimestamp;
  }

  /** Calculate streak from sorted dates (same logic as Prisma implementation). */
  private calculateStreak(dates: Date[]): number {
    if (dates.length === 0) return 0;

    const uniqueDays = new Set<string>();
    for (const d of dates) {
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
