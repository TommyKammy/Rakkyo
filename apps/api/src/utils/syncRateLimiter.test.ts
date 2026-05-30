import { consumeSyncToken, resetSyncRateLimiter } from './syncRateLimiter';

describe('syncRateLimiter (D-7 / P2 per-user throttle across requests)', () => {
  beforeEach(() => resetSyncRateLimiter());
  afterEach(() => resetSyncRateLimiter());

  it('allows a burst up to capacity then rejects further immediate requests', () => {
    const userId = 'u1';
    const now = 1_000_000;
    // 10 immediate requests (burst capacity) succeed.
    for (let i = 0; i < 10; i++) {
      expect(consumeSyncToken(userId, now)).toBe(true);
    }
    // 11th immediate request is rate-limited.
    expect(consumeSyncToken(userId, now)).toBe(false);
  });

  it('refills ~1 token per SYNC_RATE_LIMIT_MS', () => {
    const userId = 'u2';
    const now = 2_000_000;
    // Drain the bucket.
    for (let i = 0; i < 10; i++) consumeSyncToken(userId, now);
    expect(consumeSyncToken(userId, now)).toBe(false);

    // After 1 second, one token should have refilled.
    expect(consumeSyncToken(userId, now + 1000)).toBe(true);
    // ...and immediately empty again.
    expect(consumeSyncToken(userId, now + 1000)).toBe(false);
  });

  it('isolates buckets per user', () => {
    const now = 3_000_000;
    for (let i = 0; i < 10; i++) consumeSyncToken('a', now);
    expect(consumeSyncToken('a', now)).toBe(false);
    // A different user has a fresh bucket.
    expect(consumeSyncToken('b', now)).toBe(true);
  });

  it('sustains ~1 request/sec indefinitely (well-behaved client)', () => {
    const userId = 'u3';
    let now = 4_000_000;
    // Drain burst first.
    for (let i = 0; i < 10; i++) consumeSyncToken(userId, now);
    // Then one request per second should always pass.
    for (let i = 0; i < 20; i++) {
      now += 1000;
      expect(consumeSyncToken(userId, now)).toBe(true);
    }
  });
});
