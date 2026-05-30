import { Attempt } from '@prisma/client';

export interface AttemptRepository {
  createAttempt(data: {
    userId: string;
    questionId: string;
    isCorrect: boolean;
    hintsUsed: number;
    answerSubmitted: string;
    durationSeconds?: number | null;
    errorType?: string | null;
    aiDiagnosis?: string | null;
    isReview?: boolean | null;
    /**
     * Optional idempotency key shared with the offline sync path (P2). When an
     * online submit's response is lost, the offline fallback re-enqueues the
     * same answer under THIS key; the sync endpoint then dedupes against the
     * online-created Attempt instead of double-counting XP/history.
     */
    clientEventId?: string | null;
  }): Promise<Attempt>;
  findAttemptsByUser(userId: string, limit?: number): Promise<any[]>;
  findAttemptsByQuestion(userId: string, questionId: string): Promise<Attempt[]>;
  findAttemptById(id: string): Promise<Attempt | null>;
  getAttemptCountToday(userId: string): Promise<number>;
  getUserBadges(userId: string): Promise<string[]>;
  addUserBadge(userId: string, badgeName: string): Promise<void>;
}
