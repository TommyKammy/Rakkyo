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
          if (clients && clients.length > 0) {
            // Active tabs are open — notify them so they reload & logout
            clients.forEach((client) => {
              client.postMessage({
                type: 'WIPE_LOCAL_DB',
                userId: payload.userId,
              });
            });
            return Promise.resolve();
          } else {
            // No client windows are open — execute direct wipe from SW thread (P1-6)
            const filename = `rakkyo_user_${payload.userId}.db`;

            // 1. Delete OPFS file
            const deleteOpfs = () => {
              if (navigator.storage && navigator.storage.getDirectory) {
                return navigator.storage.getDirectory().then((root) => {
                  return root.removeEntry(filename).catch(() => {});
                });
              }
              return Promise.resolve();
            };

            // 2. Delete IndexedDB Key
            const deleteIdbKey = () => {
              return new Promise((resolve) => {
                const req = indexedDB.open('rakkyo-crypto-keys', 1);
                // P2: Mirror crypto.ts's schema definition. Without this
                // handler, opening a non-existent DB creates a malformed v1
                // database missing the `keys` object store, which permanently
                // breaks subsequent crypto.ts open/get/put operations
                // (NotFoundError) since they also request version 1 and won't
                // trigger an upgrade. Creating the store here keeps the DB
                // schema consistent whether or not the wipe arrives first.
                req.onupgradeneeded = () => {
                  const upgradeDb = req.result;
                  if (!upgradeDb.objectStoreNames.contains('keys')) {
                    upgradeDb.createObjectStore('keys');
                  }
                };
                req.onsuccess = () => {
                  const db = req.result;
                  // If the keys store somehow still doesn't exist, the wipe
                  // is a no-op (there's no key to delete).
                  if (!db.objectStoreNames.contains('keys')) {
                    db.close();
                    resolve();
                    return;
                  }
                  try {
                    const tx = db.transaction('keys', 'readwrite');
                    tx.objectStore('keys').delete(`enc_${payload.userId}`);
                    tx.oncomplete = () => {
                      db.close();
                      resolve();
                    };
                    tx.onerror = () => {
                      db.close();
                      resolve();
                    };
                  } catch {
                    db.close();
                    resolve();
                  }
                };
                req.onerror = () => resolve();
              });
            };

            return Promise.all([deleteOpfs(), deleteIdbKey()]);
          }
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
  if (!clients || clients.length === 0) {
    // Throw error to tell browser that sync failed and should be retried later when a window is active (P1-8)
    throw new Error('No active client windows available for sync');
  }
  clients.forEach((client) => {
    client.postMessage({ type: 'TRIGGER_SYNC' });
  });
}
