'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { OfflineIndicator } from './OfflineIndicator';
import {
  registerServiceWorker,
  requestBackgroundSync,
  runWithCrossTabSyncLock,
} from '@/lib/offline/register-sw';
import { handleLogout, drainPendingRemoteWipe } from '@/lib/offline/user-isolation';

/**
 * Client-side wrapper that initializes the Service Worker
 * and renders the OfflineIndicator.
 *
 * Must be a separate "use client" component because layout.tsx
 * is a server component in Next.js App Router.
 */
export function OfflineProviderWrapper() {
  const [swRegistration, setSwRegistration] =
    useState<ServiceWorkerRegistration | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const isSyncingRef = useRef(false);
  // P2: Mirror swRegistration in a ref so handleAttemptEnqueued can read the
  // latest registration without re-binding the listener on every state change.
  const swRegistrationRef = useRef<ServiceWorkerRegistration | null>(null);

  // Sync trigger handler that flushes local SQLite queue using the sync engine
  const handleSyncTrigger = useCallback(async () => {
    if (isSyncingRef.current) {
      console.log('Offline sync is already in progress, skipping concurrent trigger.');
      return;
    }
    isSyncingRef.current = true;

    const token = localStorage.getItem('rakkyo_token');
    const userStr = localStorage.getItem('rakkyo_user');
    if (!token || !userStr) {
      isSyncingRef.current = false;
      return;
    }

    try {
      const user = JSON.parse(userStr);
      const userId = user.id;
      if (!userId) {
        isSyncingRef.current = false;
        return;
      }

      const { openUserDb } = await import('@/lib/offline/db');
      const { flushPendingAttempts, getPendingCount } = await import(
        '@/lib/offline/sync-engine'
      );

      const db = await openUserDb(userId);

      let deviceId = localStorage.getItem('rakkyo_device_id');
      if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem('rakkyo_device_id', deviceId);
      }

      // Flush pending attempts to server
      const res = await flushPendingAttempts(db, token, deviceId);
      
      // Update UI pending count state
      const count = getPendingCount(db);
      setPendingCount(count);

      // Handle expired JWT token — clear token and reload to prompt login without wiping offline DB (P1-9)
      if (res.jwtExpired) {
        console.warn('⚠️ JWT has expired during offline sync flush. Redirecting to login...');
        localStorage.removeItem('rakkyo_token');
        window.location.reload();
        return;
      }

      // If authoritative stats returned, update in local profile (D-2)
      if (res.serverStats) {
        const updatedUser = { ...user, ...res.serverStats };
        localStorage.setItem('rakkyo_user', JSON.stringify(updatedUser));
      }
    } catch (err) {
      console.error('Failed to trigger offline auto-sync:', err);
    } finally {
      isSyncingRef.current = false;
    }
  }, []);

  // Remote database wipe trigger via push notification command (D-8)
  const handleWipeDb = useCallback(async (userId: string) => {
    console.warn('⚠️ Server-issued remote DB wipe command received! Executing...');
    try {
      await handleLogout(userId);
      // Hard reload to clean up all client stores and redirect to login
      window.location.reload();
    } catch (err) {
      console.error('Failed to execute remote DB wipe:', err);
    }
  }, []);

  useEffect(() => {
    // P2: Drain any pending remote-wipe marker persisted by the SW while no
    // window was open. If one is found, localStorage tokens have already
    // been cleared inside drainPendingRemoteWipe — reload so the rest of the
    // app re-evaluates auth state and routes the user back to login.
    drainPendingRemoteWipe().then((wipedUserId) => {
      if (wipedUserId) {
        console.warn('⚠️ Remote wipe was pending from a previous push event. Reloading...');
        window.location.reload();
      }
    });

    // 1. Initial pending count load on mount + auto-flush if we're already
    //    online (P2). Without auto-flush, attempts queued in an earlier
    //    offline session would sit in PENDING until a new enqueue/reconnect
    //    event happened.
    const refreshCount = () => {
      const userStr = localStorage.getItem('rakkyo_user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          const userId = user.id;
          if (userId) {
            import('@/lib/offline/db').then(async ({ openUserDb }) => {
              const db = await openUserDb(userId);
              import('@/lib/offline/sync-engine').then(({ getPendingCount }) => {
                const count = getPendingCount(db);
                setPendingCount(count);
                if (count > 0 && navigator.onLine) {
                  // P2: Route the startup flush through the cross-tab Web Lock
                  // so multiple tabs opened with a pending queue don't launch
                  // concurrent flushes against the same OPFS rows (the
                  // tab-local isSyncingRef alone can't coordinate across tabs).
                  runWithCrossTabSyncLock(handleSyncTrigger);
                }
              });
            });
          }
        } catch (e) {
          console.error('Failed to initialize pending count:', e);
        }
      }
    };

    refreshCount();

    // 2. Listen to custom attempt enqueued events for immediate sync/count updates (P1-4)
    const handleAttemptEnqueued = () => {
      refreshCount();
      if (navigator.onLine) {
        handleSyncTrigger();
      } else {
        // P2: When offline, schedule a Background Sync so the browser will
        // fire the `sync` event once connectivity returns — even if the
        // tab/PWA is closed. Without this, enqueueing while offline and then
        // closing the app strands attempts until the user manually opens the
        // app again on a reconnect. In browsers without the Background Sync
        // API, requestBackgroundSync falls back internally; nothing more we
        // can do here (the next mount/online listener will pick it up).
        requestBackgroundSync(swRegistrationRef.current);
      }
    };

    window.addEventListener('rakkyo-offline-attempt-enqueued', handleAttemptEnqueued);

    // 3. Register Service Worker with trigger callbacks
    registerServiceWorker(handleSyncTrigger, handleWipeDb).then(
      (reg) => {
        setSwRegistration(reg);
        swRegistrationRef.current = reg;
      }
    );

    return () => {
      window.removeEventListener('rakkyo-offline-attempt-enqueued', handleAttemptEnqueued);
    };
  }, [handleSyncTrigger, handleWipeDb]);

  const handleSyncRequest = useCallback(() => {
    requestBackgroundSync(swRegistration);
  }, [swRegistration]);

  return (
    <OfflineIndicator
      pendingCount={pendingCount}
      onSyncRequest={handleSyncRequest}
    />
  );
}
