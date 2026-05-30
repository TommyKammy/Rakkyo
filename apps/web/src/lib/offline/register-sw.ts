/**
 * Service Worker registration for Rakkyo PWA (Phase 16-D).
 *
 * Registers the SW, sets up background sync, and handles
 * messages from the SW (sync triggers, DB wipe commands).
 *
 * @module offline/register-sw
 */

/** Sync tag matching the Service Worker's expected tag. */
const SYNC_TAG = 'rakkyo-attempt-sync';

/**
 * Web Locks name used to serialize the immediate-sync fallback across tabs
 * on browsers without the Background Sync API (Safari, etc.).
 * Same-origin scope is sufficient for cross-tab coordination here.
 */
const CROSS_TAB_SYNC_LOCK = 'rakkyo-sync-flush';

/**
 * Global handle to active sync trigger callback for Safari/non-Chrome
 * browser fallbacks. The function is async under the hood; treat the
 * return value as `void | Promise<void>` so we can await it inside a
 * Web Locks callback when serializing across tabs.
 */
let activeSyncTrigger: (() => void | Promise<void>) | null = null;

/**
 * Register the Service Worker and set up message listeners.
 *
 * @param onSyncTrigger - Callback when the SW requests a sync flush
 * @param onWipeDb - Callback when the SW receives a remote DB wipe command
 * @returns The ServiceWorkerRegistration, or null if SW is unsupported
 */
export async function registerServiceWorker(
  onSyncTrigger: () => void | Promise<void>,
  onWipeDb: (userId: string) => void
): Promise<ServiceWorkerRegistration | null> {
  activeSyncTrigger = onSyncTrigger;
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Worker is not supported in this browser.');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    // Listen for messages from the SW
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'TRIGGER_SYNC') {
        onSyncTrigger();
      } else if (event.data?.type === 'WIPE_LOCAL_DB') {
        onWipeDb(event.data.userId);
      }
    });

    // Handle SW update (D-6)
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (
            newWorker.state === 'installed' &&
            navigator.serviceWorker.controller
          ) {
            // New SW available — force activation
            newWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      }
    });

    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
}

/**
 * Request a background sync. Called when new offline attempts are queued.
 * Falls back to direct sync if the Background Sync API is unavailable.
 *
 * @param registration - The active SW registration
 */
export async function requestBackgroundSync(
  registration: ServiceWorkerRegistration | null
): Promise<void> {
  if (!registration) {
    // If SW is not registered, still try to trigger immediate sync as ultimate fallback
    await runImmediateSyncFallback();
    return;
  }

  try {
    // Background Sync API (Chrome-only, may not be available in Safari)
    if ('sync' in registration) {
      await (registration as ServiceWorkerRegistration & {
        sync: { register: (tag: string) => Promise<void> };
      }).sync.register(SYNC_TAG);
    } else {
      // Fallback: Trigger immediate sync for browsers without Background Sync API (Safari, etc.) (P1-2)
      await runImmediateSyncFallback();
    }
  } catch {
    // Fallback: Background sync registration failed or unsupported — trigger immediately
    await runImmediateSyncFallback();
  }
}

/**
 * Run a sync flush while serializing across tabs via a Web Lock.
 *
 * P2: Every open tab can otherwise launch its own `flushPendingAttempts()`
 * simultaneously (the per-tab `isSyncingRef` only guards within a single tab),
 * reintroducing concurrent queue processing and duplicate uploads despite the
 * service-worker-side single-client fix. Acquiring `CROSS_TAB_SYNC_LOCK` with
 * `ifAvailable: true` means only the first tab to grab the lock proceeds;
 * others see `null` and skip — whichever tab wins flushes the shared OPFS
 * queue on behalf of all peers. Browsers without the Web Locks API fall back
 * to a direct call (best-effort coordination).
 *
 * Exposed so non-SW code paths (e.g. the startup auto-flush in
 * OfflineProviderWrapper) can share the exact same cross-tab coordination.
 *
 * @param fn - The flush routine to run under the lock (e.g. handleSyncTrigger)
 */
export async function runWithCrossTabSyncLock(
  fn: () => void | Promise<void>
): Promise<void> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  if (!locks || typeof locks.request !== 'function') {
    // No Web Locks API support (older Safari etc.) — best-effort direct call.
    await fn();
    return;
  }

  await locks.request(
    CROSS_TAB_SYNC_LOCK,
    { ifAvailable: true },
    async (lock) => {
      if (!lock) {
        // Another tab is already flushing the shared queue — skip.
        return;
      }
      await fn();
    }
  );
}

/**
 * Run the immediate-sync fallback for browsers without the Background Sync API.
 * Shares the cross-tab Web Lock so multiple tabs don't flush concurrently.
 */
async function runImmediateSyncFallback(): Promise<void> {
  if (!activeSyncTrigger) return;
  await runWithCrossTabSyncLock(() => activeSyncTrigger?.());
}
