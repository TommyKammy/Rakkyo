import { Avatar, AvatarGenerationQuota, AvatarApprovalAudit } from '@prisma/client';
import { AvatarRepository } from '../AvatarRepository';
import prisma from '../../db';

export class PrismaAvatarRepository implements AvatarRepository {
  async findAvatarById(id: string): Promise<Avatar | null> {
    return prisma.avatar.findUnique({
      where: { id }
    });
  }

  async findLatestApprovedAvatar(userId: string): Promise<Avatar | null> {
    return prisma.avatar.findFirst({
      where: { userId, status: 'APPROVED' },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findPendingAvatarsByUserIds(userIds: string[]): Promise<Avatar[]> {
    return prisma.avatar.findMany({
      where: { userId: { in: userIds }, status: 'PENDING' },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createAvatar(data: {
    id: string;
    userId: string;
    status: string;
    baseVegetable: string;
    mainColor: string;
    facialFeatures: string;
    clothing: string;
    expression: string;
    prompt: string;
    objectKey: string;
  }): Promise<Avatar> {
    return prisma.avatar.create({
      data
    });
  }

  async updateAvatarStatus(id: string, status: string, rejectionReason?: string | null): Promise<Avatar> {
    return prisma.avatar.update({
      where: { id },
      data: {
        status,
        rejectionReason: rejectionReason || null
      }
    });
  }

  async updateAvatarStatusAtomic(id: string, expectedStatus: string, newStatus: string, rejectionReason?: string | null): Promise<Avatar | null> {
    return prisma.$transaction(async (tx) => {
      const avatar = await tx.avatar.findUnique({
        where: { id }
      });
      if (!avatar || avatar.status !== expectedStatus) {
        return null;
      }
      return tx.avatar.update({
        where: { id },
        data: {
          status: newStatus,
          rejectionReason: rejectionReason || null
        }
      });
    }, { isolationLevel: 'Serializable' });
  }

  async deleteAvatars(ids: string[]): Promise<void> {
    await prisma.avatar.deleteMany({
      where: { id: { in: ids } }
    });
  }

  async findExpiredAvatars(cutoff: Date): Promise<Avatar[]> {
    return prisma.avatar.findMany({
      where: {
        status: 'PENDING',
        createdAt: { lt: cutoff }
      }
    });
  }

  async atomicIncrementQuota(userId: string, weekBucket: string, limit: number, resetAt: Date): Promise<{
    success: boolean;
    newCount: number;
  }> {
    return prisma.$transaction(async (tx) => {
      const quota = await tx.avatarGenerationQuota.findUnique({
        where: {
          userId_weekBucket: { userId, weekBucket }
        }
      });

      if (quota) {
        if (quota.count >= limit) {
          return { success: false, newCount: quota.count };
        }

        const updated = await tx.avatarGenerationQuota.update({
          where: {
            userId_weekBucket: { userId, weekBucket }
          },
          data: {
            count: { increment: 1 }
          }
        });
        return { success: true, newCount: updated.count };
      } else {
        const created = await tx.avatarGenerationQuota.create({
          data: {
            userId,
            weekBucket,
            count: 1,
            resetAt
          }
        });
        return { success: true, newCount: created.count };
      }
    }, { isolationLevel: 'Serializable' });
  }

  async getGenerationQuota(userId: string, weekBucket: string): Promise<AvatarGenerationQuota | null> {
    return prisma.avatarGenerationQuota.findUnique({
      where: {
        userId_weekBucket: { userId, weekBucket }
      }
    });
  }

  async createApprovalAudit(data: {
    avatarId: string;
    moderatorId: string;
    action: string;
    imageHash: string;
    reason?: string | null;
  }): Promise<AvatarApprovalAudit> {
    return prisma.avatarApprovalAudit.create({
      data: {
        avatarId: data.avatarId,
        moderatorId: data.moderatorId,
        action: data.action,
        imageHash: data.imageHash,
        reason: data.reason || null
      }
    });
  }
}
