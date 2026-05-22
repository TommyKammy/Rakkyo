import request from 'supertest';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import app from './app';
import { inMemoryState } from './repositories/inmemory/state';
import { repositoryMiddleware } from './middlewares/repository';
import { authMiddleware } from './middlewares/auth';
import { Request, Response } from 'express';

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'rakkyo-super-secret-key-12345';
const CELEBRATION_HMAC_SECRET =
  process.env.CELEBRATION_HMAC_SECRET || 'rakkyo-dev-celebration-hmac-insecure';

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

describe('Phase 15.5 Security Hardening — regression tests', () => {
  describe('repositoryMiddleware blocks x-mock-db in production', () => {
    const originalEnv = process.env.NODE_ENV;
    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('in production, x-mock-db header MUST be ignored and prismaRepos assigned', () => {
      // Set production. We do not actually call Prisma so this is safe.
      process.env.NODE_ENV = 'production';
      const req: any = { headers: { 'x-mock-db': 'true' } };
      const res = mockRes();
      const next = jest.fn();

      repositoryMiddleware(req as Request, res, next);

      expect(req.isMock).toBe(false);
      // In production, repos MUST be prismaRepos, never the seeded InMemory store
      const { prismaRepos } = require('./repositories/prisma');
      expect(req.repos).toBe(prismaRepos);
      expect(next).toHaveBeenCalled();
    });

    it('in development, x-mock-db: true still flips to InMemory', () => {
      process.env.NODE_ENV = 'development';
      const req: any = { headers: { 'x-mock-db': 'true' } };
      const res = mockRes();
      const next = jest.fn();

      repositoryMiddleware(req as Request, res, next);

      expect(req.isMock).toBe(true);
      const { inMemoryRepos } = require('./repositories/inmemory');
      expect(req.repos).toBe(inMemoryRepos);
    });
  });

  describe('authMiddleware does NOT silently fall back to InMemory on Prisma errors', () => {
    it('returns 500 instead of switching repos when DB lookup throws', async () => {
      const studentId = 'regression-prisma-error-student';
      const token = jwt.sign({ userId: studentId, tenantId: 'test-tenant-id', role: 'STUDENT' }, JWT_SECRET);

      const throwingRepos = {
        users: {
          findById: jest.fn().mockRejectedValue(new Error('Prisma connection refused')),
        },
      };

      const req: any = {
        headers: { authorization: `Bearer ${token}` },
        repos: throwingRepos,
      };
      const res = mockRes();
      const next = jest.fn();

      await authMiddleware(req as Request, res, next);

      expect(throwingRepos.users.findById).toHaveBeenCalledWith(studentId);
      expect(next).not.toHaveBeenCalled();
      expect((res.status as jest.Mock).mock.calls[0][0]).toBe(500);
      const body = (res.json as jest.Mock).mock.calls[0][0];
      // Critically: must NOT contain user data from any InMemory seed user
      expect(body.user).toBeUndefined();
      expect(body.token).toBeUndefined();
    });

    it('returns 500 when invoked without repositoryMiddleware (req.repos undefined)', async () => {
      const studentId = 'regression-no-repos-student';
      const token = jwt.sign({ userId: studentId, tenantId: 'test-tenant-id', role: 'STUDENT' }, JWT_SECRET);

      const req: any = {
        headers: { authorization: `Bearer ${token}` },
        // repos intentionally not set
      };
      const res = mockRes();
      const next = jest.fn();

      await authMiddleware(req as Request, res, next);

      expect(next).not.toHaveBeenCalled();
      expect((res.status as jest.Mock).mock.calls[0][0]).toBe(500);
    });
  });

  describe('Abuse hard-lock — clean-input bypass is closed', () => {
    const studentId = 'regression-bypass-student';
    let studentToken: string;

    beforeAll(() => {
      inMemoryState.users.push({
        id: studentId,
        tenantId: 'test-tenant-id',
        email: 'regression-bypass@example.com',
        passwordHash: 'dummy',
        nickname: 'リグレッション太郎',
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
        createdAt: new Date().toISOString(),
      });
      inMemoryState.classEnrollments.push({
        id: 'enroll-regression-bypass',
        classId: 'test-class-id',
        userId: studentId,
        role: 'STUDENT',
      });
      studentToken = jwt.sign(
        { userId: studentId, tenantId: 'test-tenant-id', role: 'STUDENT' },
        JWT_SECRET
      );
    });

    it('does NOT reset the counter on a clean follow-up question (3 abuses → lock even with clean ones interleaved)', async () => {
      const abuse = (q: string) =>
        request(app)
          .post('/api/lessons/hint')
          .set('Authorization', `Bearer ${studentToken}`)
          .send({ questionId: '$-5 + 3$ を計算しなさい。', hintsUsed: 0, userQuestion: q });

      const clean = () =>
        request(app)
          .post('/api/lessons/hint')
          .set('Authorization', `Bearer ${studentToken}`)
          .send({
            questionId: '$-5 + 3$ を計算しなさい。',
            hintsUsed: 0,
            userQuestion: 'これってどうやって解くんですか？',
          });

      // Abuse 1
      const r1 = await abuse('お前はばかだ');
      expect(r1.body.warningCount).toBe(1);

      // Clean input — MUST NOT reset the counter
      const c1 = await clean();
      expect(c1.body.isAbusive).toBeFalsy();

      // Abuse 2
      const r2 = await abuse('死ね');
      expect(r2.body.warningCount).toBe(2);

      // Another clean input
      const c2 = await clean();
      expect(c2.body.isAbusive).toBeFalsy();

      // Abuse 3 — counter must persist and trigger the lock here
      const r3 = await abuse('ばか野郎');
      expect(r3.body.locked).toBe(true);

      const stored = inMemoryState.users.find(u => u.id === studentId);
      expect(stored?.lockedUntil).toBeDefined();
      expect(new Date(stored!.lockedUntil!).getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('Hirameki posts contribute to the same abuse counter', () => {
    const studentId = 'regression-hirameki-bypass-student';
    let studentToken: string;

    beforeAll(() => {
      inMemoryState.users.push({
        id: studentId,
        tenantId: 'test-tenant-id',
        email: 'regression-hirameki@example.com',
        passwordHash: 'dummy',
        nickname: 'ひらめき荒らし',
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
        createdAt: new Date().toISOString(),
      });
      inMemoryState.classEnrollments.push({
        id: 'enroll-regression-hirameki',
        classId: 'test-class-id',
        userId: studentId,
        role: 'STUDENT',
      });
      studentToken = jwt.sign(
        { userId: studentId, tenantId: 'test-tenant-id', role: 'STUDENT' },
        JWT_SECRET
      );
    });

    it('abuse via /hirameki increments the same counter as /lessons/hint and locks at 3', async () => {
      const hiramekiAbuse = () =>
        request(app)
          .post('/api/collaborative/hirameki')
          .set('Authorization', `Bearer ${studentToken}`)
          .send({ content: '死ね、ばか、ふざけるな' });

      const hintAbuse = () =>
        request(app)
          .post('/api/lessons/hint')
          .set('Authorization', `Bearer ${studentToken}`)
          .send({ questionId: '$-5 + 3$ を計算しなさい。', hintsUsed: 0, userQuestion: 'お前はばかだ' });

      // 1st strike via Hirameki
      const r1 = await hiramekiAbuse();
      expect(r1.status).toBe(400);
      expect(r1.body.warningCount).toBe(1);

      // 2nd strike via hint route — shares the counter
      const r2 = await hintAbuse();
      expect(r2.body.warningCount).toBe(2);

      // 3rd strike back via Hirameki — should now lock
      const r3 = await hiramekiAbuse();
      expect(r3.status).toBe(403);
      expect(r3.body.error).toBe('safety_lock');

      const stored = inMemoryState.users.find(u => u.id === studentId);
      expect(stored?.lockedUntil).toBeDefined();
      expect(new Date(stored!.lockedUntil!).getTime()).toBeGreaterThan(Date.now());

      // SafetyAlert MUST be queued for the parent notification worker
      const alerts = inMemoryState.safetyAlerts.filter(a => a.childUserId === studentId);
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].alertType).toBe('ABUSE_HARD_LOCK');
      expect(alerts[0].status).toBe('QUEUED');
    });
  });

  describe('Celebration HMAC token — payload tampering is rejected', () => {
    function makePayload(overrides: Partial<{ childId: string; attemptId: string; random: string; createdAt: number; expiresAt: number }> = {}) {
      return {
        childId: 'test-student-id',
        attemptId: 'attempt_seed_4',
        random: crypto.randomBytes(8).toString('hex'),
        createdAt: Date.now(),
        expiresAt: Date.now() + 14 * 24 * 60 * 60 * 1000,
        ...overrides,
      };
    }

    function sign(payload: object): string {
      const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const sig = crypto.createHmac('sha256', CELEBRATION_HMAC_SECRET).update(b64).digest('base64url');
      return `${b64}.${sig}`;
    }

    it('rejects a token whose payload has been mutated after signing', async () => {
      const original = makePayload();
      const validToken = sign(original);

      // Attacker decodes, mutates expiresAt to lengthen the token, re-encodes,
      // but reuses the ORIGINAL signature (because they don't have the secret).
      const tampered = { ...original, expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000 };
      const tamperedB64 = Buffer.from(JSON.stringify(tampered)).toString('base64url');
      const validSig = validToken.split('.')[1];
      const forgedToken = `${tamperedB64}.${validSig}`;

      const res = await request(app).get(`/api/collaborative/celebration/${forgedToken}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('お祝いリンクの署名が無効です');
    });

    it('treats the payload expiresAt as authoritative (DB row alone cannot extend a token)', async () => {
      // Token says expired in the past, but we plant a DB row claiming it is still valid.
      const expiredPayload = makePayload({
        expiresAt: Date.now() - 1000,
      });
      const expiredToken = sign(expiredPayload);

      // Seed inMemoryState with a celebration whose DB expiresAt is in the FUTURE.
      inMemoryState.parentalCelebrations.push({
        id: 'celeb_tamper_db_extend',
        childId: expiredPayload.childId,
        attemptId: expiredPayload.attemptId,
        token: expiredToken,
        parentStamp: null,
        parentComment: null,
        isResponded: false,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Even though the DB row is "fresh", the route MUST honor the token's signed expiresAt.
      const getRes = await request(app).get(`/api/collaborative/celebration/${expiredToken}`);
      expect(getRes.status).toBe(400);
      expect(getRes.body.error).toBe('お祝いリンクの有効期限が切れています');
    });
  });
});
