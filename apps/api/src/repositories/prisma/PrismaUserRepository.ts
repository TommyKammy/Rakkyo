import { UserRepository } from '../UserRepository';
import { User, Tenant, ClassEnrollment } from '@prisma/client';
import prisma from '../../db';

export class PrismaUserRepository implements UserRepository {
  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id }
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findFirst({
      where: { email }
    });
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
    const { passwordHash, role, ...rest } = data;
    return prisma.user.create({
      data: {
        ...rest,
        password: passwordHash,
        role: role as any,
        currentXp: 0,
        level: 1,
        streakCount: 0,
        lastActiveDate: null
      }
    });
  }

  async updateUser(id: string, data: Partial<User>): Promise<User> {
    return prisma.user.update({
      where: { id },
      data
    });
  }

  async deleteUser(id: string): Promise<User> {
    return prisma.user.delete({
      where: { id }
    });
  }

  async findTenantById(id: string): Promise<Tenant | null> {
    return prisma.tenant.findUnique({
      where: { id }
    });
  }

  async findTenantByCode(code: string): Promise<Tenant | null> {
    return prisma.tenant.findUnique({
      where: { code }
    });
  }

  async createTenant(data: {
    id: string;
    name: string;
    code: string;
    plan: string;
  }): Promise<Tenant> {
    return prisma.tenant.create({
      data
    });
  }

  async findEnrollment(userId: string, role: string): Promise<(ClassEnrollment & { class: any }) | null> {
    const enrollment = await prisma.classEnrollment.findFirst({
      where: { userId, role: role as any },
      include: { class: true }
    });
    return enrollment as any;
  }

  async findEnrollmentsByUser(userId: string, role: string): Promise<any[]> {
    return prisma.classEnrollment.findMany({
      where: { userId, role: role as any },
      include: { class: true }
    });
  }

  async findEnrollmentsByClass(classId: string, role: string): Promise<any[]> {
    return prisma.classEnrollment.findMany({
      where: { classId, role: role as any },
      include: { user: true }
    });
  }

  async createEnrollment(data: {
    id: string;
    classId: string;
    userId: string;
    role: string;
  }): Promise<ClassEnrollment> {
    const { role, ...rest } = data;
    return prisma.classEnrollment.create({
      data: {
        ...rest,
        role: role as any
      }
    });
  }

  async deleteUserData(userId: string): Promise<void> {
    // 忘れられる権利のトランザクション削除 (旧 users.ts の移植)
    await prisma.$transaction(async (tx) => {
      // 1. onDelete: Cascade がない、あるいは不整合を防ぐため手動削除
      await tx.parentalCelebration.deleteMany({
        where: { childId: userId }
      });
      await tx.peerStamp.deleteMany({
        where: { OR: [{ senderId: userId }, { receiverId: userId }] }
      });
      await tx.hiramekiTip.deleteMany({
        where: { userId }
      });
      await tx.classEnrollment.deleteMany({
        where: { userId }
      });
      await tx.studentAssignmentProgress.deleteMany({
        where: { studentId: userId }
      });
      await tx.parentMessage.deleteMany({
        where: { userId }
      });
      await tx.userBadge.deleteMany({
        where: { userId }
      });
      await tx.attempt.deleteMany({
        where: { userId }
      });
      // 2. ユーザー本体を削除（Prismaスキーマ上の cascade 削除が走る）
      await tx.user.delete({
        where: { id: userId }
      });
    });
  }

  async atomicAbuseStrike(userId: string, opts: {
    windowMs: number;
    lockThreshold: number;
    lockDurationMs: number;
  }): Promise<{ newCount: number; isLocked: boolean; lockedUntil: Date | null; justLocked: boolean }> {
    // Serializable isolation forces Postgres to detect concurrent
    // read-modify-write conflicts on the same User row and abort one of
    // the racing transactions, which Prisma surfaces as P2034. The caller
    // can choose to retry; for now we just propagate.
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) {
        return { newCount: 0, isLocked: false, lockedUntil: null, justLocked: false };
      }

      const now = new Date();

      if (user.lockedUntil && user.lockedUntil > now) {
        return {
          newCount: user.abuseCount || 0,
          isLocked: true,
          lockedUntil: user.lockedUntil,
          justLocked: false
        };
      }

      const lastAt = user.abuseLastAt;
      const withinWindow = lastAt !== null && now.getTime() - lastAt.getTime() < opts.windowMs;
      const previousCount = withinWindow ? Number(user.abuseCount || 0) : 0;
      const newCount = previousCount + 1;

      if (newCount >= opts.lockThreshold) {
        const lockedUntil = new Date(now.getTime() + opts.lockDurationMs);
        await tx.user.update({
          where: { id: userId },
          data: { abuseCount: 0, abuseLastAt: now, lockedUntil }
        });
        return { newCount, isLocked: true, lockedUntil, justLocked: true };
      }

      await tx.user.update({
        where: { id: userId },
        data: { abuseCount: newCount, abuseLastAt: now }
      });
      return { newCount, isLocked: false, lockedUntil: null, justLocked: false };
    }, { isolationLevel: 'Serializable' });
  }

  async findParentMessages(userId: string): Promise<any[]> {
    return prisma.parentMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
  }

  async createParentMessage(userId: string, message: string): Promise<any> {
    return prisma.parentMessage.create({
      data: {
        userId,
        message,
        isRead: false
      }
    });
  }

  async markParentMessageAsRead(id: string): Promise<boolean> {
    try {
      await prisma.parentMessage.update({
        where: { id },
        data: { isRead: true }
      });
      return true;
    } catch (e) {
      return false;
    }
  }
}
