import { UserRepository } from '../UserRepository';
import { User, Tenant, ClassEnrollment } from '@prisma/client';
import { inMemoryState } from './state';

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
    // 忘れられる権利 Cascade 削除 (旧 deleteUserData の移植)
    inMemoryState.parentalCelebrations = inMemoryState.parentalCelebrations.filter(c => c.childId !== userId);
    inMemoryState.attempts = inMemoryState.attempts.filter(a => a.userId !== userId);
    inMemoryState.parentMessages = inMemoryState.parentMessages.filter(m => m.userId !== userId);
    inMemoryState.peerStamps = inMemoryState.peerStamps.filter(s => s.senderId !== userId && s.receiverId !== userId);
    inMemoryState.hiramekiTips = inMemoryState.hiramekiTips.filter(t => t.userId !== userId);
    inMemoryState.classEnrollments = inMemoryState.classEnrollments.filter(e => e.userId !== userId);
    inMemoryState.assignmentProgresses = inMemoryState.assignmentProgresses.filter(p => p.studentId !== userId);
    inMemoryState.users = inMemoryState.users.filter(u => u.id !== userId);
  }

  async findParentMessages(userId: string): Promise<any[]> {
    return inMemoryState.parentMessages
      .filter(m => m.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);
  }

  async createParentMessage(userId: string, message: string): Promise<any> {
    const newMessage = {
      id: 'msg_' + Math.random().toString(36).substr(2, 9),
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
}
