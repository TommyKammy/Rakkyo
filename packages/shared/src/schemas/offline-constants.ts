/** Current offline DB schema version. Bump when local table structure changes. */
export const OFFLINE_SCHEMA_VERSION = 1;

/** Minimum client schema version the server will accept sync from. */
export const MIN_CLIENT_SCHEMA_VERSION = 1;

/** Maximum number of attempts in a single sync batch. */
export const MAX_SYNC_BATCH_SIZE = 50;

/** Rate limit between sync entries in milliseconds (1 entry/sec for abuse prevention, D-7). */
export const SYNC_RATE_LIMIT_MS = 1000;

/** Maximum AI response cache size in bytes (100 MB, D-5). */
export const AI_CACHE_MAX_BYTES = 100 * 1024 * 1024;

/** Threshold after which cached AI responses are marked as stale (24 hours, D-5). */
export const AI_CACHE_STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

/** Number of questions to prefetch AI diagnosis for (D-5 / P16D-003). */
export const HINT_PREFETCH_COUNT = 30;

/**
 * @deprecated Do NOT use as the offline-sync acceptance window.
 *
 * This constant was previously used by `/api/sync/batch` to reject attempts
 * older than 1 hour, which incorrectly dropped legitimate offline sessions
 * (commute / multi-day disconnection). Use {@link OFFLINE_SYNC_MAX_AGE_MS}
 * instead for sync acceptance, and keep this only for short-window abuse
 * heuristics that are explicitly meant to fire within an hour.
 */
export const ABUSE_WINDOW_MS = 60 * 60 * 1000;

/**
 * Maximum acceptable age (ms) for an offline attempt's `createdAt`
 * when reconciling via `/api/sync/batch` (P1: offline-first preservation).
 *
 * Offline sessions must be allowed to outlive the abuse window — children
 * frequently study during multi-day disconnections (commute / trips / poor WiFi).
 * Setting this to 30 days keeps the window finite (cap forged-old timestamps)
 * while supporting the realistic offline use cases the PWA was built for.
 */
export const OFFLINE_SYNC_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** Maximum future-clock skew (ms) accepted for offline attempt `createdAt`. */
export const OFFLINE_SYNC_FUTURE_SKEW_MS = 5 * 60 * 1000;

/** Sync status values for local offline attempts. */
export const SYNC_STATUS = {
  PENDING: 'PENDING',
  SYNCING: 'SYNCING',
  SYNCED: 'SYNCED',
  FAILED: 'FAILED',
} as const;

export type SyncStatus = typeof SYNC_STATUS[keyof typeof SYNC_STATUS];
