import request from 'supertest';
import app from '../app';
import { inMemoryState } from '../repositories/inmemory/state';

describe('Gamification Integration Tests', () => {
  const testPassword = 'password123';
  const testNickname = 'ゲームくん';

  const createTestUserToken = async (suffix: string) => {
    const email = `gamer_${suffix}_${Math.random().toString(36).substr(2, 9)}@rakkyo.com`;
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: email,
        password: testPassword,
        nickname: testNickname,
        schoolYear: 1,
        parentalConsent: true
      });
    return { token: regRes.body.token, userId: regRes.body.user.id };
  };

  it('should unlock "本日の大冒険" quest upon completing 3 questions in a day', async () => {
    const { token } = await createTestUserToken('adventure');

    // 1st submit
    const res1 = await request(app)
      .post('/api/lessons/submit')
      .set('Authorization', `Bearer ${token}`)
      .send({
        questionId: '$-5 + 3$ を計算しなさい。',
        answerSubmitted: '-2',
        hintsUsed: 0
      });
    expect(res1.status).toBe(200);
    expect(res1.body.questUnlocked).not.toContainEqual(expect.objectContaining({ name: '本日の大冒険 🧮' }));

    // 2nd submit
    const res2 = await request(app)
      .post('/api/lessons/submit')
      .set('Authorization', `Bearer ${token}`)
      .send({
        questionId: '$-5 + 3$ を計算しなさい。',
        answerSubmitted: '-2',
        hintsUsed: 0
      });
    expect(res2.status).toBe(200);
    expect(res2.body.questUnlocked).not.toContainEqual(expect.objectContaining({ name: '本日の大冒険 🧮' }));

    // 3rd submit
    const res3 = await request(app)
      .post('/api/lessons/submit')
      .set('Authorization', `Bearer ${token}`)
      .send({
        questionId: '$-5 + 3$ を計算しなさい。',
        answerSubmitted: '-2',
        hintsUsed: 0
      });
    expect(res3.status).toBe(200);
    expect(res3.body.questUnlocked).toContainEqual(expect.objectContaining({ name: '本日の大冒険 🧮', bonusXp: 50 }));
  });

  it('should award Grit Bonus XP (+30 XP) when correctly answering a previously incorrect question', async () => {
    const { token } = await createTestUserToken('grit');
    const questionId = '$-5 + 3$ を計算しなさい。';

    // 1. Submit incorrect answer
    const res1 = await request(app)
      .post('/api/lessons/submit')
      .set('Authorization', `Bearer ${token}`)
      .send({
        questionId,
        answerSubmitted: '99',
        hintsUsed: 1
      });
    expect(res1.status).toBe(200);
    expect(res1.body.isCorrect).toBe(false);
    expect(res1.body.xpAwarded).toBe(0);

    // 2. Submit correct answer for the same question
    const res2 = await request(app)
      .post('/api/lessons/submit')
      .set('Authorization', `Bearer ${token}`)
      .send({
        questionId,
        answerSubmitted: '-2',
        hintsUsed: 0
      });
    expect(res2.status).toBe(200);
    expect(res2.body.isCorrect).toBe(true);
    expect(res2.body.isGritBonus).toBe(true);
    expect(res2.body.xpAwarded).toBe(30); // 30 XP Grit Bonus
  });

  it('should award "完璧主義者" badge after answering 10 questions correctly in a row', async () => {
    const { token } = await createTestUserToken('perfectionist');

    let finalRes: any;
    for (let i = 0; i < 10; i++) {
      finalRes = await request(app)
        .post('/api/lessons/submit')
        .set('Authorization', `Bearer ${token}`)
        .send({
          questionId: '$-5 + 3$ を計算しなさい。',
          answerSubmitted: '-2',
          hintsUsed: 0
        });
      expect(finalRes.status).toBe(200);
      expect(finalRes.body.isCorrect).toBe(true);
    }

    expect(finalRes.body.newBadges).toContain('🌟 完璧主義者');
    expect(finalRes.body.user.badges).toContain('🌟 完璧主義者');
  });

  it('should award "ストリークの鬼" badge when user streak is 7 or more', async () => {
    const { token, userId } = await createTestUserToken('streak_demon');

    // Manually force mock database user's streak to 6, so that the next submission bumps it to 7.
    const user = inMemoryState.users.find(u => u.id === userId);
    if (user) {
      user.streakCount = 6;
      user.lastActiveDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // yesterday
    }

    const res = await request(app)
      .post('/api/lessons/submit')
      .set('Authorization', `Bearer ${token}`)
      .send({
        questionId: '$-5 + 3$ を計算しなさい。',
        answerSubmitted: '-2',
        hintsUsed: 0
      });

    expect(res.status).toBe(200);
    expect(res.body.user.streakCount).toBe(7);
    expect(res.body.newBadges).toContain('⚡ ストリークの鬼');
    expect(res.body.user.badges).toContain('⚡ ストリークの鬼');
  });

  it('should return quests progress via GET /api/lessons/quests', async () => {
    const { token } = await createTestUserToken('quests_api');

    // Initial quests progress
    const res1 = await request(app)
      .get('/api/lessons/quests')
      .set('Authorization', `Bearer ${token}`);
    expect(res1.status).toBe(200);
    expect(res1.body).toHaveLength(3);
    expect(res1.body[0].isCompleted).toBe(false); // adventure
    expect(res1.body[0].current).toBe(0);

    // Answer 1 question correctly with hint
    await request(app)
      .post('/api/lessons/submit')
      .set('Authorization', `Bearer ${token}`)
      .send({
        questionId: '$-5 + 3$ を計算しなさい。',
        answerSubmitted: '-2',
        hintsUsed: 1
      });

    // Check quests progress again
    const res2 = await request(app)
      .get('/api/lessons/quests')
      .set('Authorization', `Bearer ${token}`);
    expect(res2.status).toBe(200);
    
    // Find Grit Master quest ("粘り強さの達人 🧅")
    const gritQuest = res2.body.find((q: any) => q.id === 'grit');
    expect(gritQuest).toBeDefined();
    expect(gritQuest.isCompleted).toBe(true);

    const adventureQuest = res2.body.find((q: any) => q.id === 'adventure');
    expect(adventureQuest).toBeDefined();
    expect(adventureQuest.current).toBe(1);
    expect(adventureQuest.isCompleted).toBe(false);
  });
});
