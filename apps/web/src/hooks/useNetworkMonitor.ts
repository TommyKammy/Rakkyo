'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Network monitoring hook (P16D-004).
 *
 * Watches `navigator.onLine` and `online`/`offline` events.
 * On reconnection, calls the provided `onReconnect` callback
 * to trigger sync (fallback for browsers without Background Sync API).
 *
 * @param onReconnect - Optional callback fired when transitioning offline → online
 * @returns Object with current online status and last change timestamp
 */
export function useNetworkMonitor(onReconnect?: () => void) {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [lastChangedAt, setLastChangedAt] = useState<Date | null>(null);
  const wasOffline = useRef(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  const handleOnline = useCallback(() => {
    setIsOnline(true);
    setLastChangedAt(new Date());

    // If we were previously offline, trigger reconnect sync
    if (wasOffline.current) {
      wasOffline.current = false;
      onReconnect?.();
    }
  }, [onReconnect]);

  const handleOffline = useCallback(() => {
    setIsOnline(false);
    setLastChangedAt(new Date());
    wasOffline.current = true;
  }, []);

  useEffect(() => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, handleOffline]);

  return { isOnline, lastChangedAt };
}
