import request from 'supertest';
import app from '../app';
import { inMemoryState } from '../repositories/inmemory/state';
import { storageService } from '../services/StorageService';
import { inMemoryRepos } from '../repositories/inmemory';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'rakkyo-super-secret-key-12345';

describe('AI Avatar Maker Integration Tests (Phase 16-B)', () => {
  let studentSchoolToken: string;
  let teacherSchoolToken: string;
  let studentB2CWithParentToken: string;
  let studentB2CNoParentToken: string;
  let parentB2CToken: string;
  let teacherOtherToken: string;

  const schoolTenantId = 'tenant-school';
  const otherTenantId = 'tenant-other';
  const studentSchoolId = 'student-school-id';
  const teacherSchoolId = 'teacher-school-id';
  const studentB2CWithParentId = 'student-b2c-with-parent-id';
  const studentB2CNoParentId = 'student-b2c-no-parent-id';
  const parentB2CId = 'parent-b2c-id';
  const teacherOtherId = 'teacher-other-id';
  const classId = 'class-school-id';

  beforeEach(() => {
    // Clear in-memory database and storage simulator
    inMemoryState.reset();
    storageService.clearAll();

    // Seed school tenant
    inMemoryState.tenants.push({
      id: schoolTenantId,
      name: 'ラッキョスクール',
      code: 'school-juku',
      plan: 'PREMIUM',
      createdAt: new Date().toISOString()
    });

    // Seed other tenant
    inMemoryState.tenants.push({
      id: otherTenantId,
      name: '別スクール',
      code: 'other-juku',
      plan: 'PREMIUM',
      createdAt: new Date().toISOString()
    });

    // Seed users
    inMemoryState.users.push(
      {
        id: studentSchoolId,
        tenantId: schoolTenantId,
        email: 'student-school@example.com',
        passwordHash: 'hashed',
        nickname: 'スクール生徒',
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
        id: teacherSchoolId,
        tenantId: schoolTenantId,
        email: 'teacher-school@example.com',
        passwordHash: 'hashed',
        nickname: 'スクール先生',
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
        id: studentB2CWithParentId,
        tenantId: 'default-b2c',
        email: 'student-b2c-parent@example.com',
        passwordHash: 'hashed',
        nickname: 'B2C生徒・保護者あり',
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
        id: studentB2CNoParentId,
        tenantId: 'default-b2c',
        email: 'student-b2c-noparent@example.com',
        passwordHash: 'hashed',
        nickname: 'B2C生徒・保護者なし',
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
        id: parentB2CId,
        tenantId: 'default-b2c',
        email: 'parent-b2c@example.com',
        passwordHash: 'hashed',
        nickname: 'B2C保護者',
        role: 'PARENT',
        schoolYear: 0,
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
        id: teacherOtherId,
        tenantId: otherTenantId,
        email: 'teacher-other@example.com',
        passwordHash: 'hashed',
        nickname: '他校先生',
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

    // Seed parent-child relation
    inMemoryState.parentChildRelations.push({
      id: 'pcr-1',
      parentId: parentB2CId,
      childId: studentB2CWithParentId,
      createdAt: new Date().toISOString()
    });

    // Seed classes & enrollments
    inMemoryState.classes.push({
      id: classId,
      tenantId: schoolTenantId,
      name: '数学特訓クラス',
      grade: 1
    });

    inMemoryState.classEnrollments.push(
      {
        id: 'enroll-student',
        classId: classId,
        userId: studentSchoolId,
        role: 'STUDENT'
      },
      {
        id: 'enroll-teacher',
        classId: classId,
        userId: teacherSchoolId,
        role: 'TEACHER'
      }
    );

    // Generate JWT tokens
    studentSchoolToken = jwt.sign({ userId: studentSchoolId, tenantId: schoolTenantId, role: 'STUDENT' }, JWT_SECRET);
    teacherSchoolToken = jwt.sign({ userId: teacherSchoolId, tenantId: schoolTenantId, role: 'TEACHER' }, JWT_SECRET);
    studentB2CWithParentToken = jwt.sign({ userId: studentB2CWithParentId, tenantId: 'default-b2c', role: 'STUDENT' }, JWT_SECRET);
    studentB2CNoParentToken = jwt.sign({ userId: studentB2CNoParentId, tenantId: 'default-b2c', role: 'STUDENT' }, JWT_SECRET);
    parentB2CToken = jwt.sign({ userId: parentB2CId, tenantId: 'default-b2c', role: 'PARENT' }, JWT_SECRET);
    teacherOtherToken = jwt.sign({ userId: teacherOtherId, tenantId: otherTenantId, role: 'TEACHER' }, JWT_SECRET);
  });

  describe('B-1. Zod Whitelist & Prompt Injection Shield', () => {
    const validParams = {
      baseVegetable: 'CARROT',
      mainColor: 'ORANGE',
      facialFeatures: 'SMILING_EYES',
      clothing: 'RED_BOWTIE',
      expression: 'HAPPY'
    };

    it('should reject invalid categories outside the whitelist (e.g. POTATO)', async () => {
      const res = await request(app)
        .post('/api/avatars/generate')
        .set('Authorization', `Bearer ${studentSchoolToken}`)
        .send({ ...validParams, baseVegetable: 'POTATO' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('無効なパラメータ');
    });

    it('should reject control characters or SQL injection strings', async () => {
      const injectionStr = "CARROT; DROP TABLE \"Avatar\"; --";
      const res = await request(app)
        .post('/api/avatars/generate')
        .set('Authorization', `Bearer ${studentSchoolToken}`)
        .send({ ...validParams, baseVegetable: injectionStr });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('無効なパラメータ');
    });

    it('should successfully create avatar candidates with valid whitelisted items', async () => {
      const res = await request(app)
        .post('/api/avatars/generate')
        .set('Authorization', `Bearer ${studentSchoolToken}`)
        .send(validParams);

      expect(res.status).toBe(201);
      expect(res.body.candidates).toHaveLength(3);
      expect(res.body.candidates[0]).toHaveProperty('id');
      expect(res.body.candidates[0]).toHaveProperty('previewUrl');
    });
  });

  describe('B-2. Weekly Quota Concurrent TOCTOU Prevention', () => {
    const validParams = {
      baseVegetable: 'TURNIP',
      mainColor: 'WHITE',
      facialFeatures: 'BIG_EYES',
      clothing: 'STRAW_HAT',
      expression: 'CURIOUS'
    };

    it('should strictly limit weekly generation count to 3, rejecting remaining concurrent requests with 429', async () => {
      // Fire 8 concurrent requests to simulate rapid double-clicking or scripting
      const requests = Array.from({ length: 8 }).map(() =>
        request(app)
          .post('/api/avatars/generate')
          .set('Authorization', `Bearer ${studentSchoolToken}`)
          .send(validParams)
      );

      const responses = await Promise.all(requests);

      const successes = responses.filter(r => r.status === 201);
      const rateLimited = responses.filter(r => r.status === 429);

      // Exactly 3 must succeed, and exactly 5 must be rate-limited
      expect(successes).toHaveLength(3);
      expect(rateLimited).toHaveLength(5);

      rateLimited.forEach(res => {
        expect(res.body.error).toContain('上限');
      });

      // Verify that the user quota record in state is exactly 3
      const quota = inMemoryState.avatarQuotas.find(q => q.userId === studentSchoolId);
      expect(quota).toBeDefined();
      expect(quota?.count).toBe(3);
    });
  });

  describe('B-3. Expired Signed URL and userId Non-Exposure', () => {
    let previewUrl: string;

    beforeEach(async () => {
      // Generate avatar candidates to get preview URL
      const res = await request(app)
        .post('/api/avatars/generate')
        .set('Authorization', `Bearer ${studentSchoolToken}`)
        .send({
          baseVegetable: 'RAKKYO',
          mainColor: 'WHITE',
          facialFeatures: 'ROSY_CHEEKS',
          clothing: 'NONE',
          expression: 'SMILING'
        });
      
      previewUrl = res.body.candidates[0].previewUrl;
    });

    it('should serve raw image under opaque keys and signed token without revealing userId', async () => {
      // Confirm that the signed preview URL does not leak the userId
      expect(previewUrl).not.toContain(studentSchoolId);
      expect(previewUrl).toContain('/api/avatars/raw/');

      // Request using the valid signed URL
      const res = await request(app).get(previewUrl);
      expect(res.status).toBe(200);
      expect(res.header['content-type']).toBe('image/png');
      expect(res.body).toBeDefined();
    });

    it('should reject requests to raw image if the token is tampered with', async () => {
      const tamperedUrl = previewUrl.replace(/token=.{4}/, 'token=aaaa');
      const res = await request(app).get(tamperedUrl);
      expect(res.status).toBe(403);
      expect(res.body.error).toContain('無効な、あるいは期限切れ');
    });

    it('should reject requests to raw image if the token has expired', async () => {
      // Spy on Date.now to fast forward 6 minutes into the future (tokens expire in 5 minutes)
      const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => Date.now() + 6 * 60 * 1000);

      const res = await request(app).get(previewUrl);
      expect(res.status).toBe(403);
      expect(res.body.error).toContain('無効な、あるいは期限切れ');

      nowSpy.mockRestore();
    });
  });

  describe('B-4. B2C Parent Relation Gate', () => {
    const params = {
      baseVegetable: 'TOMATO',
      mainColor: 'RED',
      facialFeatures: 'SMILING_EYES',
      clothing: 'HERO_CAPE',
      expression: 'GENKI'
    };

    it('should block B2C student accounts from requesting generation if they have no parent relations', async () => {
      const res = await request(app)
        .post('/api/avatars/generate')
        .set('Authorization', `Bearer ${studentB2CNoParentToken}`)
        .send(params);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Parent relation required');
    });

    it('should allow B2C student accounts to generate avatars if they have a linked parent', async () => {
      const res = await request(app)
        .post('/api/avatars/generate')
        .set('Authorization', `Bearer ${studentB2CWithParentToken}`)
        .send(params);

      expect(res.status).toBe(201);
    });
  });

  describe('B-5. HMAC Shared Link Verification & Strict One-Time Consumption', () => {
    let avatarId: string;
    let shareToken: string;
    let shareUrl: string;

    beforeEach(async () => {
      // 1. Create a pending candidate avatar
      const resGen = await request(app)
        .post('/api/avatars/generate')
        .set('Authorization', `Bearer ${studentB2CWithParentToken}`)
        .send({
          baseVegetable: 'ONION',
          mainColor: 'YELLOW',
          facialFeatures: 'SMILING_EYES',
          clothing: 'RAINBOW_SCARF',
          expression: 'HAPPY'
        });
      
      avatarId = resGen.body.candidates[0].id;

      // 2. Generate a sharing link
      const resShare = await request(app)
        .get(`/api/avatars/${avatarId}/share`)
        .set('Authorization', `Bearer ${studentB2CWithParentToken}`);
      
      shareToken = resShare.body.token;
      shareUrl = resShare.body.shareUrl;
    });

    it('should fetch pending avatar information with a valid share token', async () => {
      const res = await request(app).get(shareUrl);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(avatarId);
      expect(res.body.status).toBe('PENDING');
      expect(res.body.previewUrl).toBeDefined();
    });

    it('should reject fetching info if the sharing token is tampered', async () => {
      const tamperedUrl = shareUrl.replace(shareToken, shareToken + 'X');
      const res = await request(app).get(tamperedUrl);
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('無効な署名です');
    });

    it('should strictly allow approving once and block subsequent reuse', async () => {
      // 1st approve - should succeed
      const resApprove1 = await request(app).post(`/api/avatars/shared/approve/${shareToken}`);
      expect(resApprove1.status).toBe(200);
      expect(resApprove1.body.success).toBe(true);

      // Verify state changed to APPROVED
      const avatar = inMemoryState.avatars.find(a => a.id === avatarId);
      expect(avatar?.status).toBe('APPROVED');

      // 2nd approve - should fail as one-time link is already consumed
      const resApprove2 = await request(app).post(`/api/avatars/shared/approve/${shareToken}`);
      expect(resApprove2.status).toBe(400);
      expect(resApprove2.body.error).toContain('すでに処理');

      // Also try rejecting consumed token - should fail
      const resReject = await request(app)
        .post(`/api/avatars/shared/reject/${shareToken}`)
        .send({ reason: '気に入らなかった' });
      expect(resReject.status).toBe(400);
      expect(resReject.body.error).toContain('すでに処理');
    });

    it('should strictly allow rejecting once and block subsequent reuse', async () => {
      // 1st reject - should succeed
      const resReject1 = await request(app)
        .post(`/api/avatars/shared/reject/${shareToken}`)
        .send({ reason: '気に入らなかった' });
      expect(resReject1.status).toBe(200);
      expect(resReject1.body.success).toBe(true);

      // Verify state changed to REJECTED
      const avatar = inMemoryState.avatars.find(a => a.id === avatarId);
      expect(avatar?.status).toBe('REJECTED');
      expect(avatar?.rejectionReason).toBe('気に入らなかった');

      // 2nd reject - should fail
      const resReject2 = await request(app)
        .post(`/api/avatars/shared/reject/${shareToken}`)
        .send({ reason: '気に入らなかった' });
      expect(resReject2.status).toBe(400);
      expect(resReject2.body.error).toContain('すでに処理');
    });
  });

  describe('B-6. Cross-Tenant Isolation & Human Moderation Audits', () => {
    let avatarId: string;

    beforeEach(async () => {
      // Generate a pending avatar for school-tenant student
      const res = await request(app)
        .post('/api/avatars/generate')
        .set('Authorization', `Bearer ${studentSchoolToken}`)
        .send({
          baseVegetable: 'CARROT',
          mainColor: 'ORANGE',
          facialFeatures: 'SMILING_EYES',
          clothing: 'NONE',
          expression: 'SMILING'
        });
      avatarId = res.body.candidates[0].id;
    });

    it('should strictly separate tenants and hide pending list from teachers of other tenants', async () => {
      // Other tenant teacher lists pending avatars
      const res = await request(app)
        .get('/api/avatars/pending')
        .set('Authorization', `Bearer ${teacherOtherToken}`);
      
      expect(res.status).toBe(200);
      // School student's avatar must NOT be visible to other tenant teacher
      const matches = res.body.pending.filter((a: any) => a.id === avatarId);
      expect(matches).toHaveLength(0);
    });

    it('should block teachers of other tenants from approving the school student\'s avatar', async () => {
      const res = await request(app)
        .post(`/api/avatars/${avatarId}/approve`)
        .set('Authorization', `Bearer ${teacherOtherToken}`);
      
      expect(res.status).toBe(403);
    });

    it('should allow the student\'s teacher to approve and create a detailed audit trail', async () => {
      // Fetch pending list as the school teacher
      const resPending = await request(app)
        .get('/api/avatars/pending')
        .set('Authorization', `Bearer ${teacherSchoolToken}`);
      
      expect(resPending.status).toBe(200);
      const matches = resPending.body.pending.filter((a: any) => a.id === avatarId);
      expect(matches).toHaveLength(1);

      // Approve the avatar
      const resApprove = await request(app)
        .post(`/api/avatars/${avatarId}/approve`)
        .set('Authorization', `Bearer ${teacherSchoolToken}`);
      
      expect(resApprove.status).toBe(200);
      expect(resApprove.body.success).toBe(true);

      // Verify that audit log was recorded
      const audits = inMemoryState.avatarApprovalAudits.filter(a => a.avatarId === avatarId);
      expect(audits).toHaveLength(1);
      expect(audits[0].moderatorId).toBe(teacherSchoolId);
      expect(audits[0].action).toBe('APPROVE');
      expect(audits[0].imageHash).toHaveLength(64); // SHA-256 hash length
    });
  });

  describe('B-7. GDPR-K / RTBF Physical Purge Cascade Deletion', () => {
    let candidateKeys: string[] = [];

    beforeEach(async () => {
      // 1. Generate avatar candidates for school student
      const res = await request(app)
        .post('/api/avatars/generate')
        .set('Authorization', `Bearer ${studentSchoolToken}`)
        .send({
          baseVegetable: 'TURNIP',
          mainColor: 'WHITE',
          facialFeatures: 'BIG_EYES',
          clothing: 'RED_BOWTIE',
          expression: 'EXCITED'
        });
      
      const avatars = inMemoryState.avatars.filter(a => a.userId === studentSchoolId);
      candidateKeys = avatars.map(a => a.objectKey);
      
      // Verify they exist in database and physical storage
      expect(avatars).toHaveLength(3);
      candidateKeys.forEach(key => {
        expect(storageService.hasObject(key)).toBe(true);
      });

      // Seed quota
      expect(inMemoryState.avatarQuotas.filter(q => q.userId === studentSchoolId)).toHaveLength(1);
    });

    it('should completely erase all database records and physically delete storage assets upon user deletion', async () => {
      // Execute cascade deletion as per GDPR-K compliance
      await inMemoryRepos.users.deleteUserData(studentSchoolId);

      // 1. Verify user record is gone
      const user = await inMemoryRepos.users.findById(studentSchoolId);
      expect(user).toBeNull();

      // 2. Verify all DB avatar records for this student are gone
      const dbAvatars = inMemoryState.avatars.filter(a => a.userId === studentSchoolId);
      expect(dbAvatars).toHaveLength(0);

      // 3. Verify weekly quota limits are wiped
      const quotas = inMemoryState.avatarQuotas.filter(q => q.userId === studentSchoolId);
      expect(quotas).toHaveLength(0);

      // 4. Verify physical image objects are physically deleted from storage service
      candidateKeys.forEach(key => {
        expect(storageService.hasObject(key)).toBe(false);
      });
    });
  });

  describe('B-8. 30-Day TTL Automatic Cleanup & Physical Purges', () => {
    let oldPendingId: string;
    let oldPendingKey: string;
    let freshPendingId: string;
    let freshPendingKey: string;
    let oldApprovedId: string;
    let oldApprovedKey: string;
    let oldRejectedId: string;
    let oldRejectedKey: string;

    beforeEach(async () => {
      const now = Date.now();
      const cutoff31DaysAgo = new Date(now - 31 * 24 * 60 * 60 * 1000);
      const freshDate = new Date();

      // 1. Seed old pending avatar (older than 30 days) -> should be auto-rejected & deleted
      oldPendingId = 'old-pending-id';
      oldPendingKey = 'avatar_old_pending.png';
      storageService.uploadAvatarImage = jest.fn().mockResolvedValue(oldPendingKey);
      storageService['mockFiles'].set(oldPendingKey, Buffer.from('old-pending-img'));
      inMemoryState.avatars.push({
        id: oldPendingId,
        userId: studentSchoolId,
        status: 'PENDING',
        baseVegetable: 'CARROT',
        mainColor: 'ORANGE',
        facialFeatures: 'CUTE_NOSE',
        clothing: 'NONE',
        expression: 'HAPPY',
        prompt: 'prompt',
        objectKey: oldPendingKey,
        rejectionReason: null,
        createdAt: cutoff31DaysAgo.toISOString(),
        updatedAt: cutoff31DaysAgo.toISOString()
      });

      // 2. Seed fresh pending avatar (created today) -> should remain unchanged
      freshPendingId = 'fresh-pending-id';
      freshPendingKey = 'avatar_fresh_pending.png';
      storageService['mockFiles'].set(freshPendingKey, Buffer.from('fresh-pending-img'));
      inMemoryState.avatars.push({
        id: freshPendingId,
        userId: studentSchoolId,
        status: 'PENDING',
        baseVegetable: 'CARROT',
        mainColor: 'ORANGE',
        facialFeatures: 'CUTE_NOSE',
        clothing: 'NONE',
        expression: 'HAPPY',
        prompt: 'prompt',
        objectKey: freshPendingKey,
        rejectionReason: null,
        createdAt: freshDate.toISOString(),
        updatedAt: freshDate.toISOString()
      });

      // 3. Seed old approved avatar (older than 30 days) -> should remain unchanged (approved assets are kept)
      oldApprovedId = 'old-approved-id';
      oldApprovedKey = 'avatar_old_approved.png';
      storageService['mockFiles'].set(oldApprovedKey, Buffer.from('old-approved-img'));
      inMemoryState.avatars.push({
        id: oldApprovedId,
        userId: studentSchoolId,
        status: 'APPROVED',
        baseVegetable: 'CARROT',
        mainColor: 'ORANGE',
        facialFeatures: 'CUTE_NOSE',
        clothing: 'NONE',
        expression: 'HAPPY',
        prompt: 'prompt',
        objectKey: oldApprovedKey,
        rejectionReason: null,
        createdAt: cutoff31DaysAgo.toISOString(),
        updatedAt: cutoff31DaysAgo.toISOString()
      });

      // 4. Seed old rejected avatar (older than 30 days) -> should be physically purged
      oldRejectedId = 'old-rejected-id';
      oldRejectedKey = 'avatar_old_rejected.png';
      storageService['mockFiles'].set(oldRejectedKey, Buffer.from('old-rejected-img'));
      inMemoryState.avatars.push({
        id: oldRejectedId,
        userId: studentSchoolId,
        status: 'REJECTED',
        baseVegetable: 'CARROT',
        mainColor: 'ORANGE',
        facialFeatures: 'CUTE_NOSE',
        clothing: 'NONE',
        expression: 'HAPPY',
        prompt: 'prompt',
        objectKey: oldRejectedKey,
        rejectionReason: '気に入らなかった',
        createdAt: cutoff31DaysAgo.toISOString(),
        updatedAt: cutoff31DaysAgo.toISOString()
      });
    });

    it('should auto-reject old pending, physically delete rejected assets older than 30 days, and preserve approved/fresh files', async () => {
      const res = await request(app).post('/api/avatars/cron/cleanup');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.autoRejectedCount).toBe(1);
      
      // Let's verify what records remain in DB
      const remainingAvatars = inMemoryState.avatars;
      
      // Fresh pending avatar is kept in DB and remains PENDING
      const freshPending = remainingAvatars.find(a => a.id === freshPendingId);
      expect(freshPending).toBeDefined();
      expect(freshPending?.status).toBe('PENDING');
      expect(storageService.hasObject(freshPendingKey)).toBe(true);

      // Old approved avatar is kept in DB and remains APPROVED
      const oldApproved = remainingAvatars.find(a => a.id === oldApprovedId);
      expect(oldApproved).toBeDefined();
      expect(oldApproved?.status).toBe('APPROVED');
      expect(storageService.hasObject(oldApprovedKey)).toBe(true);

      // Old pending avatar (which is older than 30 days) was auto-rejected AND physically deleted
      // Wait: In avatars.ts, standard cron cleanup fetches expiredPending older than 30 days,
      // sets status to REJECTED, and adds them to allExpired array which gets physically deleted in storageService AND DB.
      // So oldPending should be deleted from DB and storage. Let's verify:
      const oldPending = remainingAvatars.find(a => a.id === oldPendingId);
      expect(oldPending).toBeUndefined(); // deleted from DB
      expect(storageService.hasObject(oldPendingKey)).toBe(false); // physically deleted from S3/storage

      // Old rejected avatar is deleted from DB and storage
      const oldRejected = remainingAvatars.find(a => a.id === oldRejectedId);
      expect(oldRejected).toBeUndefined(); // deleted from DB
      expect(storageService.hasObject(oldRejectedKey)).toBe(false); // physically deleted from S3/storage

      // Verify that auto-rejection audit logs were written
      const audits = inMemoryState.avatarApprovalAudits.filter(
        a => a.avatarId === oldPendingId && a.moderatorId === 'cron-ttl-cleanup'
      );
      expect(audits).toHaveLength(1);
      expect(audits[0].action).toBe('REJECT');
      expect(audits[0].reason).toBe('AUTO_REJECT_TTL_EXPIRED');
    });
  });
});
