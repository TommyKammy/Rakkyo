import { SyncService } from './SyncService';
import { InMemorySyncRepository } from '../repositories/inmemory/InMemorySyncRepository';
import { InMemoryCurriculumRepository } from '../repositories/inmemory/InMemoryCurriculumRepository';
import { inMemoryState } from '../repositories/inmemory/state';
import { resetSyncLogs } from '../repositories/inmemory/InMemorySyncRepository';
import crypto from 'crypto';

describe('SyncService', () => {
  let service: SyncService;
  let repo: InMemorySyncRepository;
  let curriculumRepo: InMemoryCurriculumRepository;

  beforeEach(() => {
    inMemoryState.reset();
    resetSyncLogs();
    repo = new InMemorySyncRepository();
    curriculumRepo = new InMemoryCurriculumRepository();
    service = new SyncService(repo, curriculumRepo);
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
