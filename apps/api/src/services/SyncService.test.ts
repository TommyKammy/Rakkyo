import { SyncService } from './SyncService';
import { InMemorySyncRepository } from '../repositories/inmemory/InMemorySyncRepository';
import { InMemoryCurriculumRepository } from '../repositories/inmemory/InMemoryCurriculumRepository';
import { InMemoryAttemptRepository } from '../repositories/inmemory/InMemoryAttemptRepository';
import { inMemoryState } from '../repositories/inmemory/state';
import { resetSyncLogs } from '../repositories/inmemory/InMemorySyncRepository';
import crypto from 'crypto';

describe('SyncService', () => {
  let service: SyncService;
  let repo: InMemorySyncRepository;
  let curriculumRepo: InMemoryCurriculumRepository;
  let attemptRepo: InMemoryAttemptRepository;

  beforeEach(() => {
    inMemoryState.reset();
    resetSyncLogs();
    repo = new InMemorySyncRepository();
    curriculumRepo = new InMemoryCurriculumRepository();
    attemptRepo = new InMemoryAttemptRepository();
    service = new SyncService(repo, curriculumRepo, attemptRepo);
  });

  // D-2: CRDT merge order independence — random insertion order → same XP
  it('produces same XP regardless of attempt insertion order (D-2)', async () => {
    const userId = 'test-student-id';
    const baseAttempts = Array.from({ length: 20 }, (_, i) => ({
      clientEventId: crypto.randomUUID(),
      userId,
      questionId: `q-${i}`,
      isCorrect: i % 3 !== 0, // 2/3 correct, 1/3 incorrect
      hintsUsed: i % 2,
      answerSubmitted: `answer-${i}`,
      createdAt: new Date(Date.now() - (20 - i) * 60000).toISOString(),
    }));

    // First pass: insert in order
    const result1 = await service.processBatch(userId, baseAttempts, 'dev1');

    // Reset state
    inMemoryState.reset();
    resetSyncLogs();

    // Second pass: insert in reverse order
    const reversed = [...baseAttempts].reverse();
    const result2 = await service.processBatch(userId, reversed, 'dev2');

    // XP must be identical regardless of insertion order
    expect(result1.serverStats.currentXp).toBe(result2.serverStats.currentXp);
    expect(result1.serverStats.level).toBe(result2.serverStats.level);
  });

  // D-1: Idempotent re-send — same clientEventId inserted once
  it('handles idempotent re-sends correctly (D-1)', async () => {
    const userId = 'test-student-id';
    const eventId = crypto.randomUUID();
    const attempt = {
      clientEventId: eventId,
      userId,
      questionId: 'q1',
      isCorrect: true,
      hintsUsed: 0,
      answerSubmitted: '42',
      createdAt: new Date().toISOString(),
    };

    // Send once
    const result1 = await service.processBatch(userId, [attempt], 'dev1');
    expect(result1.results[0].status).toBe('created');

    // Send again (same eventId)
    const result2 = await service.processBatch(userId, [attempt], 'dev1');
    expect(result2.results[0].status).toBe('duplicate');
  });

  // Concurrent fire test: 8 parallel batch requests
  it('handles 8 concurrent batch requests safely', async () => {
    const userId = 'test-student-id';

    const batches = Array.from({ length: 8 }, (_, i) => ({
      attempts: [
        {
          clientEventId: crypto.randomUUID(),
          userId,
          questionId: `q-concurrent-${i}`,
          isCorrect: true,
          hintsUsed: 0,
          answerSubmitted: `a-${i}`,
          createdAt: new Date().toISOString(),
        },
      ],
      deviceId: `dev-${i}`,
    }));

    // Fire all 8 in parallel
    const results = await Promise.all(
      batches.map((b) =>
        service.processBatch(userId, b.attempts, b.deviceId)
      )
    );

    // All should succeed
    const totalCreated = results.reduce(
      (sum, r) => sum + r.results.filter((a) => a.status === 'created').length,
      0
    );
    expect(totalCreated).toBe(8);
  });

  // P1 regression: legitimate offline sessions longer than 1 hour must still sync.
  // Previously a 1h ABUSE_WINDOW_MS gate dropped every attempt older than 1h,
  // breaking the core offline-first promise (commute / multi-day disconnect).
  it('accepts attempts older than 1 hour but within the offline retention window (P1)', async () => {
    const userId = 'test-student-id';
    const tenHoursAgo = new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString();
    const result = await service.processBatch(
      userId,
      [
        {
          clientEventId: crypto.randomUUID(),
          userId,
          questionId: 'q-old',
          isCorrect: true,
          hintsUsed: 0,
          answerSubmitted: '42',
          createdAt: tenHoursAgo,
        },
      ],
      'dev-old'
    );

    expect(result.results[0].status).toBe('created');
  });

  // P1 regression: timestamps beyond the offline retention window must still
  // be rejected so forged-old payloads cannot replay arbitrary history.
  it('rejects attempts older than the 30-day offline window (P1)', async () => {
    const userId = 'test-student-id';
    const longAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const result = await service.processBatch(
      userId,
      [
        {
          clientEventId: crypto.randomUUID(),
          userId,
          questionId: 'q-ancient',
          isCorrect: true,
          hintsUsed: 0,
          answerSubmitted: '42',
          createdAt: longAgo,
        },
      ],
      'dev-ancient'
    );

    expect(result.results[0].status).toBe('rejected');
  });

  // P1 regression: future-skewed timestamps remain rejected (only ±5min clock-drift allowed).
  it('rejects attempts with future timestamps beyond clock-skew allowance (P1)', async () => {
    const userId = 'test-student-id';
    const futureTs = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const result = await service.processBatch(
      userId,
      [
        {
          clientEventId: crypto.randomUUID(),
          userId,
          questionId: 'q-future',
          isCorrect: true,
          hintsUsed: 0,
          answerSubmitted: '42',
          createdAt: futureTs,
        },
      ],
      'dev-future'
    );

    expect(result.results[0].status).toBe('rejected');
  });

  // P1 regression: client-supplied isReview/hintsUsed must be ignored / clamped server-side.
  it('derives isReview server-side instead of trusting the client (P1)', async () => {
    const userId = 'test-student-id';
    const questionId = 'q-review-test';

    // Pre-seed a prior correct attempt with an explicitly older timestamp so
    // the server-side isReview derivation (strict <) can detect it.
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    inMemoryState.attempts.push({
      id: 'prior-attempt-1',
      userId,
      questionId,
      isCorrect: true,
      hintsUsed: 0,
      answerSubmitted: 'right',
      durationSeconds: 10,
      errorType: null,
      aiDiagnosis: null,
      createdAt: oneHourAgo,
      isReview: false,
    });

    // First scenario: a "fresh" question with no prior history — even if the
    // client tries to claim isReview=true, the server must force it to false.
    const eventIdFresh = crypto.randomUUID();
    const eventIdReview = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    const result = await service.processBatch(
      userId,
      [
        {
          clientEventId: eventIdFresh,
          userId,
          questionId: 'q-fresh-no-prior',
          isCorrect: true,
          hintsUsed: 0,
          answerSubmitted: 'whatever',
          isReview: true, // forged
          createdAt: nowIso,
        },
        {
          clientEventId: eventIdReview,
          userId,
          questionId,
          isCorrect: true,
          hintsUsed: 0,
          answerSubmitted: 'right',
          isReview: false, // client doesn't admit it, but server sees prior correct attempt
          createdAt: nowIso,
        },
      ],
      'dev-isreview'
    );

    expect(result.results.every((r) => r.status === 'created')).toBe(true);

    // Inspect what was actually persisted in the in-memory store.
    const persisted = inMemoryState.attempts.filter(
      (a) => a.userId === userId
    );
    const fresh = persisted.find((a) => a.questionId === 'q-fresh-no-prior');
    const review = persisted.find(
      (a) =>
        a.questionId === questionId &&
        a.id !== persisted.find((p) => p.questionId === questionId && p.hintsUsed === 0)?.id
    );

    expect(fresh?.isReview).toBe(false); // client forgery rejected
    // Find the newly-synced review attempt — there will be two for `questionId`:
    // the pre-seeded one (no clientEventId in inMemoryState) and the new one.
    const newlySyncedReview = persisted
      .filter((a) => a.questionId === questionId)
      .find((a) => a.clientEventId === eventIdReview);
    expect(newlySyncedReview?.isReview).toBe(true); // server-derived
  });

  it('clamps client-supplied hintsUsed to the curriculum stage cap (P1)', async () => {
    const userId = 'test-student-id';
    const eventId = crypto.randomUUID();

    await service.processBatch(
      userId,
      [
        {
          clientEventId: eventId,
          userId,
          questionId: 'q-hints-clamp',
          isCorrect: true,
          hintsUsed: 999, // forged
          answerSubmitted: 'whatever',
          createdAt: new Date().toISOString(),
        },
      ],
      'dev-hints'
    );

    const persisted = inMemoryState.attempts.find(
      (a) => a.clientEventId === eventId
    );
    expect(persisted?.hintsUsed).toBe(3);
  });

  // Sync log is recorded for each batch
  it('records sync log for each batch', async () => {
    const userId = 'test-student-id';

    await service.processBatch(
      userId,
      [
        {
          clientEventId: crypto.randomUUID(),
          userId,
          questionId: 'q1',
          isCorrect: true,
          hintsUsed: 0,
          answerSubmitted: '42',
          createdAt: new Date().toISOString(),
        },
      ],
      'dev1'
    );

    // Sync log should exist (checked via the syncedAt in response)
    // The InMemorySyncRepository stores logs internally
    // We verify indirectly via the successful response structure
    const result = await service.processBatch(
      userId,
      [
        {
          clientEventId: crypto.randomUUID(),
          userId,
          questionId: 'q2',
          isCorrect: false,
          hintsUsed: 2,
          answerSubmitted: 'wrong',
          createdAt: new Date().toISOString(),
        },
      ],
      'dev1'
    );

    expect(result.syncedAt).toBeDefined();
    expect(result.results[0].status).toBe('created');
  });
});
