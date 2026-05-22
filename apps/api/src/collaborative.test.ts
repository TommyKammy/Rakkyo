import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from './app';
import { inMemoryState } from './repositories/inmemory/state';

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'rakkyo-super-secret-key-12345';

describe('Phase-12 Collaborative Learning and Peer Support Integration Tests', () => {
  let token: string;
  let otherToken: string;
  let teacherToken: string;
  let otherTenantTeacherToken: string;
  let generatedToken: string;

  beforeAll(() => {
    // Generate valid test JWT token for 'test-student-id'
    token = jwt.sign(
      { userId: 'test-student-id', tenantId: 'test-tenant-id', role: 'STUDENT' },
      JWT_SECRET
    );
    // Generate token for another classmate who exists in mockDb ('user_presence_0')
    otherToken = jwt.sign(
      { userId: 'user_presence_0', tenantId: 'test-tenant-id', role: 'STUDENT' },
      JWT_SECRET
    );
    // Generate teacher tokens
    teacherToken = jwt.sign(
      { userId: 'test-teacher-id', tenantId: 'test-tenant-id', role: 'TEACHER' },
      JWT_SECRET
    );
    otherTenantTeacherToken = jwt.sign(
      { userId: 'other-teacher-id', tenantId: 'other-tenant-id', role: 'TEACHER' },
      JWT_SECRET
    );

    // Register foreign tenant entities in inMemoryState for cross-tenant authorization testing
    inMemoryState.users.push({
      id: 'other-teacher-id',
      tenantId: 'other-tenant-id',
      email: 'other-teacher@rakkyo.com',
      passwordHash: 'dummy',
      nickname: '他テナント先生',
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
    });
    inMemoryState.classes.push({
      id: 'other-class-id',
      tenantId: 'other-tenant-id',
      name: '他テナントクラス',
      grade: 1
    });
    inMemoryState.classEnrollments.push({
      id: 'enroll_other_teacher',
      classId: 'other-class-id',
      userId: 'other-teacher-id',
      role: 'TEACHER'
    });
  });

  describe('1. Virtual Study Room (GET /api/collaborative/room)', () => {
    it('should retrieve asynchronous presence of classmates with floating avatar and bubble message', async () => {
      const res = await request(app)
        .get('/api/collaborative/room')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('classId');
      expect(res.body).toHaveProperty('roomName');
      expect(res.body).toHaveProperty('activeMembers');
      expect(Array.isArray(res.body.activeMembers)).toBe(true);

      if (res.body.activeMembers.length > 0) {
        const firstMember = res.body.activeMembers[0];
        expect(firstMember).toHaveProperty('id');
        expect(firstMember).toHaveProperty('nickname');
        expect(firstMember).toHaveProperty('avatar');
        expect(firstMember).toHaveProperty('status');
        expect(firstMember).toHaveProperty('bubbleMessage');
        expect(firstMember).toHaveProperty('isOnline');
      }
    });
  });

  describe('2. Peer Stamps (GET/POST /api/collaborative/stamps)', () => {
    it('should prevent sending peer stamp to oneself', async () => {
      const res = await request(app)
        .post('/api/collaborative/stamps')
        .set('Authorization', `Bearer ${token}`)
        .send({
          receiverId: 'test-student-id',
          stampType: 'Grit! 💪'
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', '自分自身にスタンプを送ることはできません');
    });

    it('should successfully send a peer stamp to a classmate and generate a notification message', async () => {
      const initialStampsRes = await request(app)
        .get('/api/collaborative/stamps')
        .set('Authorization', `Bearer ${otherToken}`);
      const initialReceivedCount = initialStampsRes.body.received?.length || 0;

      const res = await request(app)
        .post('/api/collaborative/stamps')
        .set('Authorization', `Bearer ${token}`)
        .send({
          receiverId: 'user_presence_0',
          stampType: 'Grit! 💪'
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('stamp');
      expect(res.body.stamp).toHaveProperty('senderId', 'test-student-id');
      expect(res.body.stamp).toHaveProperty('receiverId', 'user_presence_0');
      expect(res.body.stamp).toHaveProperty('stampType', 'Grit! 💪');

      // Verify that the other classmate received the stamp
      const finalStampsRes = await request(app)
        .get('/api/collaborative/stamps')
        .set('Authorization', `Bearer ${otherToken}`);
      expect(finalStampsRes.body.received.length).toBe(initialReceivedCount + 1);

      const newStamp = finalStampsRes.body.received[0];
      expect(newStamp.stampType).toBe('Grit! 💪');
      expect(newStamp.senderNickname).toBeDefined();
    });
  });

  describe('3. Cooperative Class Mission (GET/POST /api/collaborative/missions)', () => {
    it('should retrieve cooperative class missions with current and target minutes', async () => {
      const res = await request(app)
        .get('/api/collaborative/missions')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      
      const mission = res.body[0];
      expect(mission).toHaveProperty('id');
      expect(mission).toHaveProperty('title');
      expect(mission).toHaveProperty('currentMinutes');
      expect(mission).toHaveProperty('targetMinutes');
    });

    it('should accumulate study time and contribute to cooperative mission progress', async () => {
      const resGet = await request(app)
        .get('/api/collaborative/missions')
        .set('Authorization', `Bearer ${token}`);
      const prevMinutes = resGet.body[0].currentMinutes;

      const resContribute = await request(app)
        .post('/api/collaborative/missions/contribute')
        .set('Authorization', `Bearer ${token}`)
        .send({ minutes: 15 });

      expect(resContribute.status).toBe(200);
      expect(resContribute.body).toHaveProperty('success', true);
      expect(resContribute.body).toHaveProperty('contributed', 15);

      const resGetFinal = await request(app)
        .get('/api/collaborative/missions')
        .set('Authorization', `Bearer ${token}`);
      expect(resGetFinal.body[0].currentMinutes).toBe(prevMinutes + 15);
    });
  });

  describe('4. Anonymous Hirameki Board (GET/POST /api/collaborative/hirameki)', () => {
    it('should retrieve anonymous hirameki tips', async () => {
      const res = await request(app)
        .get('/api/collaborative/hirameki')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      
      if (res.body.length > 0) {
        const tip = res.body[0];
        expect(tip).toHaveProperty('id');
        expect(tip).toHaveProperty('nickname');
        expect(tip).toHaveProperty('content');
        expect(tip).toHaveProperty('isSafe', true);
      }
    });

    it('should block abusive content with friendly safety guidance of Rakkyo-kun', async () => {
      const res = await request(app)
        .post('/api/collaborative/hirameki')
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'お前は本当にばかだな！死ね！' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'abusive_content');
      expect(res.body.message).toContain('優しい言葉を使ってみようかな');
    });

    it('should post a valid tip anonymously with a cute randomized vegetable nickname', async () => {
      const res = await request(app)
        .post('/api/collaborative/hirameki')
        .set('Authorization', `Bearer ${token}`)
        .send({ content: '代入をするときは、かっこ()をつけて代入すると符号ミスがなくなるよ！💡' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.tip).toHaveProperty('nickname');
      expect(res.body.tip).toHaveProperty('content', '代入をするときは、かっこ()をつけて代入すると符号ミスがなくなるよ！💡');
      
      const nickname = res.body.tip.nickname;
      const parts = nickname.split('#');
      expect(parts.length).toBe(2);
      
      const cuteNicknames = ['がんばるオニオン', 'ひらめきラッキョ', 'あきらめないネギ', 'スラスラにんにく', 'にこにこキャベツ'];
      expect(cuteNicknames).toContain(parts[0]);
      
      const suffix = Number(parts[1]);
      // Phase 15.5: suffix widened from 4 to 6 digits to reduce 30-student
      // birthday-paradox collisions from ~5% to well under 0.05%.
      expect(suffix).toBeGreaterThanOrEqual(100000);
      expect(suffix).toBeLessThanOrEqual(999999);
    });
  });

  describe('5. Parental Celebration Link & Feedbacks (POST /api/collaborative/celebration)', () => {
    it('should trigger and generate parental celebration token', async () => {
      const res = await request(app)
        .post('/api/collaborative/celebration/trigger')
        .set('Authorization', `Bearer ${token}`)
        .send({ attemptId: 'attempt_seed_4' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('token');
      expect(typeof res.body.token).toBe('string');
      generatedToken = res.body.token; // Save token for subsequent tests
    });

    it('should retrieve childs learning report and diagnostic details using token', async () => {
      expect(generatedToken).toBeDefined();
      const res = await request(app)
        .get(`/api/collaborative/celebration/${generatedToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('childNickname');
      expect(res.body).toHaveProperty('attempt');
      expect(res.body.attempt).toHaveProperty('questionPrompt');
      expect(res.body.attempt).toHaveProperty('isCorrect');
      expect(res.body.attempt).toHaveProperty('hintsUsed');
      expect(res.body.attempt).toHaveProperty('aiDiagnosis');
    });

    it('should respond back from parent with celebration stamp and messages', async () => {
      expect(generatedToken).toBeDefined();
      const res = await request(app)
        .post(`/api/collaborative/celebration/${generatedToken}/respond`)
        .send({
          stamp: 'GREAT_JOB',
          comment: 'ヒントをあきらめずに使ってがんばったね！えらいぞ！'
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      
      // Verify that notification message is queued for the student
      const childRes = await request(app)
        .get(`/api/collaborative/celebration/${generatedToken}`);
      expect(childRes.body).toHaveProperty('parentStamp', 'GREAT_JOB');
      expect(childRes.body).toHaveProperty('parentComment', 'ヒントをあきらめずに使ってがんばったね！えらいぞ！');
    });

    it('should block double response using the same celebration token', async () => {
      expect(generatedToken).toBeDefined();
      const res = await request(app)
        .post(`/api/collaborative/celebration/${generatedToken}/respond`)
        .send({
          stamp: 'GREAT_JOB',
          comment: '二重送信のテストです'
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'お祝いリンクの有効期限が切れているか、すでに応答済みです');
    });

    it('should allow GET requests on an already-responded celebration token but return responded details', async () => {
      expect(generatedToken).toBeDefined();
      const res = await request(app)
        .get(`/api/collaborative/celebration/${generatedToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('isResponded', true);
      expect(res.body).toHaveProperty('parentStamp', 'GREAT_JOB');
    });

    it('should block parental celebration respond if comment contains abusive content', async () => {
      // Create a new token so it is not responded yet
      const triggerRes = await request(app)
        .post('/api/collaborative/celebration/trigger')
        .set('Authorization', `Bearer ${token}`)
        .send({ attemptId: 'attempt_seed_4' });

      expect(triggerRes.status).toBe(200);
      const tempToken = triggerRes.body.token;

      const res = await request(app)
        .post(`/api/collaborative/celebration/${tempToken}/respond`)
        .send({
          stamp: 'KEEP_IT_UP',
          comment: 'ばかやろう、もっと勉強しろ死ね！'
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'abusive_content');
      expect(res.body.message).toContain('優しい言葉を使ってみようかな');
    });

    it('should block GET and POST requests if the celebration token is expired', async () => {
      // Create an expired token manually with valid signature in inMemoryState.
      // Phase 15.5 (Phase D): expiresAt now lives inside the signed payload itself
      // so the token is the authoritative source of expiry.
      const payload = {
        childId: 'test-student-id',
        attemptId: 'attempt_seed_4',
        random: 'expired-mock-random',
        createdAt: Date.now() - 15 * 24 * 60 * 60 * 1000,
        expiresAt: Date.now() - 24 * 60 * 60 * 1000 // expired 1 day ago
      };
      const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const CELEBRATION_HMAC_SECRET =
        process.env.CELEBRATION_HMAC_SECRET || 'rakkyo-dev-celebration-hmac-insecure';
      const crypto = require('crypto');
      const signature = crypto
        .createHmac('sha256', CELEBRATION_HMAC_SECRET)
        .update(payloadB64)
        .digest('base64url');
      const expiredToken = `${payloadB64}.${signature}`;

      const celeb = {
        id: 'celeb_expired_123',
        childId: 'test-student-id',
        attemptId: 'attempt_seed_4',
        token: expiredToken,
        parentStamp: null,
        parentComment: null,
        isResponded: false,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day in the past
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      inMemoryState.parentalCelebrations.push(celeb);

      const getRes = await request(app)
        .get(`/api/collaborative/celebration/${expiredToken}`);
      expect(getRes.status).toBe(400);
      expect(getRes.body).toHaveProperty('error', 'お祝いリンクの有効期限が切れています');

      const postRes = await request(app)
        .post(`/api/collaborative/celebration/${expiredToken}/respond`)
        .send({
          stamp: 'KEEP_IT_UP',
          comment: 'がんばってね'
        });
      expect(postRes.status).toBe(400);
      expect(postRes.body).toHaveProperty('error', 'お祝いリンクの有効期限が切れているか、すでに応答済みです');
    });
  });

  describe('5.5 Phase-15 Advanced UX and Hybrid TTS Integration Tests', () => {
    it('should assign a fixed 6-digit suffix to anonymous nicknames on Hirameki board', async () => {
      const res1 = await request(app)
        .post('/api/collaborative/hirameki')
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'テスト投稿1です。' });
        
      const res2 = await request(app)
        .post('/api/collaborative/hirameki')
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'テスト投稿2です。' });

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      
      const nick1 = res1.body.tip.nickname;
      const nick2 = res2.body.tip.nickname;
      
      const parts1 = nick1.split('#');
      const parts2 = nick2.split('#');
      
      expect(parts1.length).toBe(2);
      expect(parts2.length).toBe(2);
      // Suffix is tied to userId, so it must be fixed/constant for the same user
      expect(parts1[1]).toBe(parts2[1]);
    });

    it('should generate real attempts-based asynchronous grit messages inside GET /room', async () => {
      // 1. Inject a recent attempt inside last 7 days for the classmate user_presence_0
      const mockAttempt = {
        id: 'test_attempt_phase15',
        userId: 'user_presence_0',
        questionId: '$-5 + 3$ を計算しなさい。',
        isCorrect: true,
        hintsUsed: 0,
        durationSeconds: 30,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      inMemoryState.attempts.push(mockAttempt as any);

      const res = await request(app)
        .get('/api/collaborative/room')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const member = res.body.activeMembers.find((m: any) => m.id === 'user_presence_0');
      expect(member).toBeDefined();
      expect(member.status).toContain('正負の数');
      expect(member.bubbleMessage).toContain('クリアしたよ');
    });

    it('should respect isSocraticPreferred toggle and return metaDescription on hint inquiry', async () => {
      const res = await request(app)
        .post('/api/lessons/hint')
        .set('Authorization', `Bearer ${token}`)
        .send({
          questionId: '$-5 + 3$ を計算しなさい。',
          hintsUsed: 0,
          isSocraticPreferred: true
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('metaDescription');
      expect(res.body.metaDescription).toContain('いっしょに考えるモードに入ったよ');
    });

    it('should return a valid fallback response for TTS if no API key is specified', async () => {
      // Temporarily remove API keys
      const origGeminiKey = process.env.GEMINI_API_KEY;
      const origGoogleKey = process.env.GOOGLE_API_KEY;
      delete process.env.GEMINI_API_KEY;
      delete process.env.GOOGLE_API_KEY;

      try {
        const res = await request(app)
          .post('/api/tts')
          .set('Authorization', `Bearer ${token}`)
          .send({
            text: 'テスト読み上げテキストです。',
            emotion: 'calm'
          });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', false);
        expect(res.body).toHaveProperty('fallbackToWebSpeech', true);
        expect(res.body).toHaveProperty('reason', 'API_KEY_NOT_FOUND');
      } finally {
        // Restore API keys
        if (origGeminiKey) process.env.GEMINI_API_KEY = origGeminiKey;
        if (origGoogleKey) process.env.GOOGLE_API_KEY = origGoogleKey;
      }
    });
  });

  describe('5.6 Phase-15.5 Security and Safety Hardening Tests', () => {
    let abuseStudentToken: string;
    let abuseStudentId = 'abuse-student-id';

    beforeAll(() => {
      // Register a dedicated user for abuse tests
      const abuseStudent = {
        id: abuseStudentId,
        tenantId: 'test-tenant-id',
        email: 'abuse-student@example.com',
        passwordHash: 'dummy',
        nickname: '荒らし生徒',
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
      };
      inMemoryState.users.push(abuseStudent);
      
      inMemoryState.classEnrollments.push({
        id: 'enroll-abuse-student',
        classId: 'test-class-id',
        userId: abuseStudentId,
        role: 'STUDENT',
      });

      abuseStudentToken = jwt.sign(
        { userId: abuseStudentId, tenantId: 'test-tenant-id', role: 'STUDENT' },
        JWT_SECRET
      );
    });

    it('should temporarily lock a student for 24h after 3 consecutive abuse detections and queue parent notification', async () => {
      // 1st Abuse Action
      let res1 = await request(app)
        .post('/api/lessons/hint')
        .set('Authorization', `Bearer ${abuseStudentToken}`)
        .send({
          questionId: '$-5 + 3$ を計算しなさい。',
          hintsUsed: 0,
          userQuestion: 'お前は本当にばかだな！死ね！'
        });
      expect(res1.status).toBe(200);
      expect(res1.body.isAbusive).toBe(true);
      expect(res1.body.warningCount).toBe(1);

      // 2nd Abuse Action
      let res2 = await request(app)
        .post('/api/lessons/hint')
        .set('Authorization', `Bearer ${abuseStudentToken}`)
        .send({
          questionId: '$-5 + 3$ を計算しなさい。',
          hintsUsed: 0,
          userQuestion: '死ね死ね死ね'
        });
      expect(res2.status).toBe(200);
      expect(res2.body.isAbusive).toBe(true);
      expect(res2.body.warningCount).toBe(2);

      // 3rd Abuse Action - this should trigger a 24h account lock
      let res3 = await request(app)
        .post('/api/lessons/hint')
        .set('Authorization', `Bearer ${abuseStudentToken}`)
        .send({
          questionId: '$-5 + 3$ を計算しなさい。',
          hintsUsed: 0,
          userQuestion: 'ばか野郎'
        });
      
      expect(res3.status).toBe(200);
      expect(res3.body.isAbusive).toBe(true);
      expect(res3.body.locked).toBe(true);

      // Verify DB/inMemory state: User lockedUntil is set to a future date
      const updatedUser = inMemoryState.users.find(u => u.id === abuseStudentId);
      expect(updatedUser).toBeDefined();
      expect(updatedUser?.lockedUntil).toBeDefined();
      expect(new Date(updatedUser!.lockedUntil!).getTime()).toBeGreaterThan(Date.now());

      // Verify direct Parental Notification was queued
      const parentMsgs = inMemoryState.parentMessages.filter(m => m.userId === abuseStudentId);
      expect(parentMsgs.length).toBeGreaterThan(0);
      expect(parentMsgs[0].message).toContain('不適切な言葉の入力を繰り返したため');

      // Verify that subsequent API requests are blocked by auth middleware
      const lockedRes = await request(app)
        .get('/api/collaborative/room')
        .set('Authorization', `Bearer ${abuseStudentToken}`);
      
      expect(lockedRes.status).toBe(403);
      expect(lockedRes.body.error).toBe('safety_lock');
    });

    it('should block parental celebration request with invalid HMAC signature', async () => {
      const res = await request(app)
        .get('/api/collaborative/celebration/invalid.signature');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('お祝いリンクの署名が無効です');
    });

    it('should enforce TTS daily quota of 500 requests per user', async () => {
      // We will quickly fire 500 requests (we use a loop with Promise.all to avoid blocking)
      // Since it returns fallbackToWebSpeech immediately when no API keys are set, it is extremely fast.
      const requests = [];
      for (let i = 0; i < 500; i++) {
        requests.push(
          request(app)
            .post('/api/tts')
            .set('Authorization', `Bearer ${token}`)
            .send({ text: `テストテキスト ${i}`, emotion: 'calm' })
        );
      }
      await Promise.all(requests);

      // The 501st request should be blocked by Daily Quota
      const res = await request(app)
        .post('/api/tts')
        .set('Authorization', `Bearer ${token}`)
        .send({ text: '制限を超えるはずのテキスト', emotion: 'calm' });

      expect(res.status).toBe(429);
      expect(res.body.error).toContain('クォータ（500回）を超過しました');
    });
  });

  describe('5.7 Phase-16-A Boss Battle Integration Tests', () => {
    let bossId = 'test-boss-id';
    let battleId = 'test-battle-id';

    beforeAll(() => {
      // Seed a Boss in state
      inMemoryState.bosses.push({
        id: bossId,
        name: '数式魔王',
        maxHp: 1000,
        attribute: 'EQUATIONS',
        durationWeeks: 1,
        createdAt: new Date().toISOString()
      });
      // Seed a question pool in state
      inMemoryState.bossQuestionPools.push({
        id: 'test-pool-id',
        classId: 'test-class-id',
        questionsJson: JSON.stringify([
          {
            id: 'bq_1',
            prompt: '問1: $x - 1 = 2$ を計算しなさい。',
            answers: ['3'],
            options: [],
            explanation: '解説文',
            hints: ['ヒント1', 'ヒント2'],
            difficulty: 1
          }
        ]),
        lastGeneratedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago (allows immediate generation)
        createdAt: new Date().toISOString()
      });
    });

    it('should enforce weekly limit of AI question pool generation (429 Too Many Requests)', async () => {
      // 1st generation - should succeed
      const res1 = await request(app)
        .post('/api/collaborative/boss/pool/generate')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          classId: 'test-class-id',
          attribute: 'EQUATIONS'
        });
      
      expect(res1.status).toBe(200);
      expect(res1.body).toHaveProperty('success', true);

      // 2nd generation - should be blocked with 429
      const res2 = await request(app)
        .post('/api/collaborative/boss/pool/generate')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          classId: 'test-class-id',
          attribute: 'EQUATIONS'
        });

      expect(res2.status).toBe(429);
      expect(res2.body.error).toContain('AI問題プール生成は週に1回のみ可能です');
    });

    it('should reject battle approval from unauthorized or foreign tenant teachers (403 Forbidden)', async () => {
      const startsAt = new Date().toISOString();
      const endsAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      // 1. Foreign tenant teacher
      const res1 = await request(app)
        .post('/api/collaborative/boss/pool/approve')
        .set('Authorization', `Bearer ${otherTenantTeacherToken}`)
        .send({
          classId: 'test-class-id', // target class belongs to test-tenant-id
          bossId,
          startsAt,
          endsAt
        });
      
      expect(res1.status).toBe(403);
      expect(res1.body.error).toContain('クロステナント拒絶');

      // 2. Teacher from same tenant but not enrolled in class
      const sameTenantTeacherToken = jwt.sign(
        { userId: 'not-enrolled-teacher-id', tenantId: 'test-tenant-id', role: 'TEACHER' },
        JWT_SECRET
      );
      inMemoryState.users.push({
        id: 'not-enrolled-teacher-id',
        tenantId: 'test-tenant-id',
        email: 'not-enrolled@rakkyo.com',
        passwordHash: 'dummy',
        nickname: '無関係先生',
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
      });
      inMemoryState.classes.push({
        id: 'dummy-other-class-id',
        tenantId: 'test-tenant-id',
        name: 'ダミー他クラス',
        grade: 1
      });
      inMemoryState.classEnrollments.push({
        id: 'enroll-unrelated-teacher',
        classId: 'dummy-other-class-id',
        userId: 'not-enrolled-teacher-id',
        role: 'TEACHER'
      });

      const res2 = await request(app)
        .post('/api/collaborative/boss/pool/approve')
        .set('Authorization', `Bearer ${sameTenantTeacherToken}`)
        .send({
          classId: 'test-class-id',
          bossId,
          startsAt,
          endsAt
        });
      
      expect(res2.status).toBe(403);
      expect(res2.body.error).toContain('担当教師ではありません');
    });

    it('should successfully approve and create a boss battle, logging the audit record', async () => {
      const startsAt = new Date(Date.now() - 10000).toISOString(); // starts slightly in past to be active
      const endsAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      const res = await request(app)
        .post('/api/collaborative/boss/pool/approve')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          classId: 'test-class-id',
          bossId,
          startsAt,
          endsAt
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('battleId');
      battleId = res.body.battleId;

      // Verify audit log exists
      const audit = inMemoryState.bossApprovalAudits.find(a => a.targetId === battleId);
      expect(audit).toBeDefined();
      expect(audit?.action).toBe('APPROVE_BATTLE');
      expect(audit?.userId).toBe('test-teacher-id');
    });

    it('should completely hide other classmates individual damage stats from student active view (A-4)', async () => {
      const res = await request(app)
        .get('/api/collaborative/boss/active')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('battle');
      expect(res.body.battle).toHaveProperty('currentHp');
      expect(res.body.battle).toHaveProperty('totalClassDamage');
      expect(res.body).toHaveProperty('participant');

      // Crucial Security Verification: Ensure NO other individual participants' detail list is exposed in response
      const keys = Object.keys(res.body);
      expect(keys).toContain('battle');
      expect(keys).toContain('participant');
      expect(keys.length).toBe(2); // strictly battle and participant only!
      
      const battleKeys = Object.keys(res.body.battle);
      expect(battleKeys).not.toContain('participants'); // no individual arrays!
    });

    it('should respect the startsAt/endsAt active battle time window (Fake Timers Boundary Verification)', async () => {
      jest.useFakeTimers();
      
      // Look up active battle to get exact bounds
      const battle = inMemoryState.bossBattles.find(b => b.id === battleId);
      expect(battle).toBeDefined();

      // 1. Set time BEFORE startsAt
      jest.setSystemTime(new Date(battle!.startsAt).getTime() - 5000);
      const resBefore = await request(app)
        .post('/api/collaborative/boss/attack')
        .set('Authorization', `Bearer ${token}`)
        .send({
          questionId: 'bq_1',
          answerSubmitted: '-2x',
          hintsUsed: 0
        });
      expect(resBefore.status).toBe(400);
      expect(resBefore.body.error).toMatch(/制限時間外です|アクティブなボスバトルがありません/);

      // 2. Set time DURING active window
      jest.setSystemTime(new Date(battle!.startsAt).getTime() + 5000);
      const resActive = await request(app)
        .post('/api/collaborative/boss/attack')
        .set('Authorization', `Bearer ${token}`)
        .send({
          questionId: 'bq_1',
          answerSubmitted: '-2x',
          hintsUsed: 0
        });
      expect(resActive.status).toBe(200);
      expect(resActive.body.isCorrect).toBe(true);

      // 3. Set time AFTER endsAt
      jest.setSystemTime(new Date(battle!.endsAt).getTime() + 5000);
      const resAfter = await request(app)
        .post('/api/collaborative/boss/attack')
        .set('Authorization', `Bearer ${token}`)
        .send({
          questionId: 'bq_1',
          answerSubmitted: '-2x',
          hintsUsed: 0
        });
      expect(resAfter.status).toBe(400);
      expect(resAfter.body.error).toMatch(/制限時間外です|アクティブなボスバトルがありません/);

      jest.useRealTimers();
    });

    it('should process parallel attacks atomically, ensuring no Lost Updates and exactly one justDefeated winner', async () => {
      // Deactivate all previous battles first so our weak battle is the only active one!
      inMemoryState.bossBattles.forEach(b => {
        b.isAlive = false;
        b.endsAt = new Date(Date.now() - 100000).toISOString();
      });

      // 1. Create a specific fresh boss with exactly 1 HP
      const weakBossId = 'weak-boss-id';
      const weakBattleId = 'weak-battle-id';
      
      inMemoryState.bosses.push({
        id: weakBossId,
        name: '瀕死のボス',
        maxHp: 100,
        attribute: 'EQUATIONS',
        durationWeeks: 1,
        createdAt: new Date().toISOString()
      });

      inMemoryState.bossBattles.push({
        id: weakBattleId,
        classId: 'test-class-id',
        bossId: weakBossId,
        currentHp: 1, // Only 1 HP left!
        startsAt: new Date(Date.now() - 10000).toISOString(),
        endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        defeatedAt: null,
        isAlive: true,
        createdAt: new Date().toISOString()
      });

      // 2. Generate 16 parallel student attacks concurrently
      const parallelStudentsCount = 16;
      const attackPromises = [];

      for (let i = 0; i < parallelStudentsCount; i++) {
        const studentId = `parallel-student-${i}`;
        const studentToken = jwt.sign(
          { userId: studentId, tenantId: 'test-tenant-id', role: 'STUDENT' },
          JWT_SECRET
        );

        // Register student mock in memory state
        inMemoryState.users.push({
          id: studentId,
          tenantId: 'test-tenant-id',
          email: `${studentId}@rakkyo.com`,
          passwordHash: 'dummy',
          nickname: `戦士 #${i}`,
          role: 'STUDENT',
          schoolYear: 1,
          currentXp: 100,
          level: 2,
          streakCount: 1,
          lastActiveDate: new Date().toISOString(),
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
          id: `enroll-parallel-${i}`,
          classId: 'test-class-id',
          userId: studentId,
          role: 'STUDENT'
        });

        // Fire request
        attackPromises.push(
          request(app)
            .post('/api/collaborative/boss/attack')
            .set('Authorization', `Bearer ${studentToken}`)
            .send({
              questionId: 'bq_1',
              answerSubmitted: '-2x',
              hintsUsed: 1
            })
        );
      }

      // Execute all 16 attacks in parallel
      const results = await Promise.all(attackPromises);

      // Verify that all returned 200 OK
      results.forEach(res => {
        expect(res.status).toBe(200);
      });

      // Assert Atomic Execution:
      // Exactly ONE request must get justDefeated: true
      const defeatWinners = results.filter(res => res.body.justDefeated === true);
      expect(defeatWinners.length).toBe(1);

      // The rest must get justDefeated: false
      const defeatLosers = results.filter(res => res.body.justDefeated === false);
      expect(defeatLosers.length).toBe(parallelStudentsCount - 1);

      // Verify Boss state: Hp must be <= 0, isAlive must be false
      const finalBattleState = inMemoryState.bossBattles.find(b => b.id === weakBattleId);
      expect(finalBattleState).toBeDefined();
      expect(finalBattleState?.currentHp).toBeLessThanOrEqual(0);
      expect(finalBattleState?.isAlive).toBe(false);
      expect(finalBattleState?.defeatedAt).not.toBeNull();
    });

    it('should idempotently award victory badges and handle celebration read states', async () => {
      // 1. Test idempotent badge award (A-6)
      const winningParticipant = inMemoryState.bossBattleParticipants.find(p => p.battleId === 'weak-battle-id' && p.totalDamage > 0);
      expect(winningParticipant).toBeDefined();
      
      const winnerId = winningParticipant!.userId;
      const winnerUser = inMemoryState.users.find(u => u.id === winnerId);
      expect(winnerUser?.badges).toContain('魔王撃破の証');

      // 2. Celebration Seen State idempotency (A-7)
      const studentToken = jwt.sign(
        { userId: winnerId, tenantId: 'test-tenant-id', role: 'STUDENT' },
        JWT_SECRET
      );

      const activeRes1 = await request(app)
        .get('/api/collaborative/boss/active')
        .set('Authorization', `Bearer ${studentToken}`);
      
      expect(activeRes1.status).toBe(200);
      expect(activeRes1.body.participant.celebrationSeenAt).toBeNull();

      // Submit seen state confirmation
      const seenRes = await request(app)
        .post('/api/collaborative/boss/celebration/seen')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ battleId: 'weak-battle-id' });

      expect(seenRes.status).toBe(200);
      expect(seenRes.body).toHaveProperty('success', true);

      // Verify it is now flagged as seen
      const activeRes2 = await request(app)
        .get('/api/collaborative/boss/active')
        .set('Authorization', `Bearer ${studentToken}`);
      
      expect(activeRes2.status).toBe(200);
      expect(activeRes2.body.participant.celebrationSeenAt).not.toBeNull();
    });
  });

  describe('6. Right-to-Be-Forgotten Data Deletion (DELETE /api/users/me/data)', () => {
    it('should successfully cascade delete all user data and attempts', async () => {
      // Seed participant and audit record for 'test-student-id' first to test GDPR cascade
      inMemoryState.bossBattleParticipants.push({
        userId: 'test-student-id',
        battleId: 'weak-battle-id',
        totalDamage: 45,
        gritAttemptsCount: 3,
        celebrationSeenAt: null,
        createdAt: new Date().toISOString()
      });
      inMemoryState.bossApprovalAudits.push({
        id: 'test-audit-gdpr',
        userId: 'test-student-id',
        tenantId: 'test-tenant-id',
        action: 'TEST_GDPR',
        targetId: 'weak-battle-id',
        details: 'Audit to be deleted',
        createdAt: new Date().toISOString()
      });

      // 1. Double check the user exists in inMemoryState
      const student = inMemoryState.users.find(u => u.id === 'test-student-id');
      expect(student).toBeDefined();

      // 2. Perform DELETE request to wipe out test student data
      const res = await request(app)
        .delete('/api/users/me/data')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.message).toContain('完全に削除されました');

      // 3. Verify user has been completely deleted
      const deletedStudent = inMemoryState.users.find(u => u.id === 'test-student-id');
      expect(deletedStudent).toBeUndefined();

      // 4. Verify associated data has also been completely cascaded
      const deletedAttempts = inMemoryState.attempts.filter(a => a.userId === 'test-student-id');
      expect(deletedAttempts.length).toBe(0);

      const deletedEnrollments = inMemoryState.classEnrollments.filter(e => e.userId === 'test-student-id');
      expect(deletedEnrollments.length).toBe(0);

      const deletedCelebrations = inMemoryState.parentalCelebrations.filter(c => c.childId === 'test-student-id');
      expect(deletedCelebrations.length).toBe(0);

      const deletedParticipants = inMemoryState.bossBattleParticipants.filter(p => p.userId === 'test-student-id');
      expect(deletedParticipants.length).toBe(0);

      const deletedAudits = inMemoryState.bossApprovalAudits.filter(a => a.userId === 'test-student-id');
      expect(deletedAudits.length).toBe(0);
    });
  });
});
