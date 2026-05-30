import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';
import { inMemoryState } from '../repositories/inmemory/state';
import { resetSyncLogs } from '../repositories/inmemory/InMemorySyncRepository';

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'rakkyo-super-secret-key-12345';

// Use the existing seed IDs from inMemoryState
const TEST_USER_ID = 'test-student-id';

/** Helper to create a test JWT. */
function makeToken(userId: string, role = 'STUDENT'): string {
  return jwt.sign(
    { userId, tenantId: 'test-tenant-id', role },
    JWT_SECRET
  );
}

/** Create a valid attempt payload with UUID-formatted questionId. */
function makeAttempt(overrides: Record<string, unknown> = {}) {
  return {
    clientEventId: crypto.randomUUID(),
    userId: crypto.randomUUID(), // Zod requires UUID format
    questionId: crypto.randomUUID(),
    isCorrect: true,
    hintsUsed: 0,
    answerSubmitted: '-2',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Seed a curriculum-resolvable question matching the attempt so the
 * server-side reject-unknown-questionId guard accepts the payload.
 */
function seedQuestionFromAttempt(attempt: { questionId: string; answerSubmitted: string }) {
  inMemoryState.dynamicQuestions.push({
    id: attempt.questionId,
    lessonId: 'test-lesson',
    prompt: attempt.questionId,
    type: 'TEXT_SHORT',
    answers: [attempt.answerSubmitted],
    options: [],
    explanation: '',
    hints: [],
    createdAt: new Date().toISOString(),
  } as any);
}

describe('POST /api/sync/batch', () => {
  beforeEach(() => {
    inMemoryState.reset();
    resetSyncLogs();
  });

  // D-10: Idempotency key dedup — same clientEventId × 10 → DB has 1 entry
  it('deduplicates attempts with the same clientEventId (D-1)', async () => {
    const token = makeToken(TEST_USER_ID);
    const clientEventId = crypto.randomUUID();
    const attempt = makeAttempt({ clientEventId });
    seedQuestionFromAttempt(attempt);

    const body = {
      attempts: [attempt],
      schemaVersion: 1,
      deviceId: 'test-device',
    };

    // Send the same attempt 10 times
    const results: string[] = [];
    for (let i = 0; i < 10; i++) {
      const res = await request(app)
        .post('/api/sync/batch')
        .set('Authorization', `Bearer ${token}`)
        .send(body);
      expect(res.status).toBe(200);
      results.push(res.body.results[0].status);
    }

    // First should be 'created', rest should be 'duplicate'
    expect(results[0]).toBe('created');
    expect(results.slice(1).every((s) => s === 'duplicate')).toBe(true);

    // Only 1 attempt in the DB with this clientEventId
    const attempts = inMemoryState.attempts.filter(
      (a) => a.clientEventId === clientEventId
    );
    expect(attempts.length).toBe(1);
  });

  // D-2: Server recalculates XP from all attempts
  it('recalculates user stats server-side (D-2)', async () => {
    const token = makeToken(TEST_USER_ID);
    const attempt = makeAttempt();
    seedQuestionFromAttempt(attempt);

    const res = await request(app)
      .post('/api/sync/batch')
      .set('Authorization', `Bearer ${token}`)
      .send({
        attempts: [attempt],
        schemaVersion: 1,
        deviceId: 'test-device',
      });

    expect(res.status).toBe(200);
    expect(res.body.serverStats).toBeDefined();
    expect(res.body.serverStats.currentXp).toBeGreaterThan(0);
    expect(res.body.serverStats.level).toBeGreaterThanOrEqual(1);
  });

  // Validation failure returns 400
  it('rejects invalid batch with 400', async () => {
    const token = makeToken(TEST_USER_ID);

    const res = await request(app)
      .post('/api/sync/batch')
      .set('Authorization', `Bearer ${token}`)
      .send({ attempts: [], schemaVersion: 1, deviceId: 'd' });

    expect(res.status).toBe(400);
  });

  // D-6: Schema version 0 is rejected at Zod validation level (min=1).
  // The 409 path activates when MIN_CLIENT_SCHEMA_VERSION is bumped above 1
  // in a future release — at that point schemaVersion=1 clients would get 409.
  it('rejects schema version 0 as invalid input (D-6 Zod guard)', async () => {
    const token = makeToken(TEST_USER_ID);

    const res = await request(app)
      .post('/api/sync/batch')
      .set('Authorization', `Bearer ${token}`)
      .send({
        attempts: [makeAttempt()],
        schemaVersion: 0,
        deviceId: 'test-device',
      });

    // Zod rejects schemaVersion < 1 before route logic runs
    expect(res.status).toBe(400);
  });

  // P2: schemaVersion newer than the server's must be rejected with 409 so
  // the client holds local data until the server catches up.
  it('rejects schema version newer than server with 409 (P2)', async () => {
    const token = makeToken(TEST_USER_ID);
    const attempt = makeAttempt();
    seedQuestionFromAttempt(attempt);

    const res = await request(app)
      .post('/api/sync/batch')
      .set('Authorization', `Bearer ${token}`)
      .send({
        attempts: [attempt],
        schemaVersion: 999,
        deviceId: 'test-device',
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('schema_version_mismatch');
  });

  // Unauthenticated request returns 401
  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app)
      .post('/api/sync/batch')
      .send({ attempts: [], schemaVersion: 1, deviceId: 'd' });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/sync/schema-version', () => {
  // PUBLIC endpoint — no auth needed (D-6)
  it('returns current schema version without auth', async () => {
    const res = await request(app).get('/api/sync/schema-version');

    expect(res.status).toBe(200);
    expect(res.body.version).toBe(1);
    expect(res.body.minClientVersion).toBe(1);
    expect(res.body.migrationRequired).toBe(false);
  });
});

describe('GET /api/sync/hints/:lessonId', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/sync/hints/lesson-1');
    expect(res.status).toBe(401);
  });

  it('returns 404 for non-existent lesson', async () => {
    const token = makeToken(TEST_USER_ID);

    const res = await request(app)
      .get('/api/sync/hints/nonexistent-lesson-id')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

describe('GET /api/sync/ai-cache', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/sync/ai-cache');
    expect(res.status).toBe(401);
  });

  it('returns cached AI diagnoses for logged-in user', async () => {
    const token = makeToken(TEST_USER_ID);

    const res = await request(app)
      .get('/api/sync/ai-cache')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.entries).toBeDefined();
    expect(Array.isArray(res.body.entries)).toBe(true);
  });
});
