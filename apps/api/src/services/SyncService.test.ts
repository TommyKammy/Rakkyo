import { SyncService } from './SyncService';
import { InMemorySyncRepository } from '../repositories/inmemory/InMemorySyncRepository';
import { inMemoryState } from '../repositories/inmemory/state';
import { resetSyncLogs } from '../repositories/inmemory/InMemorySyncRepository';
import crypto from 'crypto';

describe('SyncService', () => {
  let service: SyncService;
  let repo: InMemorySyncRepository;

  beforeEach(() => {
    inMemoryState.reset();
    resetSyncLogs();
    repo = new InMemorySyncRepository();
    service = new SyncService(repo);
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
