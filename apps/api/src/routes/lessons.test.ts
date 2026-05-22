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
        schoolYear: 1,
        parentalConsent: true
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

    it('should generate custom friendly answers when userQuestion is supplied, and bypass the cache', async () => {
      const res1 = await request(app)
        .post('/api/lessons/hint')
        .set('Authorization', `Bearer ${token}`)
        .send({
          questionId: '$-5 + 3$ を計算しなさい。',
          hintsUsed: 0,
          userQuestion: 'マイナスの計算の仕方を教えて！'
        });

      expect(res1.status).toBe(200);
      expect(res1.body).toHaveProperty('hintText');
      expect(res1.body.hintText).toContain('マイナスの計算の仕方を教えて！');
      expect(res1.body.fromCache).toBe(false);

      const res2 = await request(app)
        .post('/api/lessons/hint')
        .set('Authorization', `Bearer ${token}`)
        .send({
          questionId: '$-5 + 3$ を計算しなさい。',
          hintsUsed: 0,
          userQuestion: 'マイナスの計算の仕方を教えて！'
        });

      expect(res2.status).toBe(200);
      expect(res2.body.fromCache).toBe(false);
    });

    it('should detect abusive input and return a friendly safety message', async () => {
      const res = await request(app)
        .post('/api/lessons/hint')
        .set('Authorization', `Bearer ${token}`)
        .send({
          questionId: '$-5 + 3$ を計算しなさい。',
          hintsUsed: 0,
          userQuestion: 'ばか死ね遊ぼう'
        });

      expect(res.status).toBe(200);
      expect(res.body.isAbusive).toBe(true);
      expect(res.body.hintText).toContain('お勉強のお話をしてほしいな');
    });

    it('should fallback to static hints when the maximum daily AI limit is exceeded', async () => {
      const originalLimit = process.env.MAX_AI_HINTS_PER_DAY;
      process.env.MAX_AI_HINTS_PER_DAY = '0';

      try {
        // Clear cache first to bypass cache and hit limit logic
        await request(app)
          .post('/api/lessons/hint/cache/clear')
          .set('Authorization', `Bearer ${token}`);

        const res = await request(app)
          .post('/api/lessons/hint')
          .set('Authorization', `Bearer ${token}`)
          .send({
            questionId: '$-5 + 3$ を計算しなさい。',
            hintsUsed: 0
          });

        expect(res.status).toBe(200);
        expect(res.body.limitExceeded).toBe(true);
        expect(res.body.hintText).toContain('今日はたくさんラッキョくんとお勉強したね');
      } finally {
        if (originalLimit === undefined) {
          delete process.env.MAX_AI_HINTS_PER_DAY;
        } else {
          process.env.MAX_AI_HINTS_PER_DAY = originalLimit;
        }
      }
    });
  });

  describe('GET /api/lessons/progress', () => {
    it('should return units progress data', async () => {
      const res = await request(app)
        .get('/api/lessons/progress')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('units');
      expect(Array.isArray(res.body.units)).toBe(true);
      if (res.body.units.length > 0) {
        const unit = res.body.units[0];
        expect(unit).toHaveProperty('id');
        expect(unit).toHaveProperty('name');
        expect(unit).toHaveProperty('completionRate');
        expect(unit).toHaveProperty('understandingLevel');
        expect(unit).toHaveProperty('lessons');
        expect(Array.isArray(unit.lessons)).toBe(true);
      }
    });
  });

  describe('POST /api/lessons/submit with duration and review details', () => {
    it('should store attempt with durationSeconds and reward bonus XP if isReview is true', async () => {
      const res = await request(app)
        .post('/api/lessons/submit')
        .set('Authorization', `Bearer ${token}`)
        .send({
          questionId: '$-5 + 3$ を計算しなさい。',
          answerSubmitted: '-2',
          hintsUsed: 0,
          durationSeconds: 20,
          isReview: true
        });

      expect(res.status).toBe(200);
      expect(res.body.isCorrect).toBe(true);
      expect(res.body.xpAwarded).toBe(25); // 10 Base + 15 Review Bonus
    });
  });

  describe('GET /api/lessons/reviews', () => {
    it('should return incorrect or hint-heavy questions for review', async () => {
      // First, submit an incorrect answer to trigger review recommendation
      await request(app)
        .post('/api/lessons/submit')
        .set('Authorization', `Bearer ${token}`)
        .send({
          questionId: '$(-6) \\times (-3)$ を計算しなさい。',
          answerSubmitted: '999', // incorrect
          hintsUsed: 1,
          durationSeconds: 15
        });

      const res = await request(app)
        .get('/api/lessons/reviews')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('questions');
      expect(Array.isArray(res.body.questions)).toBe(true);
      
      const reviewQuestions = res.body.questions;
      expect(reviewQuestions.length).toBeGreaterThan(0);
      const targetReview = reviewQuestions.find((q: any) => q.id === '$(-6) \\times (-3)$ を計算しなさい。');
      expect(targetReview).toBeDefined();
      expect(targetReview.lastAttempt.isCorrect).toBe(false);
    });
  });

  describe('POST /api/lessons/hint/cache/clear', () => {
    it('should clear the hint cache successfully', async () => {
      // 1. Clear cache first to ensure a clean slate
      const initialClear = await request(app)
        .post('/api/lessons/hint/cache/clear')
        .set('Authorization', `Bearer ${token}`);
      expect(initialClear.status).toBe(200);

      // 2. Populate cache by making a hint request (Stage 1)
      const res1 = await request(app)
        .post('/api/lessons/hint')
        .set('Authorization', `Bearer ${token}`)
        .send({
          questionId: '$-5 + 3$ を計算しなさい。',
          hintsUsed: 0
        });
      expect(res1.status).toBe(200);
      expect(res1.body.fromCache).toBe(false);

      // 3. Fetch again to ensure it comes from cache
      const res2 = await request(app)
        .post('/api/lessons/hint')
        .set('Authorization', `Bearer ${token}`)
        .send({
          questionId: '$-5 + 3$ を計算しなさい。',
          hintsUsed: 0
        });
      expect(res2.status).toBe(200);
      expect(res2.body.fromCache).toBe(true);

      // 4. Clear cache via endpoint
      const clearRes = await request(app)
        .post('/api/lessons/hint/cache/clear')
        .set('Authorization', `Bearer ${token}`);
      expect(clearRes.status).toBe(200);
      expect(clearRes.body.success).toBe(true);

      // 5. Fetch again and verify fromCache is false (regenerated/missed cache)
      const res3 = await request(app)
        .post('/api/lessons/hint')
        .set('Authorization', `Bearer ${token}`)
        .send({
          questionId: '$-5 + 3$ を計算しなさい。',
          hintsUsed: 0
        });
      expect(res3.status).toBe(200);
      expect(res3.body.fromCache).toBe(false);
    });
  });
});

