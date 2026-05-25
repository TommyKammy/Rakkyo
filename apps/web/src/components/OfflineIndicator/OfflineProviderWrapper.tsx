'use client';

import { useEffect, useState, useCallback } from 'react';
import { OfflineIndicator } from './OfflineIndicator';
import {
  registerServiceWorker,
  requestBackgroundSync,
} from '@/lib/offline/register-sw';

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

  const handleSyncTrigger = useCallback(() => {
    // This will be connected to the sync engine when a user is logged in.
    // For now, it refreshes the pending count indicator.
    setPendingCount(0);
  }, []);

  const handleWipeDb = useCallback((_userId: string) => {
    // D-8: Remote DB wipe command received via push notification.
    // The actual wipe logic is handled in user-isolation.ts.
    console.warn('Remote DB wipe command received');
  }, []);

  useEffect(() => {
    // Register the Service Worker on mount
    registerServiceWorker(handleSyncTrigger, handleWipeDb).then(
      (reg) => {
        setSwRegistration(reg);
      }
    );
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
