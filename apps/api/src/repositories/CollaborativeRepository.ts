export interface CollaborativeRepository {
  findPeerStampsReceived(userId: string): Promise<any[]>;
  findPeerStampsSent(userId: string): Promise<any[]>;
  createPeerStamp(data: {
    senderId: string;
    receiverId: string;
    stampType: string;
  }): Promise<any>;
  findClassMissions(classId: string): Promise<any[]>;
  createClassMission(data: {
    id: string;
    classId: string;
    title: string;
    targetMinutes: number;
    currentMinutes: number;
    dueDate: Date;
  }): Promise<any>;
  incrementClassMissionMinutes(classId: string, minutes: number): Promise<void>;
  findHiramekiTips(classId: string): Promise<any[]>;
  createHiramekiTip(data: {
    classId: string;
    userId: string;
    nickname: string;
    content: string;
    isSafe: boolean;
  }): Promise<any>;
  createParentalCelebration(data: {
    childId: string;
    attemptId: string;
    token: string;
    isResponded: boolean;
    expiresAt: Date;
  }): Promise<any>;
  findParentalCelebrationByToken(token: string): Promise<any | null>;
  updateParentalCelebration(token: string, data: {
    parentStamp: string;
    parentComment: string | null;
    isResponded: boolean;
  }): Promise<any>;
  createParentMessage(userId: string, message: string): Promise<any>;
  findParentMessages(userId: string): Promise<any[]>;
  markParentMessagesAsRead(userId: string): Promise<void>;
  createAssignment(data: {
    tenantId: string;
    classId: string;
    title: string;
    lessonId: string;
    dueDate: Date;
  }): Promise<any>;
  findAssignmentsByClass(classId: string): Promise<any[]>;
  createAssignmentProgressMany(progresses: {
    assignmentId: string;
    studentId: string;
    isCompleted: boolean;
  }[]): Promise<void>;
  findAssignmentProgresses(assignmentId: string): Promise<any[]>;
  // Phase-15.5: out-of-band safety notification queue
  createSafetyAlert(data: {
    childUserId: string;
    alertType: string;
    payload: string;
  }): Promise<any>;
  findSafetyAlertsByChild(childUserId: string): Promise<any[]>;

  // Phase-16-A: Boss Battle support
  findActiveBossBattle(classId: string): Promise<any | null>;
  createBossBattle(data: { classId: string; bossId: string; startsAt: Date; endsAt: Date }): Promise<any>;
  applyBossDamage(
    userId: string,
    battleId: string,
    damage: number,
    isGrit: boolean
  ): Promise<{ battle: any; justDefeated: boolean }>;
  findParticipant(userId: string, battleId: string): Promise<any | null>;
  updateCelebrationSeen(userId: string, battleId: string): Promise<void>;
  findQuestionPool(classId: string): Promise<any | null>;
  upsertQuestionPool(classId: string, questionsJson: string): Promise<any>;
  createApprovalAudit(data: {
    userId: string;
    tenantId: string;
    action: string;
    targetId: string;
    details: string;
  }): Promise<any>;
}
