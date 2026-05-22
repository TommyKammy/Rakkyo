import { Avatar, AvatarGenerationQuota, AvatarApprovalAudit } from '@prisma/client';

export interface AvatarRepository {
  findAvatarById(id: string): Promise<Avatar | null>;
  findLatestApprovedAvatar(userId: string): Promise<Avatar | null>;
  findPendingAvatarsByUserIds(userIds: string[]): Promise<Avatar[]>;
  createAvatar(data: {
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
  }): Promise<Avatar>;
  updateAvatarStatus(id: string, status: string, rejectionReason?: string | null): Promise<Avatar>;
  deleteAvatars(ids: string[]): Promise<void>;
  findExpiredAvatars(cutoff: Date): Promise<Avatar[]>;
  
  // Atomic updates with serializable isolation protection (TOCTOU protection)
  atomicIncrementQuota(userId: string, weekBucket: string, limit: number, resetAt: Date): Promise<{
    success: boolean;
    newCount: number;
  }>;
  getGenerationQuota(userId: string, weekBucket: string): Promise<AvatarGenerationQuota | null>;
  
  // Audits
  createApprovalAudit(data: {
    avatarId: string;
    moderatorId: string;
    action: string;
    imageHash: string;
    reason?: string | null;
  }): Promise<AvatarApprovalAudit>;
}
