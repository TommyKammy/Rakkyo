import { AttemptRepository } from '../AttemptRepository';
import { Attempt } from '@prisma/client';
import prisma from '../../db';

export class PrismaAttemptRepository implements AttemptRepository {
  async createAttempt(data: {
    userId: string;
    questionId: string;
    isCorrect: boolean;
    hintsUsed: number;
    answerSubmitted: string;
    durationSeconds?: number | null;
    errorType?: string | null;
    aiDiagnosis?: string | null;
  }): Promise<Attempt> {
    return prisma.attempt.create({
      data
    });
  }

  async findAttemptsByUser(userId: string, limit?: number): Promise<any[]> {
    return prisma.attempt.findMany({
      where: { userId },
      include: { question: { include: { lesson: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }

  async findAttemptsByQuestion(userId: string, questionId: string): Promise<Attempt[]> {
    return prisma.attempt.findMany({
      where: { userId, questionId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findAttemptById(id: string): Promise<Attempt | null> {
    return prisma.attempt.findUnique({
      where: { id }
    });
  }

  async getAttemptCountToday(userId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return prisma.attempt.count({
      where: {
        userId,
        createdAt: {
          gte: today
        }
      }
    });
  }

  async getUserBadges(userId: string): Promise<string[]> {
    const userBadges = await prisma.userBadge.findMany({
      where: { userId },
      include: { badge: true }
    });
    return userBadges.map(ub => `${ub.badge.iconUrl} ${ub.badge.name}`);
  }

  async addUserBadge(userId: string, badgeName: string): Promise<void> {
    // Clean emojis and leading/trailing whitespace to match Badge.name (e.g. "🎉 冒険のはじまり" -> "冒険のはじまり")
    const cleanBadgeName = badgeName.replace(/^[\p{Emoji}\s\uFE0F\u200D\u200B]+/gu, '').trim();

    const badge = await prisma.badge.findFirst({
      where: { name: cleanBadgeName }
    });
    if (!badge) {
      console.warn(`⚠️ Badge not found in DB: ${cleanBadgeName}`);
      return;
    }

    const exists = await prisma.userBadge.findUnique({
      where: {
        userId_badgeId: {
          userId,
          badgeId: badge.id
        }
      }
    });
    if (!exists) {
      await prisma.userBadge.create({
        data: {
          userId,
          badgeId: badge.id
        }
      });
    }
  }
}
