'use client';

import { useState, useEffect, useCallback } from 'react';
import { useNetworkMonitor } from '@/hooks/useNetworkMonitor';
import styles from './OfflineIndicator.module.css';

/** Possible sync states. */
type SyncState = 'online' | 'offline' | 'syncing' | 'synced' | 'error';

/** Props for OfflineIndicator. */
interface OfflineIndicatorProps {
  /** Number of attempts pending sync. */
  pendingCount?: number;
  /** Current sync state override. */
  syncState?: SyncState;
  /** Callback to trigger manual sync. */
  onSyncRequest?: () => void;
}

/**
 * Network status signal indicator UI (P16D-004).
 *
 * Shows the current network state with a friendly ラッキョくん message.
 * Displays: online/offline status, pending sync count, sync progress.
 *
 * @param props - Component props
 */
export function OfflineIndicator({
  pendingCount = 0,
  syncState: externalSyncState,
  onSyncRequest,
}: OfflineIndicatorProps) {
  const { isOnline } = useNetworkMonitor(onSyncRequest);
  const [showBubble, setShowBubble] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>('online');

  // Derive sync state from network + external state
  useEffect(() => {
    if (externalSyncState) {
      setSyncState(externalSyncState);
    } else if (!isOnline) {
      setSyncState('offline');
    } else if (pendingCount > 0) {
      setSyncState('syncing');
    } else {
      setSyncState('online');
    }
  }, [isOnline, pendingCount, externalSyncState]);

  // Show bubble on state changes, auto-hide after 5s
  useEffect(() => {
    setShowBubble(true);
    const timer = setTimeout(() => setShowBubble(false), 5000);
    return () => clearTimeout(timer);
  }, [syncState]);

  const handleClick = useCallback(() => {
    setShowBubble((prev) => !prev);
    if (isOnline && pendingCount > 0 && onSyncRequest) {
      onSyncRequest();
    }
  }, [isOnline, pendingCount, onSyncRequest]);

  const getMessage = (): string => {
    switch (syncState) {
      case 'offline':
        return '今はオフラインで勉強中！戻ったら自動でセーブするよ🧅';
      case 'syncing':
        return 'ただいま同期中…しばらく待ってね🧅';
      case 'synced':
        return 'セーブ完了！がんばったね🧅✨';
      case 'error':
        return '同期がうまくいかなかったけど、データは安全だよ🧅';
      default:
        return 'オンラインだよ！いつでも勉強できるね🧅';
    }
  };

  const getSignalBars = (): number => {
    switch (syncState) {
      case 'offline':
        return 0;
      case 'syncing':
        return 2;
      case 'error':
        return 1;
      default:
        return 3;
    }
  };

  const signalBars = getSignalBars();

  return (
    <div
      className={styles.container}
      onClick={handleClick}
      role="status"
      aria-label={getMessage()}
      id="offline-indicator"
    >
      {/* Signal strength icon */}
      <div className={styles.signalIcon}>
        {[1, 2, 3].map((level) => (
          <div
            key={level}
            className={`${styles.bar} ${
              level <= signalBars ? styles.barActive : styles.barInactive
            } ${syncState === 'syncing' ? styles.barPulse : ''}`}
            style={{ height: `${level * 5 + 4}px` }}
          />
        ))}
      </div>

      {/* Pending count badge */}
      {pendingCount > 0 && (
        <div className={styles.badge}>{pendingCount}</div>
      )}

      {/* Speech bubble */}
      {showBubble && (
        <div className={styles.bubble}>
          <div className={styles.bubbleArrow} />
          <p className={styles.bubbleText}>{getMessage()}</p>
        </div>
      )}
    </div>
  );
}
