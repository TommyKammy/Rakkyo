import crypto from 'crypto';
import { CollaborativeRepository } from '../CollaborativeRepository';
import { inMemoryState } from './state';
import { allCurriculums } from '@rakkyo/curriculum';

export class InMemoryCollaborativeRepository implements CollaborativeRepository {
  async findPeerStampsReceived(userId: string): Promise<any[]> {
    return inMemoryState.peerStamps
      .filter(s => s.receiverId === userId)
      .map(s => {
        const sender = inMemoryState.users.find(u => u.id === s.senderId);
        return {
          id: s.id,
          senderId: s.senderId,
          sender: {
            nickname: sender ? sender.nickname : 'ともだち'
          },
          stampType: s.stampType,
          createdAt: s.createdAt
        };
      });
  }

  async findPeerStampsSent(userId: string): Promise<any[]> {
    return inMemoryState.peerStamps
      .filter(s => s.senderId === userId)
      .map(s => {
        const receiver = inMemoryState.users.find(u => u.id === s.receiverId);
        return {
          id: s.id,
          receiverId: s.receiverId,
          receiver: {
            nickname: receiver ? receiver.nickname : 'ともだち'
          },
          stampType: s.stampType,
          createdAt: s.createdAt
        };
      });
  }

  async createPeerStamp(data: {
    senderId: string;
    receiverId: string;
    stampType: string;
  }): Promise<any> {
    const newStamp = {
      ...data,
      id: 'stamp_' + crypto.randomUUID(),
      createdAt: new Date().toISOString()
    };
    inMemoryState.peerStamps.push(newStamp);
    return newStamp;
  }

  async findClassMissions(classId: string): Promise<any[]> {
    return inMemoryState.classMissions.filter(m => m.classId === classId);
  }

  async createClassMission(data: {
    id: string;
    classId: string;
    title: string;
    targetMinutes: number;
    currentMinutes: number;
    dueDate: Date;
  }): Promise<any> {
    const newMission = {
      ...data,
      dueDate: data.dueDate.toISOString(),
      createdAt: new Date().toISOString()
    };
    inMemoryState.classMissions.push(newMission);
    return newMission;
  }

  async incrementClassMissionMinutes(classId: string, minutes: number): Promise<void> {
    const missions = inMemoryState.classMissions.filter(m => m.classId === classId);
    missions.forEach(m => {
      m.currentMinutes += minutes;
    });
  }

  async findHiramekiTips(classId: string): Promise<any[]> {
    return inMemoryState.hiramekiTips
      .filter(t => t.classId === classId && t.isSafe)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createHiramekiTip(data: {
    classId: string;
    userId: string;
    nickname: string;
    content: string;
    isSafe: boolean;
  }): Promise<any> {
    const newTip = {
      ...data,
      id: 'tip_' + crypto.randomUUID(),
      createdAt: new Date().toISOString()
    };
    inMemoryState.hiramekiTips.push(newTip);
    return newTip;
  }

  async createParentalCelebration(data: {
    childId: string;
    attemptId: string;
    token: string;
    isResponded: boolean;
    expiresAt: Date;
  }): Promise<any> {
    const celebration = {
      ...data,
      id: 'celeb_' + crypto.randomUUID(),
      expiresAt: data.expiresAt.toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      parentStamp: null,
      parentComment: null
    };
    inMemoryState.parentalCelebrations.push(celebration);
    return celebration;
  }

  async findParentalCelebrationByToken(token: string): Promise<any | null> {
    const celeb = inMemoryState.parentalCelebrations.find(c => c.token === token);
    if (!celeb) return null;

    const child = inMemoryState.users.find(u => u.id === celeb.childId);
    const attempt = inMemoryState.attempts.find(a => a.id === celeb.attemptId);
    let attemptWithQuestion = null;
    if (attempt) {
      let question = inMemoryState.dynamicQuestions.find(q => q.id === attempt.questionId);
      if (!question) {
        for (const curriculum of allCurriculums) {
          for (const unit of curriculum.units) {
            for (const lesson of unit.lessons) {
              const q = lesson.questions.find(quest => quest.id === attempt.questionId || quest.prompt === attempt.questionId);
              if (q) {
                question = q;
                break;
              }
            }
            if (question) break;
          }
          if (question) break;
        }
      }
      attemptWithQuestion = {
        ...attempt,
        question
      };
    }

    return {
      ...celeb,
      child: child ? { nickname: child.nickname } : null,
      attempt: attemptWithQuestion
    };
  }

  async updateParentalCelebration(token: string, data: {
    parentStamp: string;
    parentComment: string | null;
    isResponded: boolean;
  }): Promise<any> {
    const celeb = inMemoryState.parentalCelebrations.find(c => c.token === token);
    if (celeb) {
      Object.assign(celeb, {
        ...data,
        updatedAt: new Date().toISOString()
      });
    }
    return celeb;
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

  async findParentMessages(userId: string): Promise<any[]> {
    return inMemoryState.parentMessages.filter(m => m.userId === userId);
  }

  async markParentMessagesAsRead(userId: string): Promise<void> {
    inMemoryState.parentMessages
      .filter(m => m.userId === userId)
      .forEach(m => {
        m.isRead = true;
      });
  }

  async createAssignment(data: {
    tenantId: string;
    classId: string;
    title: string;
    lessonId: string;
    dueDate: Date;
  }): Promise<any> {
    const newAssignment = {
      ...data,
      id: 'assignment_' + crypto.randomUUID(),
      dueDate: data.dueDate.toISOString(),
      createdAt: new Date().toISOString()
    };
    inMemoryState.assignments.push(newAssignment);
    return newAssignment;
  }

  async findAssignmentsByClass(classId: string): Promise<any[]> {
    return inMemoryState.assignments
      .filter(a => a.classId === classId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createAssignmentProgressMany(progresses: {
    assignmentId: string;
    studentId: string;
    isCompleted: boolean;
  }[]): Promise<void> {
    progresses.forEach(p => {
      inMemoryState.assignmentProgresses.push({
        ...p,
        id: 'progress_' + crypto.randomUUID(),
        completedAt: null
      });
    });
  }

  async findAssignmentProgresses(assignmentId: string): Promise<any[]> {
    return inMemoryState.assignmentProgresses.filter(p => p.assignmentId === assignmentId);
  }

  async createSafetyAlert(data: {
    childUserId: string;
    alertType: string;
    payload: string;
  }): Promise<any> {
    const alert = {
      ...data,
      id: 'alert_' + crypto.randomUUID(),
      status: 'QUEUED' as const,
      createdAt: new Date().toISOString(),
      sentAt: null
    };
    inMemoryState.safetyAlerts.push(alert);
    return alert;
  }

  async findSafetyAlertsByChild(childUserId: string): Promise<any[]> {
    return inMemoryState.safetyAlerts
      .filter(a => a.childUserId === childUserId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async findActiveBossBattle(classId: string): Promise<any | null> {
    const now = new Date();
    const battle = inMemoryState.bossBattles.find(
      b => b.classId === classId && new Date(b.startsAt) <= now && now <= new Date(b.endsAt)
    );
    if (!battle) return null;

    const boss = inMemoryState.bosses.find(b => b.id === battle.bossId);
    return {
      ...battle,
      boss: boss || null
    };
  }

  async createBossBattle(data: { classId: string; bossId: string; startsAt: Date; endsAt: Date }): Promise<any> {
    const boss = inMemoryState.bosses.find(b => b.id === data.bossId);
    if (!boss) throw new Error('Boss not found');
    const battle = {
      id: 'battle_' + crypto.randomUUID(),
      classId: data.classId,
      bossId: data.bossId,
      currentHp: boss.maxHp,
      startsAt: data.startsAt.toISOString(),
      endsAt: data.endsAt.toISOString(),
      defeatedAt: null,
      isAlive: true,
      createdAt: new Date().toISOString()
    };
    inMemoryState.bossBattles.push(battle);
    return battle;
  }

  async applyBossDamage(
    userId: string,
    battleId: string,
    damage: number,
    isGrit: boolean
  ): Promise<{ battle: any; justDefeated: boolean }> {
    // Atomic under Node.js single-thread: no `await` between read and write.
    // Mirrors the Prisma implementation's "decrement only if alive" +
    // "claim defeat only if defeatedAt was null" semantics so both
    // backends behave identically under contention.
    const battle = inMemoryState.bossBattles.find(b => b.id === battleId);
    if (!battle) throw new Error('Battle not found');

    let justDefeated = false;
    if (battle.isAlive) {
      battle.currentHp = Math.max(0, battle.currentHp - damage);
      if (battle.currentHp === 0 && battle.defeatedAt === null) {
        battle.isAlive = false;
        battle.defeatedAt = new Date().toISOString();
        justDefeated = true;
      }
    }

    let participant = inMemoryState.bossBattleParticipants.find(
      p => p.userId === userId && p.battleId === battleId
    );
    if (!participant) {
      participant = {
        userId,
        battleId,
        totalDamage: 0,
        gritAttemptsCount: 0,
        celebrationSeenAt: null,
        createdAt: new Date().toISOString()
      };
      inMemoryState.bossBattleParticipants.push(participant);
    }

    participant.totalDamage += damage;
    if (isGrit) {
      participant.gritAttemptsCount += 1;
    }

    const boss = inMemoryState.bosses.find(b => b.id === battle.bossId);
    return {
      battle: {
        ...battle,
        boss: boss || null
      },
      justDefeated
    };
  }

  async sumBossBattleDamage(battleId: string): Promise<number> {
    return inMemoryState.bossBattleParticipants
      .filter(p => p.battleId === battleId)
      .reduce((sum, p) => sum + p.totalDamage, 0);
  }

  async findParticipant(userId: string, battleId: string): Promise<any | null> {
    return inMemoryState.bossBattleParticipants.find(
      p => p.userId === userId && p.battleId === battleId
    ) || null;
  }

  async upsertCelebrationSeen(userId: string, battleId: string): Promise<any> {
    let participant = inMemoryState.bossBattleParticipants.find(
      p => p.userId === userId && p.battleId === battleId
    );
    const now = new Date().toISOString();
    if (!participant) {
      participant = {
        userId,
        battleId,
        totalDamage: 0,
        gritAttemptsCount: 0,
        celebrationSeenAt: now,
        createdAt: now
      };
      inMemoryState.bossBattleParticipants.push(participant);
    } else {
      participant.celebrationSeenAt = now;
    }
    return participant;
  }

  async findQuestionPool(classId: string): Promise<any | null> {
    return inMemoryState.bossQuestionPools.find(p => p.classId === classId) || null;
  }

  async claimQuestionPoolSlot(classId: string, windowMs: number): Promise<{ granted: boolean }> {
    // Sync block — atomic under Node.js single-thread. No awaits between
    // the existence check and the slot mutation, so concurrent calls
    // cannot both observe "no recent generation".
    const now = new Date();
    const cutoff = now.getTime() - windowMs;
    const existing = inMemoryState.bossQuestionPools.find(p => p.classId === classId);
    if (existing) {
      if (new Date(existing.lastGeneratedAt).getTime() > cutoff) {
        return { granted: false };
      }
      existing.lastGeneratedAt = now.toISOString();
      return { granted: true };
    }
    inMemoryState.bossQuestionPools.push({
      id: 'pool_' + crypto.randomUUID(),
      classId,
      questionsJson: '[]',
      lastGeneratedAt: now.toISOString(),
      createdAt: now.toISOString()
    });
    return { granted: true };
  }

  async updateQuestionPoolContent(classId: string, questionsJson: string): Promise<any> {
    const pool = inMemoryState.bossQuestionPools.find(p => p.classId === classId);
    if (!pool) throw new Error('Question pool not found — call claimQuestionPoolSlot first');
    pool.questionsJson = questionsJson;
    return pool;
  }

  async releaseQuestionPoolSlot(classId: string): Promise<void> {
    const pool = inMemoryState.bossQuestionPools.find(p => p.classId === classId);
    if (pool) {
      pool.lastGeneratedAt = new Date(0).toISOString();
    }
  }

  async findClassTenantId(classId: string): Promise<string | null> {
    const cls = inMemoryState.classes.find(c => c.id === classId);
    return cls ? cls.tenantId : null;
  }

  async awardBossDefeatBadge(userId: string): Promise<void> {
    const user = inMemoryState.users.find(u => u.id === userId);
    if (!user) return;
    // Store the canonical (emoji-stripped) badge name; getUserBadges
    // re-attaches the icon. Idempotent: skip if already present.
    const cleanName = '魔王撃破の証';
    if (!user.badges.includes(cleanName)) {
      user.badges.push(cleanName);
    }
  }

  async createApprovalAudit(data: {
    userId: string;
    tenantId: string;
    action: string;
    targetId: string;
    details: string;
  }): Promise<any> {
    const audit = {
      id: 'audit_' + crypto.randomUUID(),
      ...data,
      createdAt: new Date().toISOString()
    };
    inMemoryState.bossApprovalAudits.push(audit);
    return audit;
  }
}
