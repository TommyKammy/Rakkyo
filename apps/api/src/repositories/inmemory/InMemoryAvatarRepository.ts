import { Avatar, AvatarGenerationQuota, AvatarApprovalAudit } from '@prisma/client';
import { AvatarRepository } from '../AvatarRepository';
import { inMemoryState, AvatarMock, AvatarGenerationQuotaMock, AvatarApprovalAuditMock } from './state';
import crypto from 'crypto';

export class InMemoryAvatarRepository implements AvatarRepository {
  private mapMockToAvatar(mock: AvatarMock): Avatar {
    return {
      id: mock.id,
      userId: mock.userId,
      status: mock.status,
      baseVegetable: mock.baseVegetable,
      mainColor: mock.mainColor,
      facialFeatures: mock.facialFeatures,
      clothing: mock.clothing,
      expression: mock.expression,
      prompt: mock.prompt,
      objectKey: mock.objectKey,
      rejectionReason: mock.rejectionReason,
      createdAt: new Date(mock.createdAt),
      updatedAt: new Date(mock.updatedAt)
    };
  }

  private mapMockToQuota(mock: AvatarGenerationQuotaMock): AvatarGenerationQuota {
    return {
      id: mock.id,
      userId: mock.userId,
      weekBucket: mock.weekBucket,
      count: mock.count,
      resetAt: new Date(mock.resetAt),
      createdAt: new Date(mock.createdAt),
      updatedAt: new Date(mock.updatedAt)
    };
  }

  private mapMockToAudit(mock: AvatarApprovalAuditMock): AvatarApprovalAudit {
    // `avatarId` is nullable in the schema (onDelete: SetNull) but the
    // generated Prisma client type still types it as non-null until
    // `prisma generate` is rerun against the updated schema. Cast to
    // satisfy the existing client signature; at runtime null flows
    // through correctly.
    return {
      id: mock.id,
      avatarId: mock.avatarId as unknown as string,
      moderatorId: mock.moderatorId,
      action: mock.action,
      imageHash: mock.imageHash,
      reason: mock.reason,
      createdAt: new Date(mock.createdAt)
    };
  }

  async findAvatarById(id: string): Promise<Avatar | null> {
    const mock = inMemoryState.avatars.find(a => a.id === id);
    return mock ? this.mapMockToAvatar(mock) : null;
  }

  async findLatestApprovedAvatar(userId: string): Promise<Avatar | null> {
    const list = inMemoryState.avatars
      .filter(a => a.userId === userId && a.status === 'APPROVED')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list.length > 0 ? this.mapMockToAvatar(list[0]) : null;
  }

  async findPendingAvatarsByUserIds(userIds: string[]): Promise<Avatar[]> {
    const list = inMemoryState.avatars
      .filter(a => userIds.includes(a.userId) && a.status === 'PENDING')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list.map(a => this.mapMockToAvatar(a));
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
    const nowStr = new Date().toISOString();
    const mock: AvatarMock = {
      ...data,
      rejectionReason: null,
      createdAt: nowStr,
      updatedAt: nowStr
    };
    inMemoryState.avatars.push(mock);
    return this.mapMockToAvatar(mock);
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
    // Stage in a local array first so any item-level failure can roll
    // back without touching the shared singleton. Node single-thread +
    // no await between stage & commit makes this race-free.
    const nowStr = new Date().toISOString();
    const staged: AvatarMock[] = items.map(data => ({
      ...data,
      rejectionReason: null,
      createdAt: nowStr,
      updatedAt: nowStr
    }));
    inMemoryState.avatars.push(...staged);
    return staged.map(m => this.mapMockToAvatar(m));
  }

  async updateAvatarStatus(id: string, status: string, rejectionReason?: string | null): Promise<Avatar> {
    const mock = inMemoryState.avatars.find(a => a.id === id);
    if (!mock) throw new Error('Avatar not found');
    
    mock.status = status;
    mock.rejectionReason = rejectionReason || null;
    mock.updatedAt = new Date().toISOString();
    return this.mapMockToAvatar(mock);
  }

  async updateAvatarStatusAtomic(id: string, expectedStatus: string, newStatus: string, rejectionReason?: string | null): Promise<Avatar | null> {
    const mock = inMemoryState.avatars.find(a => a.id === id);
    if (!mock || mock.status !== expectedStatus) {
      return null;
    }
    
    mock.status = newStatus;
    mock.rejectionReason = rejectionReason || null;
    mock.updatedAt = new Date().toISOString();
    return this.mapMockToAvatar(mock);
  }

  async deleteAvatars(ids: string[]): Promise<void> {
    // Mirror the Prisma onDelete: SetNull behaviour on AvatarApprovalAudit.
    // Audits for the deleted avatars survive with avatarId set to null
    // so the compliance trail is preserved across cron-cleanup runs.
    const idSet = new Set(ids);
    inMemoryState.avatarApprovalAudits.forEach(a => {
      if (a.avatarId && idSet.has(a.avatarId)) {
        a.avatarId = null;
      }
    });
    inMemoryState.avatars = inMemoryState.avatars.filter(a => !ids.includes(a.id));
  }

  async findExpiredAvatars(cutoff: Date): Promise<Avatar[]> {
    const cutoffMs = cutoff.getTime();
    const list = inMemoryState.avatars.filter(
      a => a.status === 'PENDING' && new Date(a.createdAt).getTime() < cutoffMs
    );
    return list.map(a => this.mapMockToAvatar(a));
  }

  async findOldRejectedAvatars(cutoff: Date): Promise<Avatar[]> {
    const cutoffMs = cutoff.getTime();
    const list = inMemoryState.avatars.filter(
      a => a.status === 'REJECTED' && new Date(a.createdAt).getTime() < cutoffMs
    );
    return list.map(a => this.mapMockToAvatar(a));
  }

  async atomicIncrementQuota(userId: string, weekBucket: string, limit: number, resetAt: Date): Promise<{
    success: boolean;
    newCount: number;
  }> {
    // In-memory JavaScript runs in a single-threaded event loop,
    // so this sync block is inherently thread-safe and atomic.
    const quota = inMemoryState.avatarQuotas.find(
      q => q.userId === userId && q.weekBucket === weekBucket
    );

    if (quota) {
      if (quota.count >= limit) {
        return { success: false, newCount: quota.count };
      }
      quota.count += 1;
      quota.updatedAt = new Date().toISOString();
      return { success: true, newCount: quota.count };
    } else {
      const nowStr = new Date().toISOString();
      const mock: AvatarGenerationQuotaMock = {
        id: `quota_${crypto.randomUUID()}`,
        userId,
        weekBucket,
        count: 1,
        resetAt: resetAt.toISOString(),
        createdAt: nowStr,
        updatedAt: nowStr
      };
      inMemoryState.avatarQuotas.push(mock);
      return { success: true, newCount: mock.count };
    }
  }

  async releaseQuotaIncrement(userId: string, weekBucket: string): Promise<void> {
    const quota = inMemoryState.avatarQuotas.find(
      q => q.userId === userId && q.weekBucket === weekBucket
    );
    if (quota && quota.count > 0) {
      quota.count -= 1;
      quota.updatedAt = new Date().toISOString();
    }
  }

  async getGenerationQuota(userId: string, weekBucket: string): Promise<AvatarGenerationQuota | null> {
    const quota = inMemoryState.avatarQuotas.find(
      q => q.userId === userId && q.weekBucket === weekBucket
    );
    return quota ? this.mapMockToQuota(quota) : null;
  }

  async createApprovalAudit(data: {
    avatarId: string;
    moderatorId: string;
    action: string;
    imageHash: string;
    reason?: string | null;
  }): Promise<AvatarApprovalAudit> {
    const mock: AvatarApprovalAuditMock = {
      id: `audit_${crypto.randomUUID()}`,
      avatarId: data.avatarId,
      moderatorId: data.moderatorId,
      action: data.action,
      imageHash: data.imageHash,
      reason: data.reason || null,
      createdAt: new Date().toISOString()
    };
    inMemoryState.avatarApprovalAudits.push(mock);
    return this.mapMockToAudit(mock);
  }
}
