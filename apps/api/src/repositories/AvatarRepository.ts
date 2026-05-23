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
  /**
   * Insert an array of avatar candidates as a single all-or-nothing
   * transaction. If any row fails, none are persisted — the caller is
   * responsible for compensating any storage uploads that have already
   * succeeded for this request.
   */
  createAvatarsAtomically(
    items: Array<{
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
    }>
  ): Promise<Avatar[]>;
  updateAvatarStatus(id: string, status: string, rejectionReason?: string | null): Promise<Avatar>;
  updateAvatarStatusAtomic(id: string, expectedStatus: string, newStatus: string, rejectionReason?: string | null): Promise<Avatar | null>;
  deleteAvatars(ids: string[]): Promise<void>;
  findExpiredAvatars(cutoff: Date): Promise<Avatar[]>;
  findOldRejectedAvatars(cutoff: Date): Promise<Avatar[]>;

  // Atomic updates with serializable isolation protection (TOCTOU protection)
  atomicIncrementQuota(userId: string, weekBucket: string, limit: number, resetAt: Date): Promise<{
    success: boolean;
    newCount: number;
  }>;
  /**
   * Roll back a previously claimed quota slot. Used as a compensating
   * action when the rest of a /generate flow fails after quota was
   * reserved, so the user does not lose a weekly attempt to a
   * transient downstream error.
   */
  releaseQuotaIncrement(userId: string, weekBucket: string): Promise<void>;
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
