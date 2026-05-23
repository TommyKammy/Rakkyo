import { Avatar, AvatarGenerationQuota, AvatarApprovalAudit } from '@prisma/client';
import { AvatarRepository } from '../AvatarRepository';
import prisma from '../../db';
import { withPrismaRetry } from '../../utils/prismaRetry';

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

  async createAvatarsAtomically(items: Array<{
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
  }>): Promise<Avatar[]> {
    // All-or-nothing batch insert: a single failure rolls back every
    // row, so the route's compensating storage-delete pass operates on
    // a clean slate (no orphan DB rows referencing already-deleted
    // object keys).
    return prisma.$transaction(items.map(data => prisma.avatar.create({ data })));
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
    // Single-statement conditional update: `updateMany` returns count=0
    // if the WHERE no longer matches (status already transitioned), so
    // there is no read-then-write race window and no need for
    // Serializable isolation or P2034 retry. The follow-up findUnique
    // returns the now-final row (or null if the row disappeared).
    return withPrismaRetry(async () => {
      const result = await prisma.avatar.updateMany({
        where: { id, status: expectedStatus },
        data: {
          status: newStatus,
          rejectionReason: rejectionReason || null
        }
      });
      if (result.count === 0) {
        return null;
      }
      return prisma.avatar.findUnique({ where: { id } });
    });
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

  async findOldRejectedAvatars(cutoff: Date): Promise<Avatar[]> {
    return prisma.avatar.findMany({
      where: {
        status: 'REJECTED',
        createdAt: { lt: cutoff }
      }
    });
  }

  async atomicIncrementQuota(userId: string, weekBucket: string, limit: number, resetAt: Date): Promise<{
    success: boolean;
    newCount: number;
  }> {
    // Conditional updateMany is atomic at the row level: it only
    // increments rows whose current count < limit and matches the
    // (userId, weekBucket) pair. This avoids the read-then-write race
    // where two concurrent generations both observe count < limit and
    // both increment past the cap.
    //
    // For the first-ever request in a week the row doesn't exist yet,
    // so updateMany returns count=0; we fall through to create. If a
    // second concurrent request raced us on create, the unique-key
    // collision throws P2002 which withPrismaRetry catches and retries
    // — the second attempt now sees the row and goes through the
    // conditional updateMany path.
    return withPrismaRetry(async () => {
      const updated = await prisma.avatarGenerationQuota.updateMany({
        where: { userId, weekBucket, count: { lt: limit } },
        data: { count: { increment: 1 } }
      });

      if (updated.count === 1) {
        const row = await prisma.avatarGenerationQuota.findUnique({
          where: { userId_weekBucket: { userId, weekBucket } }
        });
        return { success: true, newCount: row!.count };
      }

      // updateMany matched zero rows — either at the cap or no row yet.
      const existing = await prisma.avatarGenerationQuota.findUnique({
        where: { userId_weekBucket: { userId, weekBucket } }
      });
      if (existing) {
        return { success: false, newCount: existing.count };
      }

      const created = await prisma.avatarGenerationQuota.create({
        data: { userId, weekBucket, count: 1, resetAt }
      });
      return { success: true, newCount: created.count };
    });
  }

  async releaseQuotaIncrement(userId: string, weekBucket: string): Promise<void> {
    // Conditional decrement: only refunds when count > 0 so a noop on
    // an already-zero or missing row does no harm. Idempotent and safe
    // to call from compensating-action paths.
    await prisma.avatarGenerationQuota.updateMany({
      where: { userId, weekBucket, count: { gt: 0 } },
      data: { count: { decrement: 1 } }
    });
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
