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
  }): Promise<Attempt>;
  findAttemptsByUser(userId: string, limit?: number): Promise<any[]>;
  findAttemptsByQuestion(userId: string, questionId: string): Promise<Attempt[]>;
  findAttemptById(id: string): Promise<Attempt | null>;
  getAttemptCountToday(userId: string): Promise<number>;
  getUserBadges(userId: string): Promise<string[]>;
  addUserBadge(userId: string, badgeName: string): Promise<void>;
}
