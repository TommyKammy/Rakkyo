'use client';

import { useEffect, useState, useCallback } from 'react';
import { OfflineIndicator } from './OfflineIndicator';
import {
  registerServiceWorker,
  requestBackgroundSync,
} from '@/lib/offline/register-sw';
import { handleLogout } from '@/lib/offline/user-isolation';

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

  // Sync trigger handler that flushes local SQLite queue using the sync engine
  const handleSyncTrigger = useCallback(async () => {
    const token = localStorage.getItem('rakkyo_token');
    const userStr = localStorage.getItem('rakkyo_user');
    if (!token || !userStr) return;

    try {
      const user = JSON.parse(userStr);
      const userId = user.id;
      if (!userId) return;

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

      // If authoritative stats returned, update in local profile (D-2)
      if (res.serverStats) {
        const updatedUser = { ...user, ...res.serverStats };
        localStorage.setItem('rakkyo_user', JSON.stringify(updatedUser));
      }
    } catch (err) {
      console.error('Failed to trigger offline auto-sync:', err);
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
    // 1. Initial pending count load on mount
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
                setPendingCount(getPendingCount(db));
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
      }
    };

    window.addEventListener('rakkyo-offline-attempt-enqueued', handleAttemptEnqueued);

    // 3. Register Service Worker with trigger callbacks
    registerServiceWorker(handleSyncTrigger, handleWipeDb).then(
      (reg) => {
        setSwRegistration(reg);
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
