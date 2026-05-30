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
    isReview?: boolean | null;
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
      isReview: data.isReview ?? false,
    };

    inMemoryState.attempts.push(attempt);

    return {
      created: true,
      attempt: { id, clientEventId: data.clientEventId },
    };
  }

  /** @inheritdoc */
  async findAttemptByClientEventId(
    clientEventId: string
  ): Promise<{ id: string } | null> {
    const existing = inMemoryState.attempts.find(
      (a) => a.clientEventId === clientEventId
    );
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

    if (attempts.length === 0) {
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
      const dayStr = getJstDate(new Date(a.createdAt));
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
    // P2: Derive review status from history (see PrismaSyncRepository for the
    // full rationale) — robust to the isReview column's default-false migration.
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
      const dayAttempts = attemptsByDay.get(dayStr)!.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      
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

    // Update user record
    const user = inMemoryState.users.find((u) => u.id === userId);
    if (user) {
      user.currentXp = currentXp;
      user.level = currentLevel;
      user.streakCount = currentStreak;
      if (lastActiveStr) {
        user.lastActiveDate = new Date(lastActiveStr).toISOString();
      }
    }

    return { currentXp, level: currentLevel, streakCount: currentStreak };
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
