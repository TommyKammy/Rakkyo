import { RepositoryContainer } from '../repositories';

export const WINDOW_MS = 60 * 60 * 1000; // 1 hour rolling window
export const LOCK_THRESHOLD = 3;
export const LOCK_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export type AbuseSource = 'hint' | 'hirameki';

export interface AbuseTrackResult {
  /** How many strikes are now on this user within the active 1-hour window. */
  newCount: number;
  /** True when the user's account is currently locked (this call or earlier). */
  isLocked: boolean;
  /** When the lock expires (only set when isLocked). */
  lockedUntil?: Date;
}

/**
 * Record an abuse-filter trigger for a student and apply the 24-hour
 * hard-lock policy when they cross the threshold within a 1-hour window.
 *
 * The increment+threshold+lock decision happens inside
 * `repos.users.atomicAbuseStrike()` which serialises concurrent strikes.
 * That guarantees the parent notification fires exactly once per lock
 * event even when two abusive requests arrive simultaneously.
 *
 * Behaviour summary:
 * - We do NOT reset the counter on a subsequent clean input. Resets are
 *   driven purely by the 1-hour rolling window so an attacker cannot
 *   alternate abuse/clean to dodge the lock.
 * - When the threshold is reached the counter resets so the next abusive
 *   burst (after the 24h lock expires) starts a fresh count.
 * - A SafetyAlert row is queued for the parent notification worker
 *   exactly on the transition into locked state.
 */
export async function recordAbuseStrike(
  repos: RepositoryContainer,
  userId: string,
  source: AbuseSource
): Promise<AbuseTrackResult> {
  const result = await repos.users.atomicAbuseStrike(userId, {
    windowMs: WINDOW_MS,
    lockThreshold: LOCK_THRESHOLD,
    lockDurationMs: LOCK_DURATION_MS
  });

  if (result.justLocked && result.lockedUntil) {
    await queueSafetyAlert(repos, userId, source, result.lockedUntil);
  }

  return {
    newCount: result.newCount,
    isLocked: result.isLocked,
    lockedUntil: result.lockedUntil ?? undefined
  };
}

async function queueSafetyAlert(
  repos: RepositoryContainer,
  childUserId: string,
  source: AbuseSource,
  lockedUntil: Date
): Promise<void> {
  // Queue the alert for an out-of-band worker that will dispatch via
  // email / LINE / push. The worker itself is intentionally out of
  // scope for Phase 15.5 — but the alert MUST be persisted so it
  // cannot be lost when the dispatcher is finally wired up.
  // TODO(phase-16): consume SafetyAlert rows from this queue and
  // resolve the parent user via ParentChildRelation before sending.
  try {
    await repos.collaborative.createSafetyAlert({
      childUserId,
      alertType: 'ABUSE_HARD_LOCK',
      payload: JSON.stringify({
        source,
        lockedUntil: lockedUntil.toISOString(),
        message:
          'お子様がAIチャットや投稿で不適切な入力を繰り返したため、安全確保のためアカウントが24時間ロックされました。'
      })
    });
  } catch (err) {
    // We never want a downstream queue failure to short-circuit the lock
    // itself. Log loudly so monitoring can detect a broken dispatcher.
    // eslint-disable-next-line no-console
    console.error('[abuseTracker] failed to enqueue SafetyAlert:', err);
  }

  // Mirror the alert into the in-app parent message stream so the parent
  // can still see it on next dashboard load even if the email worker is
  // not yet running.
  try {
    await repos.users.createParentMessage(
      childUserId,
      '【安全通知】お子様がAIチャットや投稿で不適切な言葉の入力を繰り返したため、安全確保のためアカウントが24時間一時的にロックされました。🧅'
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[abuseTracker] failed to create in-app parent message:', err);
  }

  // Structured operational log for ops monitoring / alerting.
  // eslint-disable-next-line no-console
  console.warn(
    JSON.stringify({
      event: 'safety_lock',
      childUserId,
      source,
      lockedUntil: lockedUntil.toISOString()
    })
  );
}
