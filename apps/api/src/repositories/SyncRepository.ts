/**
 * Repository interface for offline sync operations (Phase 16-D).
 * Handles idempotent attempt creation and sync audit logging.
 */
export interface SyncRepository {
  /**
   * Create an attempt idempotently using the clientEventId as dedup key (D-1).
   * If an attempt with the same clientEventId already exists, return it
   * without creating a duplicate.
   * @param data - The attempt data including clientEventId
   * @returns Object with `created` flag (true if newly inserted) and the attempt record
   */
  createAttemptIdempotent(data: {
    clientEventId: string;
    userId: string;
    questionId: string;
    isCorrect: boolean;
    hintsUsed: number;
    answerSubmitted: string;
    durationSeconds?: number | null;
    errorType?: string | null;
    isReview?: boolean | null;
    createdAt: Date;
  }): Promise<{ created: boolean; attempt: { id: string; clientEventId: string } }>;

  /**
   * Look up an already-persisted attempt by its idempotency key (D-1).
   * Used to short-circuit re-sent attempts (e.g. a successful write whose
   * response was lost) BEFORE applying the timestamp window, so a late retry
   * is reported as `duplicate` rather than spuriously rejected.
   * @param clientEventId - The client-generated idempotency key
   * @returns The existing attempt id, or null if not found
   */
  findAttemptByClientEventId(
    clientEventId: string
  ): Promise<{ id: string } | null>;

  /**
   * Record a sync operation in the audit log.
   * @param data - Sync log metadata
   */
  createSyncLog(data: {
    userId: string;
    deviceId: string;
    attemptCount: number;
    status: string;
    errorDetails?: string | null;
  }): Promise<{ id: string }>;

  /**
   * Recalculate user aggregate stats (XP, level, streak) from Attempt records.
   * This ensures the server is the single source of truth for computed values (D-2).
   * @param userId - The user to recalculate stats for
   * @returns Updated aggregate values
   */
  recalculateUserStats(userId: string): Promise<{
    currentXp: number;
    level: number;
    streakCount: number;
  }>;

  /**
   * Check if a boss battle is still accepting damage at the given timestamp (D-9).
   * @param battleId - The boss battle ID
   * @param atTimestamp - The client-side timestamp of the attack
   */
  isBossBattleAcceptingDamage(
    battleId: string,
    atTimestamp: Date
  ): Promise<boolean>;
}
