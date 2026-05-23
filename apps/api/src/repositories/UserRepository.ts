import { User, Tenant, ClassEnrollment } from '@prisma/client';

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  createUser(data: {
    id: string;
    tenantId: string;
    email: string;
    passwordHash: string;
    nickname: string;
    role: string;
    schoolYear: number;
    parentalConsent: boolean;
  }): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User>;
  deleteUser(id: string): Promise<User>;
  findTenantById(id: string): Promise<Tenant | null>;
  findTenantByCode(code: string): Promise<Tenant | null>;
  createTenant(data: {
    id: string;
    name: string;
    code: string;
    plan: string;
  }): Promise<Tenant>;
  findEnrollment(userId: string, role: string): Promise<(ClassEnrollment & { class: any }) | null>;
  findEnrollmentsByUser(userId: string, role: string): Promise<any[]>;
  findEnrollmentsByClass(classId: string, role: string): Promise<any[]>;
  createEnrollment(data: {
    id: string;
    classId: string;
    userId: string;
    role: string;
  }): Promise<ClassEnrollment>;
  deleteUserData(userId: string): Promise<void>; // 忘れられる権利
  findParentMessages(userId: string): Promise<any[]>;
  createParentMessage(userId: string, message: string): Promise<any>;
  markParentMessageAsRead(id: string): Promise<boolean>;
  findChildrenByParent(parentId: string): Promise<User[]>;
  findParentsByChild(childId: string): Promise<User[]>;
  createParentChildRelation(parentId: string, childId: string): Promise<any>;

  /**
   * Atomically apply one abuse strike to a user.
   *
   * Implementations MUST evaluate "is this strike inside the rolling
   * window?", increment / reset the counter and decide whether to set
   * `lockedUntil` — all inside a single transaction (Prisma) or a single
   * synchronous block (InMemory). This closes the TOCTOU race where two
   * concurrent strikes could each promote themselves to "lock triggered"
   * and double-fire the parent notification.
   */
  atomicAbuseStrike(userId: string, opts: {
    windowMs: number;
    lockThreshold: number;
    lockDurationMs: number;
  }): Promise<{
    newCount: number;
    isLocked: boolean;
    lockedUntil: Date | null;
    /**
     * True only for the request that actually transitioned the user
     * into the locked state. Subsequent strikes that find the lock
     * already in place return false here so notifications fire exactly
     * once per lock event.
     */
    justLocked: boolean;
  }>;
}
