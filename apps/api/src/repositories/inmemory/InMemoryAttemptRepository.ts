import { AttemptRepository } from '../AttemptRepository';
import { Attempt } from '@prisma/client';
import { inMemoryState } from './state';
import crypto from 'crypto';

export class InMemoryAttemptRepository implements AttemptRepository {
  async createAttempt(data: {
    userId: string;
    questionId: string;
    isCorrect: boolean;
    hintsUsed: number;
    answerSubmitted: string;
    durationSeconds?: number | null;
    errorType?: string | null;
    aiDiagnosis?: string | null;
    isReview?: boolean | null;
  }): Promise<Attempt> {
    const newAttempt = {
      ...data,
      isReview: data.isReview ?? false,
      id: 'attempt_' + crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    inMemoryState.attempts.push(newAttempt);
    return newAttempt as any as Attempt;
  }

  async findAttemptsByUser(userId: string, limit?: number): Promise<any[]> {
    const attempts = inMemoryState.attempts
      .filter(a => a.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
    const limited = limit ? attempts.slice(0, limit) : attempts;

    const { allCurriculums } = require('@rakkyo/curriculum');
    return limited.map(a => {
      let questionObj: any = null;
      for (const curriculum of allCurriculums) {
        for (const unit of curriculum.units) {
          for (const lesson of unit.lessons) {
            const q = lesson.questions.find((quest: any) => quest.id === a.questionId || quest.prompt === a.questionId);
            if (q) {
              questionObj = {
                id: q.id || q.prompt,
                type: q.type,
                prompt: q.prompt,
                answers: q.answers,
                options: q.options,
                explanation: q.explanation,
                hints: q.hints,
                lessonId: lesson.name,
                lesson: {
                  id: lesson.name,
                  name: lesson.name
                }
              };
              break;
            }
          }
          if (questionObj) break;
        }
        if (questionObj) break;
      }
      return {
        ...a,
        question: questionObj
      };
    });
  }

  async findAttemptsByQuestion(userId: string, questionId: string): Promise<Attempt[]> {
    const attempts = inMemoryState.attempts.filter(a => a.userId === userId && a.questionId === questionId);
    return attempts as any as Attempt[];
  }

  async findAttemptById(id: string): Promise<Attempt | null> {
    const attempt = inMemoryState.attempts.find(a => a.id === id);
    return attempt ? (attempt as any as Attempt) : null;
  }

  async getAttemptCountToday(userId: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    return inMemoryState.attempts.filter(a => 
      a.userId === userId && 
      a.createdAt.startsWith(today)
    ).length;
  }

  async getUserBadges(userId: string): Promise<string[]> {
    const user = inMemoryState.users.find(u => u.id === userId);
    if (!user) return [];
    
    const badgeEmojis: Record<string, string> = {
      '冒険のはじまり': '🎉',
      'あきらめない心': '🔥',
      '数学マスターの卵': '📐',
      'Gritの達人': '🔥',
      '無限の探求者': '⌛',
      'ストリークの鬼': '⚡',
      '完璧主義者': '🌟'
    };

    return user.badges.map(badgeName => {
      const cleanName = badgeName.replace(/^[\p{Emoji}\s\uFE0F\u200D\u200B]+/gu, '').trim();
      const emoji = badgeEmojis[cleanName] || '';
      return emoji ? `${emoji} ${cleanName}` : badgeName;
    });
  }

  async addUserBadge(userId: string, badgeName: string): Promise<void> {
    const user = inMemoryState.users.find(u => u.id === userId);
    if (user) {
      const cleanName = badgeName.replace(/^[\p{Emoji}\s\uFE0F\u200D\u200B]+/gu, '').trim();
      if (!user.badges.includes(cleanName)) {
        user.badges.push(cleanName);
      }
    }
  }
}
