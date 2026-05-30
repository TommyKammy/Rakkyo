'use client';

/**
 * Badge shown on cached AI hint content that is older than 24h (D-5).
 *
 * Ensures honest authenticity: children see when AI responses are
 * stale, preventing misconceptions from outdated diagnoses.
 */

interface OfflineHintBadgeProps {
  /** Human-readable staleness label (e.g. "24時間前のキャッシュです"). */
  staleLabel: string;
  /** Whether the hint is stale (>24h old). */
  isStale: boolean;
}

/**
 * Display badge for offline-cached hint/AI diagnosis (D-5).
 * Shows "オフラインヒント" label for stale (>24h) cached responses.
 *
 * @param props - Badge props
 */
export function OfflineHintBadge({
  staleLabel,
  isStale,
}: OfflineHintBadgeProps) {
  if (!isStale) return null;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 8px',
        borderRadius: '6px',
        backgroundColor: '#FEF3C7',
        border: '1px solid #F59E0B',
        fontSize: '11px',
        fontWeight: 600,
        color: '#92400E',
        lineHeight: 1.3,
      }}
      role="note"
      aria-label={`オフラインヒント: ${staleLabel}`}
      id="offline-hint-badge"
    >
      <span aria-hidden="true">📡</span>
      <span>オフラインヒント</span>
      <span style={{ fontWeight: 400, opacity: 0.8 }}>— {staleLabel}</span>
    </div>
  );
}
