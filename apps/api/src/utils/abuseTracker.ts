import { RepositoryContainer } from '../repositories';

const WINDOW_MS = 60 * 60 * 1000; // 1 hour rolling window
const LOCK_THRESHOLD = 3;
const LOCK_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export type AbuseSource = 'hint' | 'hirameki';

export interface AbuseTrackResult {
  /** How many strikes are now on this user within the active 1-hour window. */
  newCount: number;
  /** True when this strike triggered a 24-hour account lock. */
  isLocked: boolean;
  /** When the lock expires (only set when isLocked). */
  lockedUntil?: Date;
}

/**
 * Record an abuse-filter trigger for a student and apply the 24-hour
 * hard-lock policy when they cross the threshold within a 1-hour window.
 *
 * Notable behaviours:
 * - We do NOT reset the counter on a subsequent clean input. Resets are
 *   driven purely by the rolling time window so an attacker cannot
 *   alternate abuse/clean/abuse to dodge the lock.
 * - When the threshold is reached the counter resets so the next abusive
 *   burst (after the 24h lock expires) starts a fresh count.
 * - A SafetyAlert row is queued for the parent notification worker.
 */
export async function recordAbuseStrike(
  repos: RepositoryContainer,
  userId: string,
  source: AbuseSource
): Promise<AbuseTrackResult> {
  const user = await repos.users.findById(userId);
  if (!user) {
    return { newCount: 0, isLocked: false };
  }

  const now = new Date();
  const lastAt = (user as any).abuseLastAt ? new Date((user as any).abuseLastAt) : null;
  const withinWindow = lastAt !== null && now.getTime() - lastAt.getTime() < WINDOW_MS;
  const previousCount = withinWindow ? Number((user as any).abuseCount || 0) : 0;
  const newCount = previousCount + 1;

  if (newCount >= LOCK_THRESHOLD) {
    const lockedUntil = new Date(now.getTime() + LOCK_DURATION_MS);
    await repos.users.updateUser(userId, {
      abuseCount: 0,
      abuseLastAt: now,
      lockedUntil
    } as any);

    await queueSafetyAlert(repos, userId, source, lockedUntil);

    return { newCount, isLocked: true, lockedUntil };
  }

  await repos.users.updateUser(userId, {
    abuseCount: newCount,
    abuseLastAt: now
  } as any);

  return { newCount, isLocked: false };
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
