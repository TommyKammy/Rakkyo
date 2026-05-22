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
  role: string;
  schoolYear: number;
  currentXp: number;
  level: number;
  streakCount: number;
  lastActiveDate: string | null;
  parentalConsent: boolean;
  aiHintCountToday: number;
  lastAiHintDate: string | null;
  abuseCount: number;
  abuseLastAt: string | null;
  lockedUntil: string | null;
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
  role: string;
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

export interface SafetyAlertMock {
  id: string;
  childUserId: string;
  alertType: string;
  payload: string;
  status: 'QUEUED' | 'SENT' | 'FAILED';
  createdAt: string;
  sentAt: string | null;
}

class InMemoryState {
  tenants: TenantMock[] = [];
  users: UserMock[] = [];
  classes: ClassMock[] = [];
  classEnrollments: ClassEnrollmentMock[] = [];
  assignments: AssignmentMock[] = [];
  assignmentProgresses: StudentAssignmentProgressMock[] = [];
  attempts: AttemptMock[] = [];
  parentMessages: ParentMessageMock[] = [];
  dynamicQuestions: any[] = [];
  peerStamps: PeerStampMock[] = [];
  hiramekiTips: HiramekiTipMock[] = [];
  classMissions: ClassMissionMock[] = [];
  parentalCelebrations: ParentalCelebrationMock[] = [];
  safetyAlerts: SafetyAlertMock[] = [];

  constructor() {
    this.seed();
  }

  reset() {
    this.tenants = [];
    this.users = [];
    this.classes = [];
    this.classEnrollments = [];
    this.assignments = [];
    this.assignmentProgresses = [];
    this.attempts = [];
    this.parentMessages = [];
    this.dynamicQuestions = [];
    this.peerStamps = [];
    this.hiramekiTips = [];
    this.classMissions = [];
    this.parentalCelebrations = [];
    this.safetyAlerts = [];
    this.seed();
  }

  private seed() {
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
      abuseCount: 0,
      abuseLastAt: null,
      lockedUntil: null,
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
      abuseCount: 0,
      abuseLastAt: null,
      lockedUntil: null,
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
        aiDiagnosis: 'わり算の符号のルールを間違えちゃったみたいだね！わり算の符号のルールを間違えちゃったみたいだね。マイナスの数が1つ奇数個あるときは、答えの符号はマイナスになるよ！ 🧅'
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
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString()
    });

    // Seed Phase 12 Hirameki Tips
    this.hiramekiTips.push({
      id: 'tip_seed_1',
      classId: 'test-class-id',
      userId: 'user_dummy_student1',
      nickname: 'ひらめきラッキョ',
      content: '$-5 + 3$ は、数直線の「-5」の位置から右に3つジャンプするってイメージすると簡単だよ！🧅',
      isSafe: true,
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    }, {
      id: 'tip_seed_2',
      classId: 'test-class-id',
      userId: 'user_dummy_student2',
      nickname: 'がんばるオニオン',
      content: '文字式にマイナスの数を代入するときは、文字をカッコ $( )$ のハコに置き換えて、その中にそっと数字を入れるって意識すると符号ミスがなくなるよ！💪',
      isSafe: true,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
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
        abuseCount: 0,
        abuseLastAt: null,
        lockedUntil: null,
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
}

export const inMemoryState = new InMemoryState();
