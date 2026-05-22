export interface TenantMock {
  id: string;
  name: string;
  code: string;
  plan: string;
  createdAt: string;
}

export interface UserMock {
  id: string;
  tenantId: string;
  email: string;
  passwordHash: string;
  nickname: string;
  role: 'SYSTEM_ADMIN' | 'TENANT_ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT';
  schoolYear: number;
  currentXp: number;
  level: number;
  streakCount: number;
  lastActiveDate: string | null;
  parentalConsent: boolean;
  aiHintCountToday: number;
  lastAiHintDate: string | null;
  badges: string[];
  createdAt: string;
}

export interface ClassMock {
  id: string;
  tenantId: string;
  name: string;
  grade: number;
}

export interface ClassEnrollmentMock {
  id: string;
  classId: string;
  userId: string;
  role: 'TEACHER' | 'STUDENT';
}

export interface AssignmentMock {
  id: string;
  tenantId: string;
  classId: string;
  title: string;
  lessonId: string;
  dueDate: string;
  createdAt: string;
}

export interface StudentAssignmentProgressMock {
  id: string;
  assignmentId: string;
  studentId: string;
  isCompleted: boolean;
  completedAt: string | null;
}

export interface AttemptMock {
  id: string;
  userId: string;
  questionId: string;
  isCorrect: boolean;
  hintsUsed: number;
  answerSubmitted: string;
  durationSeconds?: number | null;
  createdAt: string;
  errorType?: string | null;
  aiDiagnosis?: string | null;
}

export interface ParentMessageMock {
  id: string;
  userId: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface PeerStampMock {
  id: string;
  senderId: string;
  receiverId: string;
  stampType: string;
  createdAt: string;
}

export interface HiramekiTipMock {
  id: string;
  classId: string;
  userId: string;
  nickname: string;
  content: string;
  isSafe: boolean;
  createdAt: string;
}

export interface ClassMissionMock {
  id: string;
  classId: string;
  title: string;
  targetMinutes: number;
  currentMinutes: number;
  dueDate: string;
  createdAt: string;
}

export interface ParentalCelebrationMock {
  id: string;
  childId: string;
  attemptId: string;
  token: string;
  parentStamp: string | null;
  parentComment: string | null;
  isResponded: boolean;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

class MockDatabase {
  tenants: TenantMock[] = [];
  users: UserMock[] = [];
  classes: ClassMock[] = [];
  classEnrollments: ClassEnrollmentMock[] = [];
  assignments: AssignmentMock[] = [];
  assignmentProgresses: StudentAssignmentProgressMock[] = [];
  attempts: AttemptMock[] = [];
  parentMessages: ParentMessageMock[] = [];
  dynamicQuestions: any[] = [];
  
  // Phase 12 arrays
  peerStamps: PeerStampMock[] = [];
  hiramekiTips: HiramekiTipMock[] = [];
  classMissions: ClassMissionMock[] = [];
  parentalCelebrations: ParentalCelebrationMock[] = [];

  constructor() {
    // Seed default B2C tenant
    this.tenants.push({
      id: 'default-b2c',
      name: 'デフォルト個人テナント',
      code: 'b2c',
      plan: 'STANDARD',
      createdAt: new Date().toISOString(),
    });

    // Seed a test tenant for schools/cram schools
    this.tenants.push({
      id: 'test-tenant-id',
      name: 'ラッキョ進学塾',
      code: 'rakkyo-juku',
      plan: 'PREMIUM',
      createdAt: new Date().toISOString(),
    });

    // Seed a default test student in the test tenant
    this.users.push({
      id: 'test-student-id',
      tenantId: 'test-tenant-id',
      email: 'student@rakkyo.com',
      passwordHash: '$2a$10$fW38C222nIeG4mBwH2zHze8/yQ/JzR57Q4vGvI2V6cR2fX94e/sS.', // password: 'password123'
      nickname: 'ラッキョくん',
      role: 'STUDENT',
      schoolYear: 1,
      currentXp: 45,
      level: 2,
      streakCount: 3,
      lastActiveDate: new Date().toISOString(),
      parentalConsent: true,
      aiHintCountToday: 0,
      lastAiHintDate: null,
      badges: ['🎉 冒険のはじまり'],
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    });

    // Seed a test teacher in the test tenant
    this.users.push({
      id: 'test-teacher-id',
      tenantId: 'test-tenant-id',
      email: 'teacher@rakkyo.com',
      passwordHash: '$2a$10$fW38C222nIeG4mBwH2zHze8/yQ/JzR57Q4vGvI2V6cR2fX94e/sS.', // password: 'password123'
      nickname: 'ラッキョ先生',
      role: 'TEACHER',
      schoolYear: 1,
      currentXp: 0,
      level: 1,
      streakCount: 0,
      lastActiveDate: null,
      parentalConsent: false,
      aiHintCountToday: 0,
      lastAiHintDate: null,
      badges: [],
      createdAt: new Date().toISOString(),
    });

    // Seed a test class
    this.classes.push({
      id: 'test-class-id',
      tenantId: 'test-tenant-id',
      name: '中1数学特訓クラス',
      grade: 1,
    });

    // Enroll teacher and student into class
    this.classEnrollments.push({
      id: 'enroll_teacher_1',
      classId: 'test-class-id',
      userId: 'test-teacher-id',
      role: 'TEACHER',
    });

    this.classEnrollments.push({
      id: 'enroll_student_1',
      classId: 'test-class-id',
      userId: 'test-student-id',
      role: 'STUDENT',
    });

    // Seed mock attempts for parent dashboard visualization
    const userId = 'test-student-id';
    const now = new Date();
    
    // Helper to get relative date
    const getPastDate = (daysAgo: number, hour: number) => {
      const d = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      d.setHours(hour, 0, 0, 0);
      return d.toISOString();
    };

    this.attempts.push(
      // 4 days ago - Unit 1: Positive and negative numbers
      {
        id: 'attempt_seed_1',
        userId,
        questionId: '$-5 + 3$ を計算しなさい。',
        isCorrect: true,
        hintsUsed: 0,
        answerSubmitted: '-2',
        durationSeconds: 15,
        createdAt: getPastDate(4, 16)
      },
      {
        id: 'attempt_seed_2',
        userId,
        questionId: '$-4 - 7$ を計算しなさい。',
        isCorrect: true,
        hintsUsed: 1,
        answerSubmitted: '-11',
        durationSeconds: 28,
        createdAt: getPastDate(4, 16 + 5)
      },
      // 3 days ago - Unit 1
      {
        id: 'attempt_seed_3',
        userId,
        questionId: '$(-6) \\times (-3)$ を計算しなさい。',
        isCorrect: true,
        hintsUsed: 2,
        answerSubmitted: '18',
        durationSeconds: 45,
        createdAt: getPastDate(3, 17)
      },
      {
        id: 'attempt_seed_4',
        userId,
        questionId: '$12 \\div (-4)$ を計算しなさい。',
        isCorrect: false,
        hintsUsed: 3,
        answerSubmitted: '3', // Wrong answer
        durationSeconds: 52,
        createdAt: getPastDate(3, 17 + 10),
        errorType: 'conceptual_error',
        aiDiagnosis: 'わり算の符号のルールを間違えちゃったみたいだね。マイナスの数が1つ奇数個あるときは、答えの符号はマイナスになるよ！ 🧅'
      },
      // 2 days ago - Unit 1
      {
        id: 'attempt_seed_5',
        userId,
        questionId: '$12 \\div (-4)$ を計算しなさい。',
        isCorrect: true,
        hintsUsed: 1,
        answerSubmitted: '-3', // Retry and correct
        durationSeconds: 18,
        createdAt: getPastDate(2, 16)
      },
      {
        id: 'attempt_seed_6',
        userId,
        questionId: '数直線上で $-3$ からの距離が $5$ である数の組み合わせを選びなさい。',
        isCorrect: true,
        hintsUsed: 2,
        answerSubmitted: '2 と -8',
        durationSeconds: 64,
        createdAt: getPastDate(2, 16 + 8)
      },
      // Yesterday - Unit 1 and Unit 2: Characters and Expressions
      {
        id: 'attempt_seed_7',
        userId,
        questionId: '$-3 + (-8) - (-5)$ を計算しなさい。',
        isCorrect: true,
        hintsUsed: 3,
        answerSubmitted: '-6',
        durationSeconds: 88,
        createdAt: getPastDate(1, 18)
      },
      {
        id: 'attempt_seed_8',
        userId,
        questionId: '$x = -3$ のとき、式 $5x + 4$ の値を求めなさい。',
        isCorrect: false,
        hintsUsed: 1,
        answerSubmitted: '11', // Wrong answer
        durationSeconds: 37,
        createdAt: getPastDate(1, 18 + 12),
        errorType: 'careless_mistake',
        aiDiagnosis: '代入したあとの掛け算で、符号のミスがあったかもしれないね。$5 \\times (-3)$ は $-15$ になるよ。そこにもう一度 $+4$ を足してみて！ 🧅'
      },
      // Today - Unit 2
      {
        id: 'attempt_seed_9',
        userId,
        questionId: '$x = -3$ のとき、式 $5x + 4$ の値を求めなさい。',
        isCorrect: true,
        hintsUsed: 0,
        answerSubmitted: '-11', // Retry and correct
        durationSeconds: 12,
        createdAt: getPastDate(0, 15)
      },
      {
        id: 'attempt_seed_10',
        userId,
        questionId: '式 $3x - 5 - 7x + 2$ を簡潔にしなさい。',
        isCorrect: true,
        hintsUsed: 1,
        answerSubmitted: '-4x-3',
        durationSeconds: 42,
        createdAt: getPastDate(0, 15 + 10)
      }
    );

    // Seed Phase 12 Class Mission
    this.classMissions.push({
      id: 'mission_seed_1',
      classId: 'test-class-id',
      title: 'クラスみんなで協力！あきらめない勉強時間 🧅',
      targetMinutes: 1000,
      currentMinutes: 480,
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days left
      createdAt: new Date().toISOString()
    });

    // Seed Phase 12 Hirameki Tips (Anonymous tips board)
    this.hiramekiTips.push({
      id: 'tip_seed_1',
      classId: 'test-class-id',
      userId: 'user_dummy_student1',
      nickname: 'ひらめきラッキョ',
      content: '$-5 + 3$ は、数直線の「-5」の位置から右に3つジャンプするってイメージすると簡単だよ！🧅',
      isSafe: true,
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // 1 day ago
    }, {
      id: 'tip_seed_2',
      classId: 'test-class-id',
      userId: 'user_dummy_student2',
      nickname: 'がんばるオニオン',
      content: '文字式にマイナスの数を代入するときは、文字をカッコ $( )$ のハコに置き換えて、その中にそっと数字を入れるって意識すると符号ミスがなくなるよ！💪',
      isSafe: true,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // 2 hours ago
    });

    // Seed dummy users for presence simulation
    const dummyNames = ['ウキウキらっきょ', 'のんびりオニオン', 'シャキシャキネギ', 'もぐもぐニンニク'];
    dummyNames.forEach((nickname, idx) => {
      this.users.push({
        id: `user_presence_${idx}`,
        tenantId: 'test-tenant-id',
        email: `presence_${idx}@rakkyo.com`,
        passwordHash: 'dummy',
        nickname,
        role: 'STUDENT',
        schoolYear: 1,
        currentXp: 100 + idx * 50,
        level: 2,
        streakCount: 2 + idx,
        lastActiveDate: new Date(Date.now() - idx * 5 * 60 * 1000).toISOString(),
        parentalConsent: true,
        aiHintCountToday: 0,
        lastAiHintDate: null,
        badges: [],
        createdAt: new Date().toISOString()
      });
      // Enroll dummy students into test class
      this.classEnrollments.push({
        id: `enroll_presence_${idx}`,
        classId: 'test-class-id',
        userId: `user_presence_${idx}`,
        role: 'STUDENT'
      });
    });
  }

  // Tenant helpers
  findTenantByCode(code: string): TenantMock | undefined {
    return this.tenants.find(t => t.code.toLowerCase() === code.toLowerCase());
  }

  findTenantById(id: string): TenantMock | undefined {
    return this.tenants.find(t => t.id === id);
  }

  createTenant(name: string, code: string): TenantMock {
    const newTenant: TenantMock = {
      id: 'tenant_' + Math.random().toString(36).substr(2, 9),
      name,
      code: code.toLowerCase(),
      plan: 'STANDARD',
      createdAt: new Date().toISOString()
    };
    this.tenants.push(newTenant);
    return newTenant;
  }

  // User helpers
  findUserByEmail(email: string, tenantId?: string): UserMock | undefined {
    // If tenantId is provided, filter by it as well (different tenants can have the same email)
    return this.users.find(u => 
      u.email.toLowerCase() === email.toLowerCase() && 
      (!tenantId || u.tenantId === tenantId)
    );
  }

  findUserById(id: string): UserMock | undefined {
    return this.users.find(u => u.id === id);
  }

  createUser(user: Omit<UserMock, 'id' | 'createdAt' | 'currentXp' | 'level' | 'streakCount' | 'lastActiveDate' | 'badges' | 'aiHintCountToday' | 'lastAiHintDate'>): UserMock {
    const newUser: UserMock = {
      ...user,
      id: 'user_' + Math.random().toString(36).substr(2, 9),
      currentXp: 0,
      level: 1,
      streakCount: 0,
      lastActiveDate: null,
      aiHintCountToday: 0,
      lastAiHintDate: null,
      badges: [],
      createdAt: new Date().toISOString(),
    };
    this.users.push(newUser);
    return newUser;
  }

  updateUser(id: string, updates: Partial<Omit<UserMock, 'id' | 'email' | 'createdAt'>>): UserMock | undefined {
    const user = this.findUserById(id);
    if (user) {
      Object.assign(user, updates);
    }
    return user;
  }

  // Class helpers
  createClass(tenantId: string, name: string, grade: number): ClassMock {
    const newClass: ClassMock = {
      id: 'class_' + Math.random().toString(36).substr(2, 9),
      tenantId,
      name,
      grade
    };
    this.classes.push(newClass);
    return newClass;
  }

  getTeacherClasses(teacherId: string): ClassMock[] {
    const classIds = this.classEnrollments
      .filter(e => e.userId === teacherId && e.role === 'TEACHER')
      .map(e => e.classId);
    return this.classes.filter(c => classIds.includes(c.id));
  }

  getClassStudents(classId: string): UserMock[] {
    const studentIds = this.classEnrollments
      .filter(e => e.classId === classId && e.role === 'STUDENT')
      .map(e => e.userId);
    return this.users.filter(u => studentIds.includes(u.id));
  }

  enrollUserInClass(classId: string, userId: string, role: 'TEACHER' | 'STUDENT'): ClassEnrollmentMock {
    const newEnrollment: ClassEnrollmentMock = {
      id: 'enroll_' + Math.random().toString(36).substr(2, 9),
      classId,
      userId,
      role
    };
    this.classEnrollments.push(newEnrollment);
    return newEnrollment;
  }

  // Assignment helpers
  createAssignment(tenantId: string, classId: string, title: string, lessonId: string, dueDate: string): AssignmentMock {
    const newAssignment: AssignmentMock = {
      id: 'assignment_' + Math.random().toString(36).substr(2, 9),
      tenantId,
      classId,
      title,
      lessonId,
      dueDate,
      createdAt: new Date().toISOString()
    };
    this.assignments.push(newAssignment);

    // Auto-create assignment progresses for all students in the class
    const students = this.getClassStudents(classId);
    students.forEach(s => {
      this.assignmentProgresses.push({
        id: 'progress_' + Math.random().toString(36).substr(2, 9),
        assignmentId: newAssignment.id,
        studentId: s.id,
        isCompleted: false,
        completedAt: null
      });
    });

    return newAssignment;
  }

  getStudentAssignments(studentId: string): (AssignmentMock & { isCompleted: boolean })[] {
    const progresses = this.assignmentProgresses.filter(p => p.studentId === studentId);
    return progresses.map(p => {
      const assignment = this.assignments.find(a => a.id === p.assignmentId)!;
      return {
        ...assignment,
        isCompleted: p.isCompleted
      };
    }).filter(a => a !== undefined);
  }

  getClassAssignments(classId: string): (AssignmentMock & { completedCount: number; totalCount: number })[] {
    const classAss = this.assignments.filter(a => a.classId === classId);
    return classAss.map(a => {
      const progs = this.assignmentProgresses.filter(p => p.assignmentId === a.id);
      const completedCount = progs.filter(p => p.isCompleted).length;
      return {
        ...a,
        completedCount,
        totalCount: progs.length
      };
    });
  }

  updateAssignmentProgress(assignmentId: string, studentId: string, isCompleted: boolean): boolean {
    const prog = this.assignmentProgresses.find(p => p.assignmentId === assignmentId && p.studentId === studentId);
    if (prog) {
      prog.isCompleted = isCompleted;
      prog.completedAt = isCompleted ? new Date().toISOString() : null;
      return true;
    }
    return false;
  }

  // Attempt & message helpers
  createAttempt(attempt: Omit<AttemptMock, 'id' | 'createdAt'>): AttemptMock {
    const newAttempt: AttemptMock = {
      ...attempt,
      id: 'attempt_' + Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
    };
    this.attempts.push(newAttempt);
    return newAttempt;
  }

  getUserAttempts(userId: string): AttemptMock[] {
    return this.attempts.filter(a => a.userId === userId);
  }

  getParentMessages(userId: string): ParentMessageMock[] {
    return this.parentMessages.filter(m => m.userId === userId);
  }

  createParentMessage(userId: string, message: string): ParentMessageMock {
    const newMessage: ParentMessageMock = {
      id: 'msg_' + Math.random().toString(36).substr(2, 9),
      userId,
      message,
      isRead: false,
      createdAt: new Date().toISOString()
    };
    this.parentMessages.push(newMessage);
    return newMessage;
  }

  markParentMessageAsRead(id: string): boolean {
    const msg = this.parentMessages.find(m => m.id === id);
    if (msg) {
      msg.isRead = true;
      return true;
    }
    return false;
  }

  // Dynamic question helpers
  createDynamicQuestion(question: any): any {
    const newQ = {
      ...question,
      id: question.id || 'q_dynamic_' + Math.random().toString(36).substr(2, 9),
      isDynamic: true
    };
    this.dynamicQuestions.push(newQ);
    return newQ;
  }

  findDynamicQuestion(id: string): any {
    return this.dynamicQuestions.find(q => q.id === id);
  }

  // PeerStamp Mock helpers
  createPeerStamp(senderId: string, receiverId: string, stampType: string): PeerStampMock {
    const newStamp: PeerStampMock = {
      id: 'stamp_' + Math.random().toString(36).substr(2, 9),
      senderId,
      receiverId,
      stampType,
      createdAt: new Date().toISOString()
    };
    this.peerStamps.push(newStamp);
    return newStamp;
  }

  getUserReceivedStamps(userId: string): (PeerStampMock & { senderNickname: string })[] {
    return this.peerStamps
      .filter(s => s.receiverId === userId)
      .map(s => {
        const sender = this.findUserById(s.senderId);
        return {
          ...s,
          senderNickname: sender ? sender.nickname : 'なぞのラッキョ'
        };
      });
  }

  // HiramekiTip Mock helpers
  createHiramekiTip(classId: string, userId: string, nickname: string, content: string, isSafe: boolean): HiramekiTipMock {
    const newTip: HiramekiTipMock = {
      id: 'tip_' + Math.random().toString(36).substr(2, 9),
      classId,
      userId,
      nickname,
      content,
      isSafe,
      createdAt: new Date().toISOString()
    };
    this.hiramekiTips.push(newTip);
    return newTip;
  }

  getClassHiramekiTips(classId: string): HiramekiTipMock[] {
    return this.hiramekiTips
      .filter(t => t.classId === classId && t.isSafe)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // ClassMission Mock helpers
  getClassMissions(classId: string): ClassMissionMock[] {
    return this.classMissions.filter(m => m.classId === classId);
  }

  contributeToClassMission(classId: string, minutes: number): boolean {
    const missions = this.classMissions.filter(m => m.classId === classId);
    if (missions.length > 0) {
      missions.forEach(m => {
        m.currentMinutes += minutes;
      });
      return true;
    }
    return false;
  }

  // ParentalCelebration Mock helpers
  createParentalCelebration(childId: string, attemptId: string, token: string): ParentalCelebrationMock {
    const celebration: ParentalCelebrationMock = {
      id: 'celeb_' + Math.random().toString(36).substr(2, 9),
      childId,
      attemptId,
      token,
      parentStamp: null,
      parentComment: null,
      isResponded: false,
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days later
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.parentalCelebrations.push(celebration);
    return celebration;
  }

  findParentalCelebrationByToken(token: string): ParentalCelebrationMock | undefined {
    return this.parentalCelebrations.find(c => c.token === token);
  }

  respondToParentalCelebration(token: string, stamp: string, comment?: string): boolean {
    const celeb = this.findParentalCelebrationByToken(token);
    if (celeb) {
      if (celeb.isResponded || new Date(celeb.expiresAt).getTime() < Date.now()) {
        return false;
      }
      celeb.parentStamp = stamp;
      celeb.parentComment = comment || null;
      celeb.isResponded = true;
      celeb.updatedAt = new Date().toISOString();

      // Also create a direct ParentMessage so the kid sees it as a notification!
      this.createParentMessage(celeb.childId, `保護者からスタンプ「${stamp}」とメッセージ「${comment || 'がんばったね！'}」が届きました！`);
      return true;
    }
    return false;
  }

  deleteUserData(userId: string): void {
    // 1. Delete celebrations related to child
    this.parentalCelebrations = this.parentalCelebrations.filter(c => c.childId !== userId);
    
    // 2. Delete attempts
    this.attempts = this.attempts.filter(a => a.userId !== userId);
    
    // 3. Delete parent messages
    this.parentMessages = this.parentMessages.filter(m => m.userId !== userId);
    
    // 4. Delete peer stamps where user is sender or receiver
    this.peerStamps = this.peerStamps.filter(s => s.senderId !== userId && s.receiverId !== userId);
    
    // 5. Delete hirameki tips
    this.hiramekiTips = this.hiramekiTips.filter(t => t.userId !== userId);
    
    // 6. Delete class enrollments
    this.classEnrollments = this.classEnrollments.filter(e => e.userId !== userId);
    
    // 7. Delete assignment progresses
    this.assignmentProgresses = this.assignmentProgresses.filter(p => p.studentId !== userId);
    
    // 8. Delete user itself
    this.users = this.users.filter(u => u.id !== userId);
  }
}

export const mockDb = new MockDatabase();
