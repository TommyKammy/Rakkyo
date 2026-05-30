/**
 * Per-user token-bucket rate limiter for offline sync requests (D-7, P2).
 *
 * The web flusher posts each queued attempt as its own `/api/sync/batch`
 * request, so the per-item throttle inside `SyncService.processBatch` (which
 * only delays between items *within* a single batch) never fires — every
 * request arrives as the first item. A modified client could therefore replay
 * many one-attempt batches and bypass the intended DB-write throttling.
 *
 * This module enforces the limit ACROSS requests, keyed by userId. A
 * well-behaved client already self-throttles to ~1 request/sec
 * (`SYNC_RATE_LIMIT_MS`), and the burst capacity absorbs legitimate
 * reconnect bursts (flushing a backlog one row per request) plus network
 * jitter, so honest clients are never rejected.
 *
 * NOTE: in-memory + single-process. // TODO(phase-16-D): Redis化必須 for
 * multi-process / horizontally-scaled deployments (mirrors the abuse-strike
 * and sync-log TODOs elsewhere).
 *
 * @module utils/syncRateLimiter
 */

import { SYNC_RATE_LIMIT_MS } from '@rakkyo/shared';

/**
 * Max tokens (burst). At steady state the bucket refills 1 token per
 * SYNC_RATE_LIMIT_MS, so sustained throughput is ~1 request/sec/user with a
 * 10-request burst allowance for reconnect backlogs.
 */
const BURST_CAPACITY = 10;

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, Bucket>();

/**
 * Attempt to consume one sync token for a user.
 * @param userId - The authenticated user's id
 * @param now - Current time in ms (injectable for tests)
 * @returns true if the request is allowed, false if rate-limited
 */
export function consumeSyncToken(
  userId: string,
  now: number = Date.now()
): boolean {
  let bucket = buckets.get(userId);
  if (!bucket) {
    bucket = { tokens: BURST_CAPACITY, lastRefill: now };
    buckets.set(userId, bucket);
  }

  // Refill proportionally to elapsed time (fractional tokens accumulate).
  const elapsed = now - bucket.lastRefill;
  if (elapsed > 0) {
    bucket.tokens = Math.min(
      BURST_CAPACITY,
      bucket.tokens + elapsed / SYNC_RATE_LIMIT_MS
    );
    bucket.lastRefill = now;
  }

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return true;
  }
  return false;
}

/** Reset all buckets — call from `beforeEach`/`afterEach` in tests. */
export function resetSyncRateLimiter(): void {
  buckets.clear();
}
