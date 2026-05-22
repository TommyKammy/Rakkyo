import { CollaborativeRepository } from '../CollaborativeRepository';
import prisma from '../../db';

export class PrismaCollaborativeRepository implements CollaborativeRepository {
  async findPeerStampsReceived(userId: string): Promise<any[]> {
    const received = await prisma.peerStamp.findMany({
      where: { receiverId: userId },
      include: { sender: true },
      orderBy: { createdAt: 'desc' }
    });
    return received.map(s => ({
      id: s.id,
      senderId: s.senderId,
      sender: {
        nickname: s.sender.nickname
      },
      stampType: s.stampType,
      createdAt: s.createdAt.toISOString()
    }));
  }

  async findPeerStampsSent(userId: string): Promise<any[]> {
    const sent = await prisma.peerStamp.findMany({
      where: { senderId: userId },
      include: { receiver: true },
      orderBy: { createdAt: 'desc' }
    });
    return sent.map(s => ({
      id: s.id,
      receiverId: s.receiverId,
      receiver: {
        nickname: s.receiver.nickname
      },
      stampType: s.stampType,
      createdAt: s.createdAt.toISOString()
    }));
  }

  async createPeerStamp(data: {
    senderId: string;
    receiverId: string;
    stampType: string;
  }): Promise<any> {
    return prisma.peerStamp.create({
      data
    });
  }

  async findClassMissions(classId: string): Promise<any[]> {
    return prisma.classMission.findMany({
      where: { classId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createClassMission(data: {
    id: string;
    classId: string;
    title: string;
    targetMinutes: number;
    currentMinutes: number;
    dueDate: Date;
  }): Promise<any> {
    return prisma.classMission.create({
      data
    });
  }

  async incrementClassMissionMinutes(classId: string, minutes: number): Promise<void> {
    // If a mission exists, increment currentMinutes
    await prisma.classMission.updateMany({
      where: { classId },
      data: {
        currentMinutes: {
          increment: minutes
        }
      }
    });
  }

  async findHiramekiTips(classId: string): Promise<any[]> {
    return prisma.hiramekiTip.findMany({
      where: { classId, isSafe: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createHiramekiTip(data: {
    classId: string;
    userId: string;
    nickname: string;
    content: string;
    isSafe: boolean;
  }): Promise<any> {
    return prisma.hiramekiTip.create({
      data
    });
  }

  async createParentalCelebration(data: {
    childId: string;
    attemptId: string;
    token: string;
    isResponded: boolean;
    expiresAt: Date;
  }): Promise<any> {
    return prisma.parentalCelebration.create({
      data
    });
  }

  async findParentalCelebrationByToken(token: string): Promise<any | null> {
    return prisma.parentalCelebration.findUnique({
      where: { token },
      include: {
        child: true,
        attempt: {
          include: {
            question: true
          }
        }
      }
    });
  }

  async updateParentalCelebration(token: string, data: {
    parentStamp: string;
    parentComment: string | null;
    isResponded: boolean;
  }): Promise<any> {
    return prisma.parentalCelebration.update({
      where: { token },
      data
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

  async findParentMessages(userId: string): Promise<any[]> {
    return prisma.parentMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async markParentMessagesAsRead(userId: string): Promise<void> {
    await prisma.parentMessage.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true }
    });
  }

  async createAssignment(data: {
    tenantId: string;
    classId: string;
    title: string;
    lessonId: string;
    dueDate: Date;
  }): Promise<any> {
    return prisma.assignment.create({
      data
    });
  }

  async findAssignmentsByClass(classId: string): Promise<any[]> {
    return prisma.assignment.findMany({
      where: { classId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createAssignmentProgressMany(progresses: {
    assignmentId: string;
    studentId: string;
    isCompleted: boolean;
  }[]): Promise<void> {
    await prisma.studentAssignmentProgress.createMany({
      data: progresses
    });
  }

  async findAssignmentProgresses(assignmentId: string): Promise<any[]> {
    return prisma.studentAssignmentProgress.findMany({
      where: { assignmentId }
    });
  }

  async createSafetyAlert(data: {
    childUserId: string;
    alertType: string;
    payload: string;
  }): Promise<any> {
    return (prisma as any).safetyAlert.create({
      data: {
        childUserId: data.childUserId,
        alertType: data.alertType,
        payload: data.payload,
        status: 'QUEUED'
      }
    });
  }

  async findSafetyAlertsByChild(childUserId: string): Promise<any[]> {
    return (prisma as any).safetyAlert.findMany({
      where: { childUserId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findActiveBossBattle(classId: string): Promise<any | null> {
    const now = new Date();
    return prisma.bossBattle.findFirst({
      where: {
        classId,
        startsAt: { lte: now },
        endsAt: { gte: now }
      },
      include: { boss: true }
    });
  }

  async createBossBattle(data: { classId: string; bossId: string; startsAt: Date; endsAt: Date }): Promise<any> {
    const boss = await prisma.boss.findUnique({
      where: { id: data.bossId }
    });
    if (!boss) throw new Error('Boss not found');

    return prisma.bossBattle.create({
      data: {
        classId: data.classId,
        bossId: data.bossId,
        currentHp: boss.maxHp,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        isAlive: true
      },
      include: { boss: true }
    });
  }

  async applyBossDamage(
    userId: string,
    battleId: string,
    damage: number,
    isGrit: boolean
  ): Promise<{ battle: any; justDefeated: boolean }> {
    // Atomic damage application without read-then-write of currentHp:
    // 1. `updateMany` decrement only matches if the battle is still alive,
    //    so a defeated battle cannot absorb additional damage.
    // 2. The "I defeated it" claim uses `updateMany` with `defeatedAt: null`
    //    in the WHERE clause, so exactly one concurrent transaction can
    //    win the defeat — no lost-update / no double notification.
    // No retry loop is needed because we never read-then-write the same
    // field; the conditional `updateMany` is naturally race-safe.
    return prisma.$transaction(async tx => {
      // Step 1: atomic decrement (only if still alive)
      const decremented = await tx.bossBattle.updateMany({
        where: { id: battleId, isAlive: true },
        data: { currentHp: { decrement: damage } }
      });

      let justDefeated = false;
      if (decremented.count === 1) {
        // Read the new HP to decide if this attack toppled the boss.
        const afterAttack = await tx.bossBattle.findUnique({ where: { id: battleId } });
        if (afterAttack && afterAttack.currentHp <= 0) {
          // Single-writer defeat claim — only one tx wins.
          const claim = await tx.bossBattle.updateMany({
            where: { id: battleId, defeatedAt: null },
            data: { defeatedAt: new Date(), isAlive: false, currentHp: 0 }
          });
          if (claim.count === 1) {
            justDefeated = true;
          }
        }
      }

      // Always record participant contribution, even after defeat,
      // so late attacks still see their effort logged.
      await tx.bossBattleParticipant.upsert({
        where: { userId_battleId: { userId, battleId } },
        create: {
          userId,
          battleId,
          totalDamage: damage,
          gritAttemptsCount: isGrit ? 1 : 0
        },
        update: {
          totalDamage: { increment: damage },
          gritAttemptsCount: { increment: isGrit ? 1 : 0 }
        }
      });

      const battle = await tx.bossBattle.findUnique({
        where: { id: battleId },
        include: { boss: true }
      });
      return { battle, justDefeated };
    });
  }

  async sumBossBattleDamage(battleId: string): Promise<number> {
    const result = await prisma.bossBattleParticipant.aggregate({
      where: { battleId },
      _sum: { totalDamage: true }
    });
    return result._sum.totalDamage || 0;
  }

  async findParticipant(userId: string, battleId: string): Promise<any | null> {
    return prisma.bossBattleParticipant.findUnique({
      where: {
        userId_battleId: { userId, battleId }
      }
    });
  }

  async upsertCelebrationSeen(userId: string, battleId: string): Promise<any> {
    return prisma.bossBattleParticipant.upsert({
      where: { userId_battleId: { userId, battleId } },
      create: {
        userId,
        battleId,
        totalDamage: 0,
        gritAttemptsCount: 0,
        celebrationSeenAt: new Date()
      },
      update: {
        celebrationSeenAt: new Date()
      }
    });
  }

  async findQuestionPool(classId: string): Promise<any | null> {
    return prisma.bossQuestionPool.findUnique({
      where: { classId }
    });
  }

  async claimQuestionPoolSlot(classId: string, windowMs: number): Promise<{ granted: boolean }> {
    // Single-writer claim. The atomicity comes from the `BossQuestionPool.classId`
    // unique constraint: only one INSERT or matching UPDATE wins per window.
    const cutoff = new Date(Date.now() - windowMs);
    return prisma.$transaction(async tx => {
      const existing = await tx.bossQuestionPool.findUnique({ where: { classId } });
      if (existing) {
        if (existing.lastGeneratedAt > cutoff) {
          return { granted: false };
        }
        const updated = await tx.bossQuestionPool.updateMany({
          where: { classId, lastGeneratedAt: { lt: cutoff } },
          data: { lastGeneratedAt: new Date() }
        });
        return { granted: updated.count === 1 };
      }
      try {
        await tx.bossQuestionPool.create({
          data: { classId, questionsJson: '[]', lastGeneratedAt: new Date() }
        });
        return { granted: true };
      } catch {
        // Another tx beat us to the unique-constraint insert.
        return { granted: false };
      }
    }, { isolationLevel: 'Serializable' });
  }

  async updateQuestionPoolContent(classId: string, questionsJson: string): Promise<any> {
    return prisma.bossQuestionPool.update({
      where: { classId },
      data: { questionsJson }
    });
  }

  async releaseQuestionPoolSlot(classId: string): Promise<void> {
    // Roll back to a "far past" timestamp so a retry is allowed.
    await prisma.bossQuestionPool.updateMany({
      where: { classId },
      data: { lastGeneratedAt: new Date(0) }
    });
  }

  async findClassTenantId(classId: string): Promise<string | null> {
    const cls = await prisma.class.findUnique({
      where: { id: classId },
      select: { tenantId: true }
    });
    return cls?.tenantId ?? null;
  }

  async awardBossDefeatBadge(userId: string): Promise<void> {
    // Ensure the Badge row exists, then idempotently link to user.
    const badge = await prisma.badge.upsert({
      where: { id: 'boss_defeat_badge' },
      create: {
        id: 'boss_defeat_badge',
        name: '魔王撃破の証',
        iconUrl: '🏆',
        conditionType: 'BOSS_DEFEAT',
        threshold: 1
      },
      update: {}
    });
    try {
      await prisma.userBadge.create({
        data: { userId, badgeId: badge.id }
      });
    } catch {
      // Composite PK violation = badge already awarded. Silently ignore.
    }
  }

  async createApprovalAudit(data: {
    userId: string;
    tenantId: string;
    action: string;
    targetId: string;
    details: string;
  }): Promise<any> {
    return prisma.bossApprovalAudit.create({
      data
    });
  }
}
