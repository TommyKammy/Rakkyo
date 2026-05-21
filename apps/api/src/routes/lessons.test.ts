import request from 'supertest';
import app from '../app';

describe('Lessons Router /api/lessons', () => {
  const testEmail = `student_${Math.random().toString(36).substr(2, 9)}@rakkyo.com`;
  const testPassword = 'password123';
  const testNickname = 'テストくん';
  let token = '';

  beforeAll(async () => {
    // Register and login to retrieve a token
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: testPassword,
        nickname: testNickname,
        schoolYear: 1
      });
    token = regRes.body.token;
  });

  it('should reject requests without a token', async () => {
    const res = await request(app)
      .post('/api/lessons/submit')
      .send({
        questionId: '$-5 + 3$ を計算しなさい。',
        answerSubmitted: '-2',
        hintsUsed: 0
      });
    expect(res.status).toBe(401);
  });

  it('should evaluate a correct answer successfully and award XP', async () => {
    const res = await request(app)
      .post('/api/lessons/submit')
      .set('Authorization', `Bearer ${token}`)
      .send({
        questionId: '$-5 + 3$ を計算しなさい。',
        answerSubmitted: '-2',
        hintsUsed: 0
      });

    expect(res.status).toBe(200);
    expect(res.body.isCorrect).toBe(true);
    expect(res.body.xpAwarded).toBe(10);
    expect(res.body.user.currentXp).toBe(10);
    expect(res.body.user.level).toBe(1);
    expect(res.body.user.streakCount).toBe(1);
    // Should have earned the start badge
    expect(res.body.newBadges).toContain('🎉 冒険のはじまり');
    expect(res.body.user.badges).toContain('🎉 冒険のはじまり');
  });

  it('should evaluate an incorrect answer and not award XP', async () => {
    const res = await request(app)
      .post('/api/lessons/submit')
      .set('Authorization', `Bearer ${token}`)
      .send({
        questionId: '$-5 + 3$ を計算しなさい。',
        answerSubmitted: '99',
        hintsUsed: 1
      });

    expect(res.status).toBe(200);
    expect(res.body.isCorrect).toBe(false);
    expect(res.body.xpAwarded).toBe(0);
    expect(res.body.user.currentXp).toBe(10); // Remains unchanged
  });

  it('should trigger level up when crossing threshold', async () => {
    // User is currently at level 1 with 10XP.
    // Level 1 threshold is 100XP. Need 9 more correct answers (90XP) to reach level 2.
    // Let's send 9 correct submissions.
    let userXp = 10;
    let userLevel = 1;
    let finalRes: any;

    for (let i = 0; i < 9; i++) {
      finalRes = await request(app)
        .post('/api/lessons/submit')
        .set('Authorization', `Bearer ${token}`)
        .send({
          questionId: '$-5 + 3$ を計算しなさい。',
          answerSubmitted: '-2',
          hintsUsed: 0
        });
      expect(finalRes.status).toBe(200);
    }

    // On the 9th correct answer (total 10 correct), XP should reach 100, resetting to 0 and leveling up to 2.
    expect(finalRes.body.isCorrect).toBe(true);
    expect(finalRes.body.leveledUp).toBe(true);
    expect(finalRes.body.user.level).toBe(2);
    expect(finalRes.body.user.currentXp).toBe(0);

    // Also verify "📐 数学マスターの卵" is awarded for >= 5 correct answers
    expect(finalRes.body.user.badges).toContain('📐 数学マスターの卵');
  });

  describe('POST /api/lessons/hint', () => {
    it('should reject hint requests without token', async () => {
      const res = await request(app)
        .post('/api/lessons/hint')
        .send({
          questionId: '$-5 + 3$ を計算しなさい。',
          hintsUsed: 0
        });
      expect(res.status).toBe(401);
    });

    it('should generate progressive hints (stage 1)', async () => {
      const res = await request(app)
        .post('/api/lessons/hint')
        .set('Authorization', `Bearer ${token}`)
        .send({
          questionId: '$-5 + 3$ を計算しなさい。',
          hintsUsed: 0
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('hintText');
      expect(res.body.stage).toBe(1);
      expect(res.body.isMock).toBe(true); // Since GEMINI_API_KEY is not defined in tests, should fallback to Mock
    });

    it('should generate progressive hints (stage 2) and hit cache', async () => {
      // First request (Stage 2)
      const res1 = await request(app)
        .post('/api/lessons/hint')
        .set('Authorization', `Bearer ${token}`)
        .send({
          questionId: '$-5 + 3$ を計算しなさい。',
          hintsUsed: 1
        });

      expect(res1.status).toBe(200);
      expect(res1.body.stage).toBe(2);
      expect(res1.body.fromCache).toBe(false);

      // Second request should hit cache
      const res2 = await request(app)
        .post('/api/lessons/hint')
        .set('Authorization', `Bearer ${token}`)
        .send({
          questionId: '$-5 + 3$ を計算しなさい。',
          hintsUsed: 1
        });

      expect(res2.status).toBe(200);
      expect(res2.body.hintText).toBe(res1.body.hintText);
      expect(res2.body.fromCache).toBe(true);
    });
  });
});
