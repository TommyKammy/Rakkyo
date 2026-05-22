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

  describe('1-hour rolling window — counter resets only after the window', () => {
    const { inMemoryRepos } = require('./repositories/inmemory');
    const studentId = 'regression-window-student';
    const opts = { windowMs: 60 * 60 * 1000, lockThreshold: 3, lockDurationMs: 24 * 60 * 60 * 1000 };

    function freshUser() {
      const existing = inMemoryState.users.findIndex(u => u.id === studentId);
      if (existing !== -1) inMemoryState.users.splice(existing, 1);
      inMemoryState.users.push({
        id: studentId,
        tenantId: 'test-tenant-id',
        email: 'regression-window@example.com',
        passwordHash: 'dummy',
        nickname: 'ウィンドウ試験生徒',
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
    }

    beforeAll(() => {
      jest.useFakeTimers();
    });

    afterAll(() => {
      jest.useRealTimers();
    });

    beforeEach(() => {
      freshUser();
    });

    it('strikes more than 1 hour apart do NOT accumulate (count resets to 1)', async () => {
      const t0 = new Date('2026-06-01T10:00:00Z');
      jest.setSystemTime(t0);

      const r1 = await inMemoryRepos.users.atomicAbuseStrike(studentId, opts);
      expect(r1.newCount).toBe(1);
      expect(r1.isLocked).toBe(false);

      // Advance 90 minutes — comfortably past the 60-min window
      jest.setSystemTime(new Date(t0.getTime() + 90 * 60 * 1000));

      const r2 = await inMemoryRepos.users.atomicAbuseStrike(studentId, opts);
      expect(r2.newCount).toBe(1); // RESET, not 2
      expect(r2.isLocked).toBe(false);
    });

    it('strikes within 1 hour accumulate and trigger lock at threshold', async () => {
      const t0 = new Date('2026-06-01T10:00:00Z');
      jest.setSystemTime(t0);

      const r1 = await inMemoryRepos.users.atomicAbuseStrike(studentId, opts);
      expect(r1.newCount).toBe(1);

      jest.setSystemTime(new Date(t0.getTime() + 30 * 60 * 1000));
      const r2 = await inMemoryRepos.users.atomicAbuseStrike(studentId, opts);
      expect(r2.newCount).toBe(2);
      expect(r2.isLocked).toBe(false);

      jest.setSystemTime(new Date(t0.getTime() + 50 * 60 * 1000));
      const r3 = await inMemoryRepos.users.atomicAbuseStrike(studentId, opts);
      expect(r3.newCount).toBe(3);
      expect(r3.isLocked).toBe(true);
      expect(r3.justLocked).toBe(true);
    });

    it('two strikes within window then a third just past the window does NOT lock (drip pattern)', async () => {
      const t0 = new Date('2026-06-01T10:00:00Z');
      jest.setSystemTime(t0);
      const r1 = await inMemoryRepos.users.atomicAbuseStrike(studentId, opts);
      expect(r1.newCount).toBe(1);

      jest.setSystemTime(new Date(t0.getTime() + 30 * 60 * 1000));
      const r2 = await inMemoryRepos.users.atomicAbuseStrike(studentId, opts);
      expect(r2.newCount).toBe(2);

      // 3rd strike 61 minutes after the LAST strike — outside the window
      jest.setSystemTime(new Date(t0.getTime() + 91 * 60 * 1000));
      const r3 = await inMemoryRepos.users.atomicAbuseStrike(studentId, opts);
      expect(r3.newCount).toBe(1); // window reset; the slow drip does NOT lock
      expect(r3.isLocked).toBe(false);
    });

    it('a 24-hour lock expires and a fresh strike begins a new count', async () => {
      const t0 = new Date('2026-06-01T10:00:00Z');
      jest.setSystemTime(t0);

      // Trip the lock with 3 strikes inside the window
      await inMemoryRepos.users.atomicAbuseStrike(studentId, opts);
      jest.setSystemTime(new Date(t0.getTime() + 10 * 60 * 1000));
      await inMemoryRepos.users.atomicAbuseStrike(studentId, opts);
      jest.setSystemTime(new Date(t0.getTime() + 20 * 60 * 1000));
      const lockResult = await inMemoryRepos.users.atomicAbuseStrike(studentId, opts);
      expect(lockResult.isLocked).toBe(true);

      // Still locked 23h59m later
      jest.setSystemTime(new Date(t0.getTime() + 20 * 60 * 1000 + 23 * 60 * 60 * 1000 + 59 * 60 * 1000));
      const stillLocked = await inMemoryRepos.users.atomicAbuseStrike(studentId, opts);
      expect(stillLocked.isLocked).toBe(true);
      expect(stillLocked.justLocked).toBe(false);

      // Advance past 24h+1min after the lock was set → lock has expired,
      // counter should be allowed to accumulate from 1 again
      jest.setSystemTime(new Date(t0.getTime() + 20 * 60 * 1000 + 24 * 60 * 60 * 1000 + 60 * 1000));
      const fresh = await inMemoryRepos.users.atomicAbuseStrike(studentId, opts);
      expect(fresh.isLocked).toBe(false);
      expect(fresh.newCount).toBe(1);
    });
  });

  describe('atomicAbuseStrike — concurrent strikes lock exactly once', () => {
    const { inMemoryRepos } = require('./repositories/inmemory');
    const studentId = 'regression-toctou-student';

    beforeEach(() => {
      // Reset target user state so each test starts with a clean counter.
      const existing = inMemoryState.users.findIndex(u => u.id === studentId);
      if (existing !== -1) inMemoryState.users.splice(existing, 1);
      inMemoryState.users.push({
        id: studentId,
        tenantId: 'test-tenant-id',
        email: 'regression-toctou@example.com',
        passwordHash: 'dummy',
        nickname: 'TOCTOU 試験生徒',
        role: 'STUDENT',
        schoolYear: 1,
        currentXp: 0,
        level: 1,
        streakCount: 0,
        lastActiveDate: null,
        parentalConsent: true,
        aiHintCountToday: 0,
        lastAiHintDate: null,
        abuseCount: 2, // Pre-loaded — next strike WOULD lock
        abuseLastAt: new Date().toISOString(),
        lockedUntil: null,
        badges: [],
        createdAt: new Date().toISOString(),
      });
    });

    it('fires justLocked exactly once across concurrent strikes', async () => {
      const opts = { windowMs: 60 * 60 * 1000, lockThreshold: 3, lockDurationMs: 24 * 60 * 60 * 1000 };

      // Fire many strikes concurrently. Only the strike that flips the
      // user into the locked state should report justLocked=true; the
      // others must see the existing lock without re-firing notifications.
      const results = await Promise.all(
        Array.from({ length: 8 }, () => inMemoryRepos.users.atomicAbuseStrike(studentId, opts))
      );

      const justLockedCount = results.filter((r: any) => r.justLocked).length;
      expect(justLockedCount).toBe(1);

      // Every result should observe the user as locked
      expect(results.every((r: any) => r.isLocked)).toBe(true);
    });

    it('does not increment counters for an already-locked user', async () => {
      const opts = { windowMs: 60 * 60 * 1000, lockThreshold: 3, lockDurationMs: 24 * 60 * 60 * 1000 };

      // Pre-lock the user
      const user = inMemoryState.users.find(u => u.id === studentId)!;
      user.abuseCount = 0;
      user.lockedUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      const result = await inMemoryRepos.users.atomicAbuseStrike(studentId, opts);
      expect(result.isLocked).toBe(true);
      expect(result.justLocked).toBe(false);

      // The counter must NOT have moved
      const after = inMemoryState.users.find(u => u.id === studentId)!;
      expect(after.abuseCount).toBe(0);
    });
  });

  describe('Right-to-Be-Forgotten covers SafetyAlert rows', () => {
    const studentId = 'regression-rtbf-safety-alert-student';
    let studentToken: string;

    beforeAll(() => {
      inMemoryState.users.push({
        id: studentId,
        tenantId: 'test-tenant-id',
        email: 'regression-rtbf-safety@example.com',
        passwordHash: 'dummy',
        nickname: 'RTBF テスト生徒',
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
      // Pre-existing safety alerts for this child
      inMemoryState.safetyAlerts.push(
        {
          id: 'alert_rtbf_1',
          childUserId: studentId,
          alertType: 'ABUSE_HARD_LOCK',
          payload: JSON.stringify({ source: 'hint' }),
          status: 'QUEUED',
          createdAt: new Date().toISOString(),
          sentAt: null,
        },
        {
          id: 'alert_rtbf_2',
          childUserId: studentId,
          alertType: 'ABUSE_HARD_LOCK',
          payload: JSON.stringify({ source: 'hirameki' }),
          status: 'SENT',
          createdAt: new Date().toISOString(),
          sentAt: new Date().toISOString(),
        }
      );
      // Plant a safety alert belonging to a DIFFERENT user, which MUST survive
      inMemoryState.safetyAlerts.push({
        id: 'alert_rtbf_unrelated',
        childUserId: 'some-other-user',
        alertType: 'ABUSE_HARD_LOCK',
        payload: '{}',
        status: 'QUEUED',
        createdAt: new Date().toISOString(),
        sentAt: null,
      });
      studentToken = jwt.sign(
        { userId: studentId, tenantId: 'test-tenant-id', role: 'STUDENT' },
        JWT_SECRET
      );
    });

    it('DELETE /api/users/me/data wipes the user\'s SafetyAlert rows without touching others', async () => {
      // Sanity: both of this user's alerts exist
      const before = inMemoryState.safetyAlerts.filter(a => a.childUserId === studentId);
      expect(before.length).toBe(2);

      const res = await request(app)
        .delete('/api/users/me/data')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // All of THIS user's safety alerts gone
      const remaining = inMemoryState.safetyAlerts.filter(a => a.childUserId === studentId);
      expect(remaining.length).toBe(0);

      // Unrelated user's safety alert MUST still exist
      const unrelated = inMemoryState.safetyAlerts.find(a => a.id === 'alert_rtbf_unrelated');
      expect(unrelated).toBeDefined();
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
