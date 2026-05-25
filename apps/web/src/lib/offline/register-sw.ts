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
 * Register the Service Worker and set up message listeners.
 *
 * @param onSyncTrigger - Callback when the SW requests a sync flush
 * @param onWipeDb - Callback when the SW receives a remote DB wipe command
 * @returns The ServiceWorkerRegistration, or null if SW is unsupported
 */
export async function registerServiceWorker(
  onSyncTrigger: () => void,
  onWipeDb: (userId: string) => void
): Promise<ServiceWorkerRegistration | null> {
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
  if (!registration) return;

  try {
    // Background Sync API (Chrome-only, may not be available in Safari)
    if ('sync' in registration) {
      await (registration as ServiceWorkerRegistration & {
        sync: { register: (tag: string) => Promise<void> };
      }).sync.register(SYNC_TAG);
    }
  } catch {
    // Background sync not available — the online event handler
    // in useNetworkMonitor will handle sync as a fallback.
  }
}
