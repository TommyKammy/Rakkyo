import request from 'supertest';
import app from '../app';
import { mockDb } from '../mockDb';

describe('Parent Router /api/parent', () => {
  let token: string;
  let userId: string;

  beforeAll(async () => {
    const testEmail = `parent_test_${Math.random().toString(36).substr(2, 9)}@rakkyo.com`;
    const testPassword = 'password123';
    const testNickname = 'テスト保護者';

    // Register a brand new user
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: testPassword,
        nickname: testNickname,
        schoolYear: 1
      });
    
    token = res.body.token;
    userId = res.body.user.id;

    // Seed mock attempts specifically for this test user in mockDb
    const now = new Date();
    const getPastDate = (daysAgo: number, hour: number) => {
      const d = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      d.setHours(hour, 0, 0, 0);
      return d.toISOString();
    };

    mockDb.attempts.push(
      // 4 days ago - Unit 1: Positive and negative numbers
      {
        id: `t_attempt_${userId}_1`,
        userId,
        questionId: '$-5 + 3$ を計算しなさい。',
        isCorrect: true,
        hintsUsed: 0,
        answerSubmitted: '-2',
        createdAt: getPastDate(4, 16)
      },
      {
        id: `t_attempt_${userId}_2`,
        userId,
        questionId: '$-4 - 7$ を計算しなさい。',
        isCorrect: true,
        hintsUsed: 1,
        answerSubmitted: '-11',
        createdAt: getPastDate(4, 17)
      },
      // 3 days ago - Unit 1
      {
        id: `t_attempt_${userId}_3`,
        userId,
        questionId: '$(-6) \\times (-3)$ を計算しなさい。',
        isCorrect: true,
        hintsUsed: 2,
        answerSubmitted: '18',
        createdAt: getPastDate(3, 17)
      },
      {
        id: `t_attempt_${userId}_4`,
        userId,
        questionId: '$12 \\div (-4)$ を計算しなさい。',
        isCorrect: false,
        hintsUsed: 3,
        answerSubmitted: '3',
        createdAt: getPastDate(3, 18)
      },
      // 2 days ago - Unit 1
      {
        id: `t_attempt_${userId}_5`,
        userId,
        questionId: '$12 \\div (-4)$ を計算しなさい。',
        isCorrect: true,
        hintsUsed: 1,
        answerSubmitted: '-3',
        createdAt: getPastDate(2, 16)
      },
      {
        id: `t_attempt_${userId}_6`,
        userId,
        questionId: '数直線上で $-3$ からの距離が $5$ である数の組み合わせを選びなさい。',
        isCorrect: true,
        hintsUsed: 2,
        answerSubmitted: '2 と -8',
        createdAt: getPastDate(2, 17)
      },
      // Yesterday - Unit 1 and Unit 2
      {
        id: `t_attempt_${userId}_7`,
        userId,
        questionId: '$-3 + (-8) - (-5)$ を計算しなさい。',
        isCorrect: true,
        hintsUsed: 3,
        answerSubmitted: '-6',
        createdAt: getPastDate(1, 18)
      },
      {
        id: `t_attempt_${userId}_8`,
        userId,
        questionId: '$x = -3$ のとき、式 $5x + 4$ の値を求めなさい。',
        isCorrect: false,
        hintsUsed: 1,
        answerSubmitted: '11',
        createdAt: getPastDate(1, 19)
      },
      // Today - Unit 2
      {
        id: `t_attempt_${userId}_9`,
        userId,
        questionId: '$x = -3$ のとき、式 $5x + 4$ の値を求めなさい。',
        isCorrect: true,
        hintsUsed: 0,
        answerSubmitted: '-11',
        createdAt: getPastDate(0, 15)
      },
      {
        id: `t_attempt_${userId}_10`,
        userId,
        questionId: '式 $3x - 5 - 7x + 2$ を簡潔にしなさい。',
        isCorrect: true,
        hintsUsed: 1,
        answerSubmitted: '-4x-3',
        createdAt: getPastDate(0, 16)
      }
    );
  });

  it('should reject requests without authorization header', async () => {
    const res = await request(app)
      .get('/api/parent/stats');
    
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('should retrieve student learning stats successfully', async () => {
    const res = await request(app)
      .get('/api/parent/stats')
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.status).toBe(200);
    
    // Check main properties
    expect(res.body).toHaveProperty('summary');
    expect(res.body).toHaveProperty('dailyActivity');
    expect(res.body).toHaveProperty('topicProgress');
    expect(res.body).toHaveProperty('hintStageUsage');
    
    // Check summary properties
    const summary = res.body.summary;
    expect(summary).toHaveProperty('totalActiveDays');
    expect(summary).toHaveProperty('totalAttempts');
    expect(summary).toHaveProperty('correctAttempts');
    expect(summary).toHaveProperty('accuracyRate');
    expect(summary).toHaveProperty('totalHintsUsed');
    expect(summary).toHaveProperty('gritScore');
    
    // Verify specific values
    expect(summary.totalAttempts).toBe(10);
    expect(summary.correctAttempts).toBe(8);
    expect(summary.accuracyRate).toBe(80); // 8/10 * 100
    
    // Check grit score (grit attempts: 8 has hintsUsed > 0, grit correct: 6 has isCorrect: true)
    // gritAttempts: 2, 3, 4, 5, 6, 7, 8, 10 (8 attempts)
    // gritSuccess: 2, 3, 5, 6, 7, 10 (6 attempts)
    // gritScore: 6/8 = 75%
    expect(summary.gritScore).toBe(75);
    
    // Daily Activity checking (should have exactly 7 days of items)
    expect(res.body.dailyActivity).toHaveLength(7);
    const todayActivity = res.body.dailyActivity[6];
    expect(todayActivity).toHaveProperty('date');
    expect(todayActivity).toHaveProperty('attemptsCount');
    expect(todayActivity).toHaveProperty('correctCount');
    expect(todayActivity).toHaveProperty('hintsCount');
    
    // Topic Progress checking
    expect(res.body.topicProgress.length).toBeGreaterThan(0);
    expect(res.body.topicProgress[0]).toHaveProperty('unitName');
    expect(res.body.topicProgress[0]).toHaveProperty('totalQuestions');
    expect(res.body.topicProgress[0]).toHaveProperty('attemptsCount');
    expect(res.body.topicProgress[0]).toHaveProperty('correctCount');
    
    // Hint stage checking
    expect(res.body.hintStageUsage).toHaveProperty('stage1Count');
    expect(res.body.hintStageUsage).toHaveProperty('stage2Count');
    expect(res.body.hintStageUsage).toHaveProperty('stage3Count');
    
    // attempt 2(1), 3(2), 4(3), 5(1), 6(2), 7(3), 8(1), 10(1)
    // stage 1 used in: 2, 3, 4, 5, 6, 7, 8, 10 (8 items) -> count >= 1
    // stage 2 used in: 3, 4, 6, 7 (4 items) -> count >= 2
    // stage 3 used in: 4, 7 (2 items) -> count >= 3
    expect(res.body.hintStageUsage.stage1Count).toBe(8);
    expect(res.body.hintStageUsage.stage2Count).toBe(4);
    expect(res.body.hintStageUsage.stage3Count).toBe(2);
  });
});
