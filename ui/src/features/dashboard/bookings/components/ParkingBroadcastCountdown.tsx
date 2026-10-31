import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';
import {
  formatParkingBroadcastCountdown,
  parkingBroadcastCountdownA11yLabel,
} from '@/utils/format/parkingStayDisplay';

const WARN_THRESHOLD_MS = 2 * 60_000;

function useRemainingMs(expiresAt: string): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return new Date(expiresAt).getTime() - now;
}

type Props = {
  expiresAt: string;
  className?: string;
  /** Larger typography for detail-page urgency strip */
  prominent?: boolean;
};

/**
 * Host-facing time-remaining indicator for a broadcast request in PENDING_HOST_ACCEPTANCE.
 * Ticks every second visually; the rounded-minute sr-only text only changes at minute
 * boundaries, so aria-live="polite" naturally announces once a minute, not every second.
 */
export function ParkingBroadcastCountdown({ expiresAt, className, prominent = false }: Props) {
  const remainingMs = useRemainingMs(expiresAt);
  if (remainingMs <= 0) return null;

  const warn = remainingMs < WARN_THRESHOLD_MS;
  const minutesLabel = parkingBroadcastCountdownA11yLabel(remainingMs);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-medium tabular-nums',
        prominent ? 'text-base' : 'text-xs',
        warn ? 'text-destructive' : 'text-muted-foreground',
        className
      )}
    >
      Expires {formatParkingBroadcastCountdown(remainingMs)}
      <span className="sr-only" aria-live="polite">
        {minutesLabel}
      </span>
    </span>
  );
}
