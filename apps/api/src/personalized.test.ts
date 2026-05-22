import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from './app';
import { mockDb } from './mockDb';

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'rakkyo-super-secret-key-12345';

describe('Phase-11 Hyper-Personalized AI & Recommendations Integration Tests', () => {
  let token: string;

  beforeAll(() => {
    // Generate valid test JWT token for 'test-student-id'
    token = jwt.sign(
      { userId: 'test-student-id', tenantId: 'test-tenant-id', role: 'STUDENT' },
      JWT_SECRET
    );
  });

  describe('1. Precise Mistake Diagnosis (POST /api/lessons/submit)', () => {
    it('should diagnose incorrect answers and record AI diagnosis details in Attempt', async () => {
      // Prompt is "$x = -3$ のとき、式 $5x + 4$ の値を求めなさい。" (Answer: -11)
      // We submit an incorrect answer "-15"
      const res = await request(app)
        .post('/api/lessons/submit')
        .set('Authorization', `Bearer ${token}`)
        .send({
          questionId: '$x = -3$ のとき、式 $5x + 4$ の値を求めなさい。', // Exists in fallback curriculums
          answerSubmitted: '-15',
          hintsUsed: 0,
          isCorrect: false // Signal incorrect
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('isCorrect', false);
      expect(res.body).toHaveProperty('errorType');
      expect(res.body).toHaveProperty('aiDiagnosis');
      
      // Verification of mock fallback values or structure
      expect(typeof res.body.aiDiagnosis).toBe('string');
      expect(res.body.aiDiagnosis.length).toBeGreaterThan(0);
      expect(['careless_mistake', 'conceptual_error']).toContain(res.body.errorType);
    });
  });

  describe('2. Socratic Prompt Injection (POST /api/lessons/hint)', () => {
    it('should inject Socratic guidance prompts when hint count hits threshold (hintsUsed >= 2)', async () => {
      // Call for 3rd stage hint (hintsUsed: 2 -> nextStage: 3)
      const res = await request(app)
        .post('/api/lessons/hint')
        .set('Authorization', `Bearer ${token}`)
        .send({
          questionId: '$x = -3$ のとき、式 $5x + 4$ の値を求めなさい。',
          hintsUsed: 2
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('hintText');
      expect(res.body).toHaveProperty('stage', 3);
      
      // Confirm the returned hint is a Socratic question rather than a direct formula or answer
      const hint = res.body.hintText;
      expect(typeof hint).toBe('string');
      // Socratic prompt should ask student rather than directly teaching
      expect(
        hint.includes('？') || 
        hint.includes('かな') || 
        hint.includes('どうなる') || 
        hint.includes('考えてみよう')
      ).toBe(true);
    });
  });

  describe('3. Personalized Dynamic Similar Question Generation (POST /api/lessons/recommend-similar)', () => {
    it('should generate a personalized similar question with isDynamic flag set to true', async () => {
      const res = await request(app)
        .post('/api/lessons/recommend-similar')
        .set('Authorization', `Bearer ${token}`)
        .send({
          questionId: '$x = -3$ のとき、式 $5x + 4$ の値を求めなさい。'
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('prompt');
      expect(res.body).toHaveProperty('answers');
      expect(res.body).toHaveProperty('explanation');
      expect(res.body).toHaveProperty('isDynamic', true);
      
      // Checking that it's stored in mockDb's dynamic questions registry
      const storedQ = mockDb.findDynamicQuestion(res.body.id);
      expect(storedQ).toBeDefined();
      expect(storedQ?.isDynamic).toBe(true);
    });
  });

  describe('4. Autonomous Lesson Recommendations (GET /api/lessons/recommendations)', () => {
    it('should return personalized lesson recommendation with encouraging reason in Rakkyo-kun tone', async () => {
      const res = await request(app)
        .get('/api/lessons/recommendations')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('recommendedLessonId');
      expect(res.body).toHaveProperty('recommendedLessonName');
      expect(res.body).toHaveProperty('reason');
      
      const reason = res.body.reason;
      expect(typeof reason).toBe('string');
      expect(reason.length).toBeGreaterThan(0);
      // Encourage check: containing friendly Japanese grammar or onion emojis
      expect(
        reason.includes('🧅') || 
        reason.includes('だよ') || 
        reason.includes('こう') || 
        reason.includes('がんば')
      ).toBe(true);
    });
  });
});
