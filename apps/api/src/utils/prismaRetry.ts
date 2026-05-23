/**
 * Retry helper for Prisma serializable transactions that may abort with
 * P2034 (transaction conflict) or P2002 (unique-constraint conflict, e.g.
 * two concurrent first-time INSERTs racing on the same unique key).
 *
 * Without retry these surface as HTTP 500 to the client even though the
 * caller's intent — "increment my quota" / "transition this status if it
 * matches expected" — is deterministically resolvable by trying again.
 *
 * Usage:
 *   return withPrismaRetry(() => prisma.$transaction(async (tx) => {
 *     ...
 *   }, { isolationLevel: 'Serializable' }));
 */

const RETRYABLE_CODES = new Set([
  'P2034', // Transaction conflict / serialization failure
  'P2002', // Unique constraint violation — common in racing first-write
]);

export interface RetryOptions {
  /** Maximum number of attempts including the first try. Default 4. */
  maxAttempts?: number;
  /** Base delay in ms between attempts. Default 10. Each retry doubles. */
  baseDelayMs?: number;
}

function isRetryablePrismaError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = (err as { code?: unknown }).code;
  return typeof code === 'string' && RETRYABLE_CODES.has(code);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withPrismaRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {}
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 4;
  const baseDelayMs = opts.baseDelayMs ?? 10;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isRetryablePrismaError(err) || attempt === maxAttempts) {
        throw err;
      }
      // Exponential backoff with a small jitter to avoid lockstep retries.
      const jitter = Math.floor(Math.random() * baseDelayMs);
      await delay(baseDelayMs * 2 ** (attempt - 1) + jitter);
    }
  }
  // Unreachable — the loop either returns or throws.
  throw lastError;
}
