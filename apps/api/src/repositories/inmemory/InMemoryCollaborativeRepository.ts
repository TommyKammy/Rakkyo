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
      id: 'stamp_' + Math.random().toString(36).substr(2, 9),
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
      id: 'tip_' + Math.random().toString(36).substr(2, 9),
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
      id: 'celeb_' + Math.random().toString(36).substr(2, 9),
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
      id: 'msg_' + Math.random().toString(36).substr(2, 9),
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
      id: 'assignment_' + Math.random().toString(36).substr(2, 9),
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
        id: 'progress_' + Math.random().toString(36).substr(2, 9),
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
      id: 'alert_' + Math.random().toString(36).slice(2, 11),
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
      id: 'battle_' + Math.random().toString(36).substr(2, 9),
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
    const battle = inMemoryState.bossBattles.find(b => b.id === battleId);
    if (!battle) throw new Error('Battle not found');

    let justDefeated = false;
    if (battle.isAlive) {
      battle.currentHp = Math.max(0, battle.currentHp - damage);
      if (battle.currentHp === 0) {
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

  async findParticipant(userId: string, battleId: string): Promise<any | null> {
    return inMemoryState.bossBattleParticipants.find(
      p => p.userId === userId && p.battleId === battleId
    ) || null;
  }

  async updateCelebrationSeen(userId: string, battleId: string): Promise<void> {
    const participant = inMemoryState.bossBattleParticipants.find(
      p => p.userId === userId && p.battleId === battleId
    );
    if (participant) {
      participant.celebrationSeenAt = new Date().toISOString();
    }
  }

  async findQuestionPool(classId: string): Promise<any | null> {
    return inMemoryState.bossQuestionPools.find(p => p.classId === classId) || null;
  }

  async upsertQuestionPool(classId: string, questionsJson: string): Promise<any> {
    let pool = inMemoryState.bossQuestionPools.find(p => p.classId === classId);
    if (!pool) {
      pool = {
        id: 'pool_' + Math.random().toString(36).substr(2, 9),
        classId,
        questionsJson,
        lastGeneratedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };
      inMemoryState.bossQuestionPools.push(pool);
    } else {
      pool.questionsJson = questionsJson;
      pool.lastGeneratedAt = new Date().toISOString();
    }
    return pool;
  }

  async createApprovalAudit(data: {
    userId: string;
    tenantId: string;
    action: string;
    targetId: string;
    details: string;
  }): Promise<any> {
    const audit = {
      id: 'audit_' + Math.random().toString(36).substr(2, 9),
      ...data,
      createdAt: new Date().toISOString()
    };
    inMemoryState.bossApprovalAudits.push(audit);
    return audit;
  }
}
