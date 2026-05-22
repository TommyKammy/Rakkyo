import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from './app';
import { inMemoryState } from './repositories/inmemory/state';
import { AiTutorProviderFactory } from '@rakkyo/ai-tutor';

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'rakkyo-super-secret-key-12345';

/**
 * Regression tests for the Phase 16-A independent audit findings.
 * Each test maps to a CRIT / HIGH / MED bullet from the review.
 */
describe('Phase 16-A Hardening Regression Tests', () => {
  // Shared tokens used across this suite. They are created in beforeAll
  // so the same identities can be re-used by every test.
  let studentToken: string;
  let teacherToken: string;
  let foreignTenantTeacherToken: string;

  beforeAll(() => {
    studentToken = jwt.sign(
      { userId: 'hardening-student-id', tenantId: 'hardening-tenant-id', role: 'STUDENT' },
      JWT_SECRET
    );
    teacherToken = jwt.sign(
      { userId: 'hardening-teacher-id', tenantId: 'hardening-tenant-id', role: 'TEACHER' },
      JWT_SECRET
    );
    foreignTenantTeacherToken = jwt.sign(
      { userId: 'hardening-foreign-teacher-id', tenantId: 'other-foreign-tenant-id', role: 'TEACHER' },
      JWT_SECRET
    );

    // Seed local tenant + class + users for this suite. Isolation from the
    // existing collaborative.test.ts suite is important — they run in the
    // same process and share inMemoryState.
    inMemoryState.tenants.push({
      id: 'hardening-tenant-id',
      name: '監査再発防止テナント',
      code: 'hardening-tenant',
      plan: 'STANDARD',
      createdAt: new Date().toISOString()
    });
    inMemoryState.classes.push({
      id: 'hardening-class-id',
      tenantId: 'hardening-tenant-id',
      name: '監査再発防止クラス',
      grade: 1
    });
    inMemoryState.users.push(
      {
        id: 'hardening-student-id',
        tenantId: 'hardening-tenant-id',
        email: 'hardening-student@example.com',
        passwordHash: 'dummy',
        nickname: '監査再発防止生徒',
        role: 'STUDENT',
        schoolYear: 1,
        currentXp: 0,
        level: 1,
        streakCount: 0,
        lastActiveDate: null,
        parentalConsent: true,
        aiHintCountToday: 0,
        lastAiHintDate: null,
        abuseCount: 0,
        abuseLastAt: null,
        lockedUntil: null,
        badges: [],
        createdAt: new Date().toISOString()
      },
      {
        id: 'hardening-teacher-id',
        tenantId: 'hardening-tenant-id',
        email: 'hardening-teacher@example.com',
        passwordHash: 'dummy',
        nickname: '監査再発防止先生',
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
        createdAt: new Date().toISOString()
      },
      {
        id: 'hardening-foreign-teacher-id',
        tenantId: 'other-foreign-tenant-id',
        email: 'hardening-foreign-teacher@example.com',
        passwordHash: 'dummy',
        nickname: '外部テナント先生',
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
        createdAt: new Date().toISOString()
      }
    );
    inMemoryState.classEnrollments.push(
      {
        id: 'hardening-enroll-student',
        classId: 'hardening-class-id',
        userId: 'hardening-student-id',
        role: 'STUDENT'
      },
      {
        id: 'hardening-enroll-teacher',
        classId: 'hardening-class-id',
        userId: 'hardening-teacher-id',
        role: 'TEACHER'
      }
    );
    // Foreign teacher is enrolled into a class of THEIR tenant only.
    inMemoryState.classes.push({
      id: 'hardening-foreign-class-id',
      tenantId: 'other-foreign-tenant-id',
      name: '外部テナントクラス',
      grade: 1
    });
    inMemoryState.classEnrollments.push({
      id: 'hardening-enroll-foreign-teacher',
      classId: 'hardening-foreign-class-id',
      userId: 'hardening-foreign-teacher-id',
      role: 'TEACHER'
    });

    // Seed a battle + pool we can attack against.
    inMemoryState.bosses.push({
      id: 'hardening-boss-id',
      name: '監査再発防止ボス',
      maxHp: 1_000_000,
      attribute: 'EQUATIONS',
      durationWeeks: 1,
      createdAt: new Date().toISOString()
    });
    inMemoryState.bossBattles.push({
      id: 'hardening-battle-id',
      classId: 'hardening-class-id',
      bossId: 'hardening-boss-id',
      currentHp: 1_000_000,
      startsAt: new Date(Date.now() - 1000).toISOString(),
      endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      defeatedAt: null,
      isAlive: true,
      createdAt: new Date().toISOString()
    });
    inMemoryState.bossQuestionPools.push({
      id: 'hardening-pool-id',
      classId: 'hardening-class-id',
      questionsJson: JSON.stringify([
        {
          id: 'hardening-q1',
          prompt: '1+1は？',
          answers: ['2'],
          options: [],
          explanation: '解説',
          hints: [],
          difficulty: 5
        }
      ]),
      // Far past so a fresh /generate is allowed
      lastGeneratedAt: new Date(0).toISOString(),
      createdAt: new Date().toISOString()
    });
  });

  describe('CRIT-1: unbounded hintsUsed is rejected', () => {
    it('rejects hintsUsed > MAX_HINTS_PER_QUESTION (3) with 400', async () => {
      const res = await request(app)
        .post('/api/collaborative/boss/attack')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          questionId: 'hardening-q1',
          answerSubmitted: '2',
          hintsUsed: 999_999
        });
      expect(res.status).toBe(400);
      // Boss HP must NOT have moved.
      const battle = inMemoryState.bossBattles.find(b => b.id === 'hardening-battle-id');
      expect(battle?.currentHp).toBe(1_000_000);
    });

    it('accepts hintsUsed = MAX_HINTS_PER_QUESTION (3) with bounded damage', async () => {
      const before = inMemoryState.bossBattles.find(b => b.id === 'hardening-battle-id')!.currentHp;
      const res = await request(app)
        .post('/api/collaborative/boss/attack')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          questionId: 'hardening-q1',
          answerSubmitted: '2',
          hintsUsed: 3
        });
      expect(res.status).toBe(200);
      // damage = floor(5 * 1.5 * (1 + 3 * 0.2)) = floor(12) = 12
      expect(res.body.damage).toBe(12);
      const after = inMemoryState.bossBattles.find(b => b.id === 'hardening-battle-id')!.currentHp;
      expect(before - after).toBe(12);
    });
  });

  describe('HIGH-3: cross-tenant teacher cannot generate question pools', () => {
    it('rejects foreign-tenant teacher with 403 on /boss/pool/generate', async () => {
      const res = await request(app)
        .post('/api/collaborative/boss/pool/generate')
        .set('Authorization', `Bearer ${foreignTenantTeacherToken}`)
        .send({
          classId: 'hardening-class-id',
          attribute: 'EQUATIONS'
        });
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/クロステナント|担当教師ではありません/);
    });
  });

  describe('HIGH-3: parallel /boss/pool/generate only calls AI provider ONCE', () => {
    it('atomic claim allows exactly one of N concurrent generate requests to reach the provider', async () => {
      // Reset the pool's lastGeneratedAt to "far past" so a fresh generation is allowed.
      const pool = inMemoryState.bossQuestionPools.find(p => p.classId === 'hardening-class-id')!;
      pool.lastGeneratedAt = new Date(0).toISOString();

      // Spy on the AI provider — wrap the existing implementation.
      const provider = AiTutorProviderFactory.getProvider();
      const spy = jest.spyOn(provider, 'generateBossQuestionPool');

      const requests = Array.from({ length: 6 }, () =>
        request(app)
          .post('/api/collaborative/boss/pool/generate')
          .set('Authorization', `Bearer ${teacherToken}`)
          .send({ classId: 'hardening-class-id', attribute: 'EQUATIONS' })
      );

      const results = await Promise.all(requests);
      const okCount = results.filter(r => r.status === 200).length;
      const tooManyCount = results.filter(r => r.status === 429).length;

      // Exactly one request wins the slot; the rest receive 429.
      expect(okCount).toBe(1);
      expect(tooManyCount).toBe(results.length - 1);

      // The AI provider must have been called AT MOST once.
      expect(spy.mock.calls.length).toBeLessThanOrEqual(1);

      spy.mockRestore();
    });
  });

  describe('HIGH-4: oversized string inputs are rejected at the Zod boundary', () => {
    it('rejects questionId > 64 chars', async () => {
      const res = await request(app)
        .post('/api/collaborative/boss/attack')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          questionId: 'x'.repeat(65),
          answerSubmitted: '2',
          hintsUsed: 0
        });
      expect(res.status).toBe(400);
    });

    it('rejects battleId > 64 chars on celebration/seen', async () => {
      const res = await request(app)
        .post('/api/collaborative/boss/celebration/seen')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ battleId: 'x'.repeat(1024) });
      expect(res.status).toBe(400);
    });
  });

  describe('MED-1: non-participants can dismiss the celebration', () => {
    it('upserts a participant row with totalDamage=0 for never-attacked classmates', async () => {
      // A student who never attacked: ensure no participant row exists yet.
      const bystanderId = 'hardening-bystander-id';
      inMemoryState.users.push({
        id: bystanderId,
        tenantId: 'hardening-tenant-id',
        email: 'bystander@example.com',
        passwordHash: 'dummy',
        nickname: '見学者',
        role: 'STUDENT',
        schoolYear: 1,
        currentXp: 0,
        level: 1,
        streakCount: 0,
        lastActiveDate: null,
        parentalConsent: true,
        aiHintCountToday: 0,
        lastAiHintDate: null,
        abuseCount: 0,
        abuseLastAt: null,
        lockedUntil: null,
        badges: [],
        createdAt: new Date().toISOString()
      });
      inMemoryState.classEnrollments.push({
        id: 'hardening-enroll-bystander',
        classId: 'hardening-class-id',
        userId: bystanderId,
        role: 'STUDENT'
      });
      const bystanderToken = jwt.sign(
        { userId: bystanderId, tenantId: 'hardening-tenant-id', role: 'STUDENT' },
        JWT_SECRET
      );

      const res = await request(app)
        .post('/api/collaborative/boss/celebration/seen')
        .set('Authorization', `Bearer ${bystanderToken}`)
        .send({ battleId: 'hardening-battle-id' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const row = inMemoryState.bossBattleParticipants.find(
        p => p.userId === bystanderId && p.battleId === 'hardening-battle-id'
      );
      expect(row).toBeDefined();
      expect(row?.totalDamage).toBe(0);
      expect(row?.celebrationSeenAt).not.toBeNull();
    });
  });

  describe('A-1 atomicity: post-defeat damage is logged but does not re-fire justDefeated', () => {
    it('further attacks after defeat record participant damage with justDefeated=false', async () => {
      // Use a fresh class so we are isolated from the earlier tests that
      // may have rewritten the original class's question pool (via the
      // /boss/pool/generate mock provider).
      const isolatedClassId = 'hardening-postdefeat-class-id';
      const isolatedBattleId = 'hardening-postdefeat-battle-id';
      const isolatedQuestionId = 'hardening-postdefeat-q1';

      inMemoryState.classes.push({
        id: isolatedClassId,
        tenantId: 'hardening-tenant-id',
        name: '撃破後シナリオ用クラス',
        grade: 1
      });
      inMemoryState.classEnrollments.push({
        id: 'hardening-enroll-postdefeat-student',
        classId: isolatedClassId,
        userId: 'hardening-student-id',
        role: 'STUDENT'
      });
      inMemoryState.bossBattles.push({
        id: isolatedBattleId,
        classId: isolatedClassId,
        bossId: 'hardening-boss-id',
        currentHp: 1,
        startsAt: new Date(Date.now() - 1000).toISOString(),
        endsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        defeatedAt: null,
        isAlive: true,
        createdAt: new Date().toISOString()
      });
      inMemoryState.bossQuestionPools.push({
        id: 'hardening-postdefeat-pool-id',
        classId: isolatedClassId,
        questionsJson: JSON.stringify([
          {
            id: isolatedQuestionId,
            prompt: '1+1は？',
            answers: ['2'],
            options: [],
            explanation: '解説',
            hints: [],
            difficulty: 5
          }
        ]),
        lastGeneratedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      });

      // findEnrollment(userId, 'STUDENT') returns the FIRST matching
      // enrollment in InMemory order. The earlier tests already enrolled
      // `hardening-student-id` into `hardening-class-id`, so a generic
      // POST /boss/attack would still route to that class. We therefore
      // exercise the repository directly to assert the underlying
      // applyBossDamage atomicity (route-level routing is already
      // covered by other tests).
      const { inMemoryRepos } = require('./repositories/inmemory');

      const r1 = await inMemoryRepos.collaborative.applyBossDamage(
        'hardening-student-id',
        isolatedBattleId,
        50,
        false
      );
      expect(r1.justDefeated).toBe(true);
      expect(r1.battle.isAlive).toBe(false);

      const r2 = await inMemoryRepos.collaborative.applyBossDamage(
        'hardening-student-id',
        isolatedBattleId,
        100,
        false
      );
      expect(r2.justDefeated).toBe(false);
      expect(r2.battle.isAlive).toBe(false);

      const participant = inMemoryState.bossBattleParticipants.find(
        p => p.userId === 'hardening-student-id' && p.battleId === isolatedBattleId
      );
      expect(participant).toBeDefined();
      // First attack: 50 dmg, second attack (post-defeat): 100 dmg → 150 logged.
      expect(participant?.totalDamage).toBe(150);
    });
  });
});
