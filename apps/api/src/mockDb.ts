export interface UserMock {
  id: string;
  email: string;
  passwordHash: string;
  nickname: string;
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

export interface AttemptMock {
  id: string;
  userId: string;
  questionId: string;
  isCorrect: boolean;
  hintsUsed: number;
  answerSubmitted: string;
  durationSeconds?: number | null;
  createdAt: string;
}

export interface ParentMessageMock {
  id: string;
  userId: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

class MockDatabase {
  users: UserMock[] = [];
  attempts: AttemptMock[] = [];
  parentMessages: ParentMessageMock[] = [];

  constructor() {
    // Seed a default test student
    this.users.push({
      id: 'test-student-id',
      email: 'student@rakkyo.com',
      passwordHash: '$2a$10$fW38C222nIeG4mBwH2zHze8/yQ/JzR57Q4vGvI2V6cR2fX94e/sS.', // password: 'password123'
      nickname: 'ラッキョくん',
      schoolYear: 1,
      currentXp: 45,
      level: 2,
      streakCount: 3,
      lastActiveDate: new Date().toISOString(),
      parentalConsent: true,
      aiHintCountToday: 0,
      lastAiHintDate: null,
      badges: ['🎉 冒険のはじまり'],
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // Created 5 days ago
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
        createdAt: getPastDate(3, 17 + 10)
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
        createdAt: getPastDate(1, 18 + 12)
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
  }

  findUserByEmail(email: string): UserMock | undefined {
    return this.users.find(u => u.email.toLowerCase() === email.toLowerCase());
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
}

export const mockDb = new MockDatabase();
