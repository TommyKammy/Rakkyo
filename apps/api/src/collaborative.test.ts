import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from './app';
import { mockDb } from './mockDb';

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'rakkyo-super-secret-key-12345';

describe('Phase-12 Collaborative Learning and Peer Support Integration Tests', () => {
  let token: string;
  let otherToken: string;
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
      
      const cuteNicknames = ['がんばるオニオン', 'ひらめきラッキョ', 'あきらめないネギ', 'スラスラにんにく', 'にこにこキャベツ'];
      expect(cuteNicknames).toContain(res.body.tip.nickname);
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
      // Create an expired token manually in MockDB
      const expiredToken = 'celeb_expired_mock_token_123';
      const celeb = mockDb.createParentalCelebration('test-student-id', 'attempt_seed_4', expiredToken);
      celeb.expiresAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // 1 day in the past

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

  describe('6. Right-to-Be-Forgotten Data Deletion (DELETE /api/users/me/data)', () => {
    it('should successfully cascade delete all user data and attempts', async () => {
      // 1. Double check the user exists in mockDb
      const student = mockDb.findUserById('test-student-id');
      expect(student).toBeDefined();

      // 2. Perform DELETE request to wipe out test student data
      const res = await request(app)
        .delete('/api/users/me/data')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body.message).toContain('完全に削除されました');

      // 3. Verify user has been completely deleted
      const deletedStudent = mockDb.findUserById('test-student-id');
      expect(deletedStudent).toBeUndefined();

      // 4. Verify associated data has also been completely cascaded
      const deletedAttempts = mockDb.attempts.filter(a => a.userId === 'test-student-id');
      expect(deletedAttempts.length).toBe(0);

      const deletedEnrollments = mockDb.classEnrollments.filter(e => e.userId === 'test-student-id');
      expect(deletedEnrollments.length).toBe(0);

      const deletedCelebrations = mockDb.parentalCelebrations.filter(c => c.childId === 'test-student-id');
      expect(deletedCelebrations.length).toBe(0);
    });
  });
});
