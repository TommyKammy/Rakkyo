import { UserRepository } from '../UserRepository';
import { User, Tenant, ClassEnrollment } from '@prisma/client';
import { inMemoryState } from './state';
import { storageService } from '../../services/StorageService';
import crypto from 'crypto';


export class InMemoryUserRepository implements UserRepository {
  async findById(id: string): Promise<User | null> {
    const user = inMemoryState.users.find(u => u.id === id);
    return user ? ({ ...user, password: user.passwordHash } as any as User) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = inMemoryState.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    return user ? ({ ...user, password: user.passwordHash } as any as User) : null;
  }

  async createUser(data: {
    id: string;
    tenantId: string;
    email: string;
    passwordHash: string;
    nickname: string;
    role: string;
    schoolYear: number;
    parentalConsent: boolean;
  }): Promise<User> {
    const newUser = {
      ...data,
      currentXp: 0,
      level: 1,
      streakCount: 0,
      lastActiveDate: null,
      aiHintCountToday: 0,
      lastAiHintDate: null,
      abuseCount: 0,
      abuseLastAt: null,
      lockedUntil: null,
      badges: [],
      createdAt: new Date().toISOString(),
    };
    inMemoryState.users.push(newUser);
    return { ...newUser, password: newUser.passwordHash } as any as User;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User> {
    const user = inMemoryState.users.find(u => u.id === id);
    if (!user) {
      throw new Error(`User not found: ${id}`);
    }
    
    // Convert Partial<User> values appropriately
    Object.assign(user, {
      ...data,
      lastActiveDate: data.lastActiveDate
        ? (data.lastActiveDate instanceof Date ? data.lastActiveDate.toISOString() : (data.lastActiveDate as any as string))
        : user.lastActiveDate,
      lastAiHintDate: data.lastAiHintDate ? data.lastAiHintDate : user.lastAiHintDate,
      abuseLastAt: data.abuseLastAt
        ? (data.abuseLastAt instanceof Date ? data.abuseLastAt.toISOString() : (data.abuseLastAt as any as string))
        : user.abuseLastAt,
      lockedUntil: data.lockedUntil
        ? (data.lockedUntil instanceof Date ? data.lockedUntil.toISOString() : (data.lockedUntil as any as string))
        : user.lockedUntil
    });
    
    return { ...user, password: user.passwordHash } as any as User;
  }

  async deleteUser(id: string): Promise<User> {
    const idx = inMemoryState.users.findIndex(u => u.id === id);
    if (idx === -1) {
      throw new Error(`User not found: ${id}`);
    }
    const [deleted] = inMemoryState.users.splice(idx, 1);
    return { ...deleted, password: deleted.passwordHash } as any as User;
  }

  async findTenantById(id: string): Promise<Tenant | null> {
    const tenant = inMemoryState.tenants.find(t => t.id === id);
    return tenant ? (tenant as any as Tenant) : null;
  }

  async findTenantByCode(code: string): Promise<Tenant | null> {
    const tenant = inMemoryState.tenants.find(t => t.code.toLowerCase() === code.toLowerCase());
    return tenant ? (tenant as any as Tenant) : null;
  }

  async createTenant(data: {
    id: string;
    name: string;
    code: string;
    plan: string;
  }): Promise<Tenant> {
    const newTenant = {
      ...data,
      createdAt: new Date().toISOString()
    };
    inMemoryState.tenants.push(newTenant);
    return newTenant as any as Tenant;
  }

  async findEnrollment(userId: string, role: string): Promise<(ClassEnrollment & { class: any }) | null> {
    const enrollment = inMemoryState.classEnrollments.find(e => e.userId === userId && e.role === role);
    if (!enrollment) return null;
    
    const cls = inMemoryState.classes.find(c => c.id === enrollment.classId);
    return {
      ...enrollment,
      class: cls || null
    } as any;
  }

  async findEnrollmentsByUser(userId: string, role: string): Promise<any[]> {
    const enrollments = inMemoryState.classEnrollments.filter(e => e.userId === userId && e.role === role);
    return enrollments.map(e => {
      const cls = inMemoryState.classes.find(c => c.id === e.classId);
      return {
        ...e,
        class: cls || null
      };
    });
  }

  async findEnrollmentsByClass(classId: string, role: string): Promise<any[]> {
    const enrollments = inMemoryState.classEnrollments.filter(e => e.classId === classId && e.role === role);
    return enrollments.map(e => {
      const u = inMemoryState.users.find(user => user.id === e.userId);
      return {
        ...e,
        user: u || null
      };
    });
  }

  async createEnrollment(data: {
    id: string;
    classId: string;
    userId: string;
    role: string;
  }): Promise<ClassEnrollment> {
    inMemoryState.classEnrollments.push(data);
    return data as any as ClassEnrollment;
  }

  async deleteUserData(userId: string): Promise<void> {
    // GDPR-K compliant cascade — must mirror PrismaUserRepository.deleteUserData
    // including any newly-added user-linked tables. When adding a new table
    // that holds a userId, ALSO add a filter here.
    const userAvatars = inMemoryState.avatars.filter(a => a.userId === userId);
    const avatarIds = userAvatars.map(a => a.id);
    const objectKeys = userAvatars.map(a => a.objectKey);

    // Delete in-memory DB records
    inMemoryState.bossBattleParticipants = inMemoryState.bossBattleParticipants.filter(p => p.userId !== userId);
    inMemoryState.bossApprovalAudits = inMemoryState.bossApprovalAudits.filter(a => a.userId !== userId);
    
    // Phase 16-B: Symmetrical cascade deletes that mirror Prisma's
    // schema-level relations.
    //
    // 1. Avatar → AvatarApprovalAudit is now `onDelete: SetNull` so that
    //    the audit trail survives avatar deletion (see schema.prisma).
    //    Apply the same SetNull to audits referencing user-owned avatars.
    inMemoryState.avatarApprovalAudits.forEach(a => {
      if (a.avatarId && avatarIds.includes(a.avatarId)) {
        a.avatarId = null;
      }
    });
    // 2. Audits where this user was the moderator carry the user's PII
    //    in moderatorId, so RTBF still requires removing those rows.
    inMemoryState.avatarApprovalAudits = inMemoryState.avatarApprovalAudits.filter(
      a => a.moderatorId !== userId
    );
    inMemoryState.avatarQuotas = inMemoryState.avatarQuotas.filter(q => q.userId !== userId);
    inMemoryState.avatars = inMemoryState.avatars.filter(a => a.userId !== userId);

    inMemoryState.parentalCelebrations = inMemoryState.parentalCelebrations.filter(c => c.childId !== userId);
    inMemoryState.attempts = inMemoryState.attempts.filter(a => a.userId !== userId);
    inMemoryState.parentMessages = inMemoryState.parentMessages.filter(m => m.userId !== userId);
    inMemoryState.peerStamps = inMemoryState.peerStamps.filter(s => s.senderId !== userId && s.receiverId !== userId);
    inMemoryState.hiramekiTips = inMemoryState.hiramekiTips.filter(t => t.userId !== userId);
    inMemoryState.classEnrollments = inMemoryState.classEnrollments.filter(e => e.userId !== userId);
    inMemoryState.assignmentProgresses = inMemoryState.assignmentProgresses.filter(p => p.studentId !== userId);
    inMemoryState.safetyAlerts = inMemoryState.safetyAlerts.filter(a => a.childUserId !== userId);
    inMemoryState.parentChildRelations = inMemoryState.parentChildRelations.filter(
      r => r.parentId !== userId && r.childId !== userId
    );
    inMemoryState.users = inMemoryState.users.filter(u => u.id !== userId);

    // Physically delete from StorageService
    await Promise.all(
      objectKeys.map(key => storageService.deleteAvatarImage(key).catch(err => {
        console.error(`Failed to delete in-memory storage file ${key}:`, err);
      }))
    );
  }

  async atomicAbuseStrike(userId: string, opts: {
    windowMs: number;
    lockThreshold: number;
    lockDurationMs: number;
  }): Promise<{ newCount: number; isLocked: boolean; lockedUntil: Date | null; justLocked: boolean }> {
    // Atomic under Node.js because there is NO await between the read of
    // `user` and the writes back into the same object. Other promises
    // cannot interleave a microtask here.
    const user = inMemoryState.users.find(u => u.id === userId);
    if (!user) {
      return { newCount: 0, isLocked: false, lockedUntil: null, justLocked: false };
    }

    const now = new Date();

    // If the user is already locked we do NOT increment again — return the
    // existing lock state so the caller can react but no duplicate work
    // (e.g. another SafetyAlert) is queued.
    if (user.lockedUntil) {
      const existingLockedUntil = new Date(user.lockedUntil);
      if (existingLockedUntil > now) {
        return {
          newCount: user.abuseCount || 0,
          isLocked: true,
          lockedUntil: existingLockedUntil,
          justLocked: false
        };
      }
    }

    const lastAt = user.abuseLastAt ? new Date(user.abuseLastAt) : null;
    const withinWindow = lastAt !== null && now.getTime() - lastAt.getTime() < opts.windowMs;
    const previousCount = withinWindow ? Number(user.abuseCount || 0) : 0;
    const newCount = previousCount + 1;

    if (newCount >= opts.lockThreshold) {
      const lockedUntil = new Date(now.getTime() + opts.lockDurationMs);
      user.abuseCount = 0;
      user.abuseLastAt = now.toISOString();
      user.lockedUntil = lockedUntil.toISOString();
      return { newCount, isLocked: true, lockedUntil, justLocked: true };
    }

    user.abuseCount = newCount;
    user.abuseLastAt = now.toISOString();
    return { newCount, isLocked: false, lockedUntil: null, justLocked: false };
  }

  async findParentMessages(userId: string): Promise<any[]> {
    return inMemoryState.parentMessages
      .filter(m => m.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);
  }

  async createParentMessage(userId: string, message: string): Promise<any> {
    const newMessage = {
      id: 'msg_' + crypto.randomUUID(),
      userId,
      message,
      isRead: false,
      createdAt: new Date().toISOString()
    };
    inMemoryState.parentMessages.push(newMessage);
    return newMessage;
  }

  async markParentMessageAsRead(id: string): Promise<boolean> {
    const msg = inMemoryState.parentMessages.find(m => m.id === id);
    if (msg) {
      msg.isRead = true;
      return true;
    }
    return false;
  }

  async findChildrenByParent(parentId: string): Promise<User[]> {
    const relations = inMemoryState.parentChildRelations.filter(r => r.parentId === parentId);
    const childIds = relations.map(r => r.childId);
    const children = inMemoryState.users.filter(u => childIds.includes(u.id));
    return children.map(u => ({ ...u, password: u.passwordHash } as any as User));
  }

  async findParentsByChild(childId: string): Promise<User[]> {
    const relations = inMemoryState.parentChildRelations.filter(r => r.childId === childId);
    const parentIds = relations.map(r => r.parentId);
    const parents = inMemoryState.users.filter(u => parentIds.includes(u.id));
    return parents.map(u => ({ ...u, password: u.passwordHash } as any as User));
  }

  async createParentChildRelation(parentId: string, childId: string): Promise<any> {
    const exists = inMemoryState.parentChildRelations.some(r => r.parentId === parentId && r.childId === childId);
    if (exists) return { parentId, childId };
    
    const newRelation = {
      id: `pcr_${crypto.randomUUID()}`,
      parentId,
      childId,
      createdAt: new Date().toISOString()
    };
    inMemoryState.parentChildRelations.push(newRelation);
    return newRelation;
  }
}
