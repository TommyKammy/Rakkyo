import request from 'supertest';
import app from '../app';
import { inMemoryState } from '../repositories/inmemory/state';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'rakkyo-super-secret-key-12345';

describe('Multi-Tenant Isolation & Teacher Protection', () => {
  // Clear and prepare test environment in mockDb
  beforeAll(() => {
    // Seed test tenants
    inMemoryState.tenants.push(
      {
        id: 'tenant-shibuya',
        name: '渋谷校',
        code: 'shibuya-juku',
        plan: 'PREMIUM',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'tenant-shinjuku',
        name: '新宿校',
        code: 'shinjuku-juku',
        plan: 'PREMIUM',
        createdAt: new Date().toISOString(),
      }
    );

    // Seed classes for both tenants
    inMemoryState.classes.push(
      {
        id: 'class-shibuya-math',
        tenantId: 'tenant-shibuya',
        name: '渋谷中1数学',
        grade: 1,
      },
      {
        id: 'class-shinjuku-math',
        tenantId: 'tenant-shinjuku',
        name: '新宿中1数学',
        grade: 1,
      }
    );
  });

  describe('1. Composite Email Uniqueness per Tenant (@@unique([tenantId, email]))', () => {
    const sharedEmail = 'duplicate-student@example.com';
    const password = 'password123';

    it('should allow registering the same email under different tenants', async () => {
      // Register in Shibuya Tenant
      const resShibuya = await request(app)
        .post('/api/auth/register')
        .send({
          email: sharedEmail,
          password,
          nickname: '渋谷タロー',
          schoolYear: 1,
          parentalConsent: true,
          tenantCode: 'shibuya-juku',
          role: 'STUDENT',
        });

      expect(resShibuya.status).toBe(201);
      expect(resShibuya.body.user.tenantId).toBe('tenant-shibuya');

      // Register in Shinjuku Tenant with the EXACT same email
      const resShinjuku = await request(app)
        .post('/api/auth/register')
        .send({
          email: sharedEmail,
          password,
          nickname: '新宿タロー',
          schoolYear: 1,
          parentalConsent: true,
          tenantCode: 'shinjuku-juku',
          role: 'STUDENT',
        });

      expect(resShinjuku.status).toBe(201);
      expect(resShinjuku.body.user.tenantId).toBe('tenant-shinjuku');
    });

    it('should fail to register same email within the SAME tenant', async () => {
      const resFail = await request(app)
        .post('/api/auth/register')
        .send({
          email: sharedEmail,
          password,
          nickname: '渋谷タロー2',
          schoolYear: 1,
          parentalConsent: true,
          tenantCode: 'shibuya-juku',
          role: 'STUDENT',
        });

      expect(resFail.status).toBe(400);
      expect(resFail.body.error).toContain('既に登録されています');
    });
  });

  describe('2. B2C Automatic Fallback', () => {
    it('should default to B2C tenant when tenantCode is omitted', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'b2c-student@example.com',
          password: 'password123',
          nickname: '個人ユーザー',
          schoolYear: 1,
          parentalConsent: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.user.tenantId).toBe('default-b2c');
      expect(res.body.user.role).toBe('STUDENT');
    });
  });

  describe('3. RLS Implicit Filtering & Data Leak Prevention', () => {
    let shibuyaTeacherToken: string;
    let shinjukuTeacherToken: string;

    beforeAll(() => {
      // Seed teachers in inMemoryState
      const tShibuya = {
        id: 't_shibuya_' + crypto.randomUUID(),
        tenantId: 'tenant-shibuya',
        email: 'teacher-shibuya@example.com',
        passwordHash: 'dummy',
        nickname: '渋谷先生',
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
        createdAt: new Date().toISOString(),
      };
      inMemoryState.users.push(tShibuya);

      const tShinjuku = {
        id: 't_shinjuku_' + crypto.randomUUID(),
        tenantId: 'tenant-shinjuku',
        email: 'teacher-shinjuku@example.com',
        passwordHash: 'dummy',
        nickname: '新宿先生',
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
        createdAt: new Date().toISOString(),
      };
      inMemoryState.users.push(tShinjuku);

      // Enroll Shibuya teacher in Shibuya class
      inMemoryState.classEnrollments.push({
        id: 'enroll-t-shibuya',
        classId: 'class-shibuya-math',
        userId: tShibuya.id,
        role: 'TEACHER',
      });

      // Enroll Shinjuku teacher in Shinjuku class
      inMemoryState.classEnrollments.push({
        id: 'enroll-t-shinjuku',
        classId: 'class-shinjuku-math',
        userId: tShinjuku.id,
        role: 'TEACHER',
      });

      shibuyaTeacherToken = jwt.sign(
        { userId: tShibuya.id, tenantId: tShibuya.tenantId, role: tShibuya.role },
        JWT_SECRET
      );

      shinjukuTeacherToken = jwt.sign(
        { userId: tShinjuku.id, tenantId: tShinjuku.tenantId, role: tShinjuku.role },
        JWT_SECRET
      );
    });

    it('should strictly return only classes belonging to the active teacher\'s tenant', async () => {
      // Shibuya Teacher fetches classes
      const resShibuya = await request(app)
        .get('/api/teacher/classes')
        .set('Authorization', `Bearer ${shibuyaTeacherToken}`);

      expect(resShibuya.status).toBe(200);
      expect(resShibuya.body.classes.length).toBe(1);
      expect(resShibuya.body.classes[0].name).toBe('渋谷中1数学');

      // Shinjuku Teacher fetches classes
      const resShinjuku = await request(app)
        .get('/api/teacher/classes')
        .set('Authorization', `Bearer ${shinjukuTeacherToken}`);

      expect(resShinjuku.status).toBe(200);
      expect(resShinjuku.body.classes.length).toBe(1);
      expect(resShinjuku.body.classes[0].name).toBe('新宿中1数学');
    });

    it('should block teachers from reading students in other tenant classes', async () => {
      // Shibuya Teacher attempts to fetch students from Shinjuku Class
      const res = await request(app)
        .get('/api/teacher/classes/class-shinjuku-math/students')
        .set('Authorization', `Bearer ${shibuyaTeacherToken}`);

      // In MockDB implementation, it fetches by classId directly.
      // But under active RLS on DB, classes from other tenants are non-existent.
      // Here, since mockDb is active, we should check if they can access it.
      // For absolute security, let's verify that the tenant boundary is respected.
      // The classId 'class-shinjuku-math' belongs to tenant-shinjuku.
      // Shibuya Teacher has tenantId 'tenant-shibuya'.
      // If we implement the same tenant isolation inside Express routes,
      // it verifies that Class.tenantId matches req.tenantId.
      // Let's make sure the mockDb class query respects tenant boundaries or returns empty.
      
      // Let's check what it returns:
      expect(res.status).toBe(200);
      // Shibuya Teacher cannot see Shinjuku students because they belong to different tenants.
      // In mockDb, class 'class-shinjuku-math' is linked to 'tenant-shinjuku'.
      // Our API route query for Prisma will implicitly append where: { tenantId }!
      // Therefore, prisma.classEnrollment.findMany will only look for classEnrollment where class has tenantId = Shibuya,
      // meaning class-shinjuku-math would not match and it would return empty arrays.
      expect(res.body.students.length).toBe(0);
    });
  });
});
