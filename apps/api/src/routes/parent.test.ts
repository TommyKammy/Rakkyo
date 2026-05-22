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
        schoolYear: 1,
        parentalConsent: true
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
        durationSeconds: 30, // 30s
        createdAt: getPastDate(4, 16)
      },
      {
        id: `t_attempt_${userId}_2`,
        userId,
        questionId: '$-4 - 7$ を計算しなさい。',
        isCorrect: true,
        hintsUsed: 1,
        answerSubmitted: '-11',
        durationSeconds: 45, // 45s
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
        durationSeconds: 60, // 60s
        createdAt: getPastDate(3, 17)
      },
      {
        id: `t_attempt_${userId}_4`,
        userId,
        questionId: '$12 \\div (-4)$ を計算しなさい。',
        isCorrect: false,
        hintsUsed: 3,
        answerSubmitted: '3',
        durationSeconds: 90, // 90s
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
        durationSeconds: 40, // 40s
        createdAt: getPastDate(2, 16)
      },
      {
        id: `t_attempt_${userId}_6`,
        userId,
        questionId: '数直線上で $-3$ からの距離が $5$ である数の組み合わせを選びなさい。',
        isCorrect: true,
        hintsUsed: 2,
        answerSubmitted: '2 と -8',
        durationSeconds: 80, // 80s
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
        durationSeconds: 120, // 120s
        createdAt: getPastDate(1, 18)
      },
      {
        id: `t_attempt_${userId}_8`,
        userId,
        questionId: '$x = -3$ のとき、式 $5x + 4$ の値を求めなさい。',
        isCorrect: false,
        hintsUsed: 1,
        answerSubmitted: '11',
        durationSeconds: 50, // 50s
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
        durationSeconds: 25, // 25s
        createdAt: getPastDate(0, 15)
      },
      {
        id: `t_attempt_${userId}_10`,
        userId,
        questionId: '式 $3x - 5 - 7x + 2$ を簡潔にしなさい。',
        isCorrect: true,
        hintsUsed: 1,
        answerSubmitted: '-4x-3',
        durationSeconds: 60, // 60s
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
    expect(res.body).toHaveProperty('weakestUnits');
    expect(res.body).toHaveProperty('weeklyHistory');
    
    // Check summary properties
    const summary = res.body.summary;
    expect(summary).toHaveProperty('totalActiveDays');
    expect(summary).toHaveProperty('totalAttempts');
    expect(summary).toHaveProperty('correctAttempts');
    expect(summary).toHaveProperty('accuracyRate');
    expect(summary).toHaveProperty('totalHintsUsed');
    expect(summary).toHaveProperty('gritScore');
    expect(summary).toHaveProperty('totalStudyTimeMinutes');
    
    // Verify specific values
    expect(summary.totalAttempts).toBe(10);
    expect(summary.correctAttempts).toBe(8);
    expect(summary.accuracyRate).toBe(80); // 8/10 * 100
    
    // Verify study time (total: 30+45+60+90+40+80+120+50+25+60 = 600 seconds = 10 minutes)
    expect(summary.totalStudyTimeMinutes).toBe(10);
    
    // Check grit score
    expect(summary.gritScore).toBe(75);
    
    // Daily Activity checking (should have exactly 7 days of items)
    expect(res.body.dailyActivity).toHaveLength(7);
    
    // Weakest units checking
    expect(res.body.weakestUnits.length).toBeGreaterThan(0);
    expect(res.body.weakestUnits[0]).toHaveProperty('unitName');
    expect(res.body.weakestUnits[0]).toHaveProperty('weakestScore');
    expect(res.body.weakestUnits[0]).toHaveProperty('reason');
    
    // Weekly History checking (4 weeks comparative)
    expect(res.body.weeklyHistory).toHaveLength(4);
    expect(res.body.weeklyHistory[3].label).toBe('今週');
    expect(res.body.weeklyHistory[3].studyTimeMinutes).toBe(10);
    expect(res.body.weeklyHistory[3].totalAttempts).toBe(10);
  });

  describe('Parent-Child Messaging Flow', () => {
    let msgId: string;

    it('should allow parent to post an encouragement message', async () => {
      const res = await request(app)
        .post('/api/parent/message')
        .set('Authorization', `Bearer ${token}`)
        .send({ message: 'がんばってるね！応援しているよ🧅' });
      
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('message');
      expect(res.body.message.message).toBe('がんばってるね！応援しているよ🧅');
      expect(res.body.message.isRead).toBe(false);
      
      msgId = res.body.message.id;
    });

    it('should retrieve list of messages', async () => {
      const res = await request(app)
        .get('/api/parent/message')
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('messages');
      expect(res.body.messages.length).toBeGreaterThan(0);
      expect(res.body.messages[0].id).toBe(msgId);
    });

    it('should allow marking a message as read by the child', async () => {
      const res = await request(app)
        .patch(`/api/parent/message/${msgId}/read`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify it is indeed read now
      const checkRes = await request(app)
        .get('/api/parent/message')
        .set('Authorization', `Bearer ${token}`);
      
      const updatedMsg = checkRes.body.messages.find((m: any) => m.id === msgId);
      expect(updatedMsg.isRead).toBe(true);
    });
  });
});
