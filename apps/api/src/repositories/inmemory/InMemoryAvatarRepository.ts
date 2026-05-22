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
    return {
      id: mock.id,
      avatarId: mock.avatarId,
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

  async updateAvatarStatus(id: string, status: string, rejectionReason?: string | null): Promise<Avatar> {
    const mock = inMemoryState.avatars.find(a => a.id === id);
    if (!mock) throw new Error('Avatar not found');
    
    mock.status = status;
    mock.rejectionReason = rejectionReason || null;
    mock.updatedAt = new Date().toISOString();
    return this.mapMockToAvatar(mock);
  }

  async deleteAvatars(ids: string[]): Promise<void> {
    inMemoryState.avatars = inMemoryState.avatars.filter(a => !ids.includes(a.id));
  }

  async findExpiredAvatars(cutoff: Date): Promise<Avatar[]> {
    const cutoffMs = cutoff.getTime();
    const list = inMemoryState.avatars.filter(
      a => a.status === 'PENDING' && new Date(a.createdAt).getTime() < cutoffMs
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
