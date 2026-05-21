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
  createdAt: string;
}

class MockDatabase {
  users: UserMock[] = [];
  attempts: AttemptMock[] = [];

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
      badges: ['🎉 冒険のはじまり'],
      createdAt: new Date().toISOString(),
    });
  }

  findUserByEmail(email: string): UserMock | undefined {
    return this.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  findUserById(id: string): UserMock | undefined {
    return this.users.find(u => u.id === id);
  }

  createUser(user: Omit<UserMock, 'id' | 'createdAt' | 'currentXp' | 'level' | 'streakCount' | 'lastActiveDate' | 'badges'>): UserMock {
    const newUser: UserMock = {
      ...user,
      id: 'user_' + Math.random().toString(36).substr(2, 9),
      currentXp: 0,
      level: 1,
      streakCount: 0,
      lastActiveDate: null,
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
}

export const mockDb = new MockDatabase();
