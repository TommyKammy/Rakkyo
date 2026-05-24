import request from 'supertest';
import app from '../app';
import { inMemoryState } from '../repositories/inmemory/state';
import { speechFileSweeper, SPEECH_TEMP_DIR } from '../services/SpeechFileSweeper';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

function createMockWavBuffer(durationSeconds: number, sampleRate = 16000, numChannels = 1, bitsPerSample = 16): Buffer {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = Math.floor(durationSeconds * byteRate);
  const totalFileSize = 36 + dataSize;

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(totalFileSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size
  header.writeUInt16LE(1, 20); // AudioFormat (PCM = 1)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  const data = Buffer.alloc(dataSize); // filled with zeros
  return Buffer.concat([header, data]);
}

describe('Phase 16-C: Speech Pronunciation Analysis Integration Tests', () => {
  let token: string;
  let userId: string;
  let testEmail = 'speech-student@rakkyo.com';

  beforeAll(async () => {
    // Start background file sweeper
    speechFileSweeper.start();

    // Register a fresh test student user
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: 'password123',
        nickname: 'コオニオンくん',
        schoolYear: 1,
        parentalConsent: true
      });

    token = registerRes.body.token;
    userId = registerRes.body.user.id;
  });

  afterAll(async () => {
    // Stop background sweeper to avoid Jest hanging handles
    speechFileSweeper.stop();
  });

  beforeEach(() => {
    // Keep user state but clean speech-specific arrays in mock database for isolated tests
    inMemoryState.microphoneConsents = [];
    inMemoryState.speechDailyQuotas = [];
    inMemoryState.phonemeStruggles = [];
    inMemoryState.speechAnalyses = [];
  });

  describe('マイク使用安全同意ダイアログ & 設定 API (P16C-004 & 005)', () => {
    it('should save user microphone safety consent with ipHash logging', async () => {
      const res = await request(app)
        .post('/api/speech/consent')
        .set('Authorization', `Bearer ${token}`)
        .send({
          consentVersion: 'v1.0',
          userAgent: 'Mozilla/5.0 Jest-Test-Agent'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.consent.consentVersion).toBe('v1.0');
      expect(res.body.consent.ipHash).toBeDefined();

      const storedConsent = inMemoryState.microphoneConsents.find(c => c.userId === userId);
      expect(storedConsent).toBeDefined();
      expect(storedConsent?.consentVersion).toBe('v1.0');
    });

    it('should update inclusive user speechAnalysisEnabled toggle settings', async () => {
      const res = await request(app)
        .post('/api/speech/settings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          speechAnalysisEnabled: false
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.speechAnalysisEnabled).toBe(false);

      const user = inMemoryState.users.find(u => u.id === userId);
      expect(user?.speechAnalysisEnabled).toBe(false);

      // Restore it to true
      await request(app)
        .post('/api/speech/settings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          speechAnalysisEnabled: true
        });
    });

    it('should update user speechAnalyticsConsent opt-in settings', async () => {
      const res = await request(app)
        .post('/api/speech/consent-opt-in')
        .set('Authorization', `Bearer ${token}`)
        .send({
          speechAnalyticsConsent: true
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.speechAnalyticsConsent).toBe(true);

      const user = inMemoryState.users.find(u => u.id === userId);
      expect(user?.speechAnalyticsConsent).toBe(true);
    });
  });

  describe('発音解析 API ゲートチェック (/api/speech/analyze)', () => {
    const validAudioBase64 = createMockWavBuffer(5).toString('base64');

    it('should reject requests without microphone safety consent (403 Forbidden)', async () => {
      // No consent registered in beforeEach. Call analyze immediately.
      const res = await request(app)
        .post('/api/speech/analyze')
        .set('Authorization', `Bearer ${token}`)
        .send({
          audioBase64: validAudioBase64,
          expectedText: 'Hello world',
          languageCode: 'en-US'
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('マイク使用への同意が得られていません');
    });

    it('should reject audio data exceeding the 30-second cap (400 Bad Request)', async () => {
      // Register consent first
      await request(app)
        .post('/api/speech/consent')
        .set('Authorization', `Bearer ${token}`)
        .send({ consentVersion: 'v1', userAgent: 'test' });

      // Generate structurally valid WAV > 30 seconds (35s) to simulate overlength
      const longBase64 = createMockWavBuffer(35).toString('base64');

      const res = await request(app)
        .post('/api/speech/analyze')
        .set('Authorization', `Bearer ${token}`)
        .send({
          audioBase64: longBase64,
          expectedText: 'Hello world',
          languageCode: 'en-US'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('録音時間は最大30秒までです');
    });

    it('should reject malformed base64 strings containing invalid characters (400 Bad Request)', async () => {
      await request(app)
        .post('/api/speech/consent')
        .set('Authorization', `Bearer ${token}`)
        .send({ consentVersion: 'v1', userAgent: 'test' });

      const res = await request(app)
        .post('/api/speech/analyze')
        .set('Authorization', `Bearer ${token}`)
        .send({
          audioBase64: 'invalid_base64_string_with_!',
          expectedText: 'Hello world',
          languageCode: 'en-US'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Base64形式ではありません');
    });

    it('should reject non-WAV / non-RIFF audio binary headers (400 Bad Request)', async () => {
      // Register consent first
      await request(app)
        .post('/api/speech/consent')
        .set('Authorization', `Bearer ${token}`)
        .send({ consentVersion: 'v1', userAgent: 'test' });

      const nonWavBase64 = Buffer.from('NOTRIFF..NOTWAVE..dummybinarydata').toString('base64');

      const res = await request(app)
        .post('/api/speech/analyze')
        .set('Authorization', `Bearer ${token}`)
        .send({
          audioBase64: nonWavBase64,
          expectedText: 'Hello world',
          languageCode: 'en-US'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('WAV形式である必要があります');
    });

    it('should enforce the daily quota of 50 requests per user', async () => {
      // 1. Consent
      await request(app)
        .post('/api/speech/consent')
        .set('Authorization', `Bearer ${token}`)
        .send({ consentVersion: 'v1', userAgent: 'test' });

      // 2. Set mock daily quota count to 50
      const jstTime = new Date(Date.now() + 9 * 60 * 60 * 1000);
      const dayBucket = jstTime.toISOString().split('T')[0];
      inMemoryState.speechDailyQuotas.push({
        id: 'quota_full',
        userId,
        dayBucket,
        count: 50,
        resetAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // 3. Make the 51st call
      const res = await request(app)
        .post('/api/speech/analyze')
        .set('Authorization', `Bearer ${token}`)
        .send({
          audioBase64: validAudioBase64,
          expectedText: 'Hello world',
          languageCode: 'en-US'
        });

      expect(res.status).toBe(429);
      expect(res.body.error).toContain('本日の発音練習の上限（50回）に達しました');
    });
  });

  describe('音素信頼度の離散化 & レスポンス検証 (Constraint C-3)', () => {
    const validAudioBase64 = createMockWavBuffer(5).toString('base64');

    beforeEach(async () => {
      // Register consent
      await request(app)
        .post('/api/speech/consent')
        .set('Authorization', `Bearer ${token}`)
        .send({ consentVersion: 'v1', userAgent: 'test' });
    });

    it('should return discretized levels and completely filter out raw float confidence values', async () => {
      const res = await request(app)
        .post('/api/speech/analyze')
        .set('Authorization', `Bearer ${token}`)
        .send({
          audioBase64: validAudioBase64,
          expectedText: 'This is standard pronunciation',
          languageCode: 'en-US'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.words).toBeDefined();

      // Ensure every phoneme result has level but does NOT contain raw confidence key
      for (const w of res.body.words) {
        expect(w.word).toBeDefined();
        for (const p of w.phonemes) {
          expect(p.phoneme).toBeDefined();
          expect(['strong', 'soft', 'unclear']).toContain(p.level);
          expect(p.confidence).toBeUndefined(); // STRICT: NO numeric leaks!
        }
      }
    });
  });

  describe('つまずきカルテ & 保護者オプトイン検証 (Constraint C-4)', () => {
    const validAudioBase64 = createMockWavBuffer(5).toString('base64');

    beforeEach(async () => {
      // Register consent
      await request(app)
        .post('/api/speech/consent')
        .set('Authorization', `Bearer ${token}`)
        .send({ consentVersion: 'v1', userAgent: 'test' });
    });

    it('should NOT accumulate phoneme struggles in DB if parent has opt-ed out (default)', async () => {
      // Opt-out user speechAnalyticsConsent
      await request(app)
        .post('/api/speech/consent-opt-in')
        .set('Authorization', `Bearer ${token}`)
        .send({ speechAnalyticsConsent: false });

      // Analyze with expectedText containing trigger 'bad' to yield unclear level
      const res = await request(app)
        .post('/api/speech/analyze')
        .set('Authorization', `Bearer ${token}`)
        .send({
          audioBase64: validAudioBase64,
          expectedText: 'bad weather',
          languageCode: 'en-US'
        });

      expect(res.status).toBe(200);
      // Verify that struggle count remains zero in DB
      expect(inMemoryState.phonemeStruggles).toHaveLength(0);
    });

    it('should accumulate struggling phonemes if parent has explicitly opt-ed in', async () => {
      // Opt-in parent analytics
      await request(app)
        .post('/api/speech/consent-opt-in')
        .set('Authorization', `Bearer ${token}`)
        .send({ speechAnalyticsConsent: true });

      // Analyze with trigger word 'bad' for soft/unclear levels
      const res = await request(app)
        .post('/api/speech/analyze')
        .set('Authorization', `Bearer ${token}`)
        .send({
          audioBase64: validAudioBase64,
          expectedText: 'bad weather', // contains 'a' (ae) and 'th' -> both fail
          languageCode: 'en-US'
        });

      expect(res.status).toBe(200);
      expect(inMemoryState.phonemeStruggles.length).toBeGreaterThan(0);
      
      const struggle = inMemoryState.phonemeStruggles.find(s => s.phoneme === 'ae');
      expect(struggle).toBeDefined();
      expect(struggle?.struggleCount).toBe(1);
    });
  });

  describe('7秒自己破棄・監査ログ & ファイルスイーパー検証 (Constraint C-1)', () => {
    const validAudioBase64 = createMockWavBuffer(5).toString('base64');

    beforeEach(async () => {
      // Register consent
      await request(app)
        .post('/api/speech/consent')
        .set('Authorization', `Bearer ${token}`)
        .send({ consentVersion: 'v1', userAgent: 'test' });
    });

    it('should delete local file synchronously on successful analysis and write a deletion audit log', async () => {
      const res = await request(app)
        .post('/api/speech/analyze')
        .set('Authorization', `Bearer ${token}`)
        .send({
          audioBase64: validAudioBase64,
          expectedText: 'Hello world',
          languageCode: 'en-US'
        });

      expect(res.status).toBe(200);

      // Verify no temporary files remain in /tmp/rakkyo-speech
      const remainingFiles = fs.readdirSync(SPEECH_TEMP_DIR);
      expect(remainingFiles).toHaveLength(0);

      // Verify deletion audit trail was written
      expect(inMemoryState.speechAnalyses).toHaveLength(1);
      expect(inMemoryState.speechAnalyses[0].audioDeletedAt).toBeDefined();
    });

    it('should delete local file synchronously even if STT processing fails (errors)', async () => {
      // Simulate failure by sending invalid expectedText (triggers Zod Error)
      const res = await request(app)
        .post('/api/speech/analyze')
        .set('Authorization', `Bearer ${token}`)
        .send({
          audioBase64: validAudioBase64,
          expectedText: '', // invalid
          languageCode: 'en-US'
        });

      expect(res.status).toBe(400);

      // Verify no temporary files left
      const remainingFiles = fs.readdirSync(SPEECH_TEMP_DIR);
      expect(remainingFiles).toHaveLength(0);
    });

    it('should forcefully delete file in background sweeper if modification time is older than 7 seconds', async () => {
      // 1. Manually write a stale file
      const fileUUID = crypto.randomUUID();
      const filePath = path.join(SPEECH_TEMP_DIR, `stale_${fileUUID}.wav`);
      fs.writeFileSync(filePath, Buffer.from('mock-stale-wav-data'));

      // Back-date file modification time to 10 seconds ago
      const staleTime = (Date.now() - 10000) / 1000;
      fs.utimesSync(filePath, staleTime, staleTime);

      // 2. Trigger sweeper manually for deterministic check
      await speechFileSweeper.sweep();

      // 3. Verify file was deleted from disk
      expect(fs.existsSync(filePath)).toBe(false);
    });
  });

  describe('GDPR-K Right-to-Be-Forgotton (RTBF) Cascading Purges', () => {
    it('should delete all speech-related tables symmetrically when user deletes their account data', async () => {
      // Seed mock records for this student
      inMemoryState.microphoneConsents.push({
        id: 'c1', userId, consentedAt: 'date', consentVersion: 'v1', userAgent: 'agent', ipHash: 'ip', createdAt: 'date'
      });
      inMemoryState.phonemeStruggles.push({
        id: 's1', userId, phoneme: 'th', struggleCount: 3, updatedAt: 'date'
      });
      inMemoryState.speechDailyQuotas.push({
        id: 'q1', userId, dayBucket: '2026-05-24', count: 5, resetAt: 'date', createdAt: 'date', updatedAt: 'date'
      });
      inMemoryState.speechAnalyses.push({
        id: 'a1', userId, lessonId: null, audioDeletedAt: 'date', createdAt: 'date'
      });

      // Invoke RTBF
      const deleteRes = await request(app)
        .delete('/api/users/me/data')
        .set('Authorization', `Bearer ${token}`);

      expect(deleteRes.status).toBe(200);

      // Symmetrically assert all user-related speech records are cascadingly purged
      expect(inMemoryState.microphoneConsents.find(c => c.userId === userId)).toBeUndefined();
      expect(inMemoryState.phonemeStruggles.filter(s => s.userId === userId)).toHaveLength(0);
      expect(inMemoryState.speechDailyQuotas.filter(q => q.userId === userId)).toHaveLength(0);
      expect(inMemoryState.speechAnalyses.filter(a => a.userId === userId)).toHaveLength(0);
    });
  });
});
