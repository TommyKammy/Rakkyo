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
  /** Sum of all participants' totalDamage for the battle. */
  sumBossBattleDamage(battleId: string): Promise<number>;
  findParticipant(userId: string, battleId: string): Promise<any | null>;
  /**
   * Mark celebration as seen — even for a student who never landed an
   * attack (they joined the room after the boss was already defeated).
   * Returns the resulting participant row.
   */
  upsertCelebrationSeen(userId: string, battleId: string): Promise<any>;
  findQuestionPool(classId: string): Promise<any | null>;
  /**
   * Atomic single-writer claim on the weekly generation slot.
   * Returns granted=true exactly once per window, even under concurrent
   * teacher requests.
   */
  claimQuestionPoolSlot(classId: string, windowMs: number): Promise<{ granted: boolean }>;
  /** Replace the cached questions on a previously-claimed slot. */
  updateQuestionPoolContent(classId: string, questionsJson: string): Promise<any>;
  /** Roll back a claimed slot when downstream (e.g. Gemini) failed. */
  releaseQuestionPoolSlot(classId: string): Promise<void>;
  findClassTenantId(classId: string): Promise<string | null>;
  /** Idempotent badge award for boss defeat — works on both Prisma and InMemory backends. */
  awardBossDefeatBadge(userId: string): Promise<void>;
  createApprovalAudit(data: {
    userId: string;
    tenantId: string;
    action: string;
    targetId: string;
    details: string;
  }): Promise<any>;
}
