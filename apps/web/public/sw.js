/**
 * Service Worker for Rakkyo PWA (Phase 16-D).
 *
 * Handles:
 * - Background sync on reconnection (P16D-002)
 * - Force update via skipWaiting + clients.claim (D-6)
 * - Push notification for remote DB wipe (D-8)
 *
 * This file is compiled/copied to /public/sw.js.
 */

/// <reference lib="webworker" />
/** Cache name for offline assets. */
const CACHE_NAME = 'rakkyo-offline-v1';

/** Sync tag used by the Background Sync API. */
const SYNC_TAG = 'rakkyo-attempt-sync';

/**
 * Install event — precache essential assets and skip waiting (D-6).
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Precache minimal shell for offline rendering
      return cache.addAll(['/']);
    })
  );
  // D-6: Force activation without waiting for existing tabs to close
  self.skipWaiting();
});

/**
 * Activate event — claim all clients immediately (D-6).
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((names) =>
        Promise.all(
          names
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      ),
      // Immediately claim all open tabs
      self.clients.claim(),
    ])
  );
});

/**
 * Fetch event — serve from cache when offline, network-first otherwise.
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET requests and API calls (sync handled separately)
  if (request.method !== 'GET' || request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful responses for offline use
        if (response.ok) {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, cloned);
          });
        }
        return response;
      })
      .catch(() => {
        // Offline — serve from cache
        return caches.match(request).then(
          (cached) => cached || new Response('オフラインです', { status: 503 })
        );
      })
  );
});

/**
 * Background sync event (P16D-002).
 * Fired when the browser regains connectivity and there are pending syncs.
 * Posts a message to all clients to trigger the sync engine.
 */
self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(notifyClientsToSync());
  }
});

/**
 * Push event — handle remote commands from server (D-8).
 * Currently supports: 'WIPE_LOCAL_DB' for lost device scenarios.
 */
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();

    if (payload.command === 'WIPE_LOCAL_DB') {
      event.waitUntil(
        self.clients.matchAll().then((clients) => {
          clients.forEach((client) => {
            client.postMessage({
              type: 'WIPE_LOCAL_DB',
              userId: payload.userId,
            });
          });
        })
      );
    }
  } catch {
    // Invalid push payload — ignore
  }
});

/**
 * Message event — handle messages from the main thread.
 */
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/**
 * Notify all open clients to trigger sync.
 */
async function notifyClientsToSync() {
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach((client) => {
    client.postMessage({ type: 'TRIGGER_SYNC' });
  });
}
