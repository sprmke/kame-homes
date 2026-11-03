import { Loader2 } from 'lucide-react';

import { PULL_TO_REFRESH_THRESHOLD_PX } from '@/hooks/usePullToRefresh';
import { cn } from '@/lib/utils';


type PullToRefreshIndicatorProps = {
  pullDistance: number;
  refreshing: boolean;
};

/**
 * Small spinner shown while the user pulls (opacity follows the distance) and
 * while the refresh runs. Fixed under the standalone status bar so it never
 * shifts the list.
 */
export function PullToRefreshIndicator({ pullDistance, refreshing }: PullToRefreshIndicatorProps) {
  if (!refreshing && pullDistance <= 0) return null;
  const progress = Math.min(1, pullDistance / PULL_TO_REFRESH_THRESHOLD_PX);

  return (
    <div
      className="pointer-events-none fixed left-1/2 z-40 -translate-x-1/2"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 3.25rem)' }}
      role="status"
      aria-live="polite"
    >
      <span
        className={cn(
          'bg-card border-border flex size-8 items-center justify-center rounded-full border shadow-sm transition-opacity',
          refreshing ? 'opacity-100' : 'opacity-80'
        )}
        style={refreshing ? undefined : { opacity: Math.max(0.25, progress) }}
      >
        <Loader2
          className={cn('text-primary size-4', refreshing ? 'animate-spin' : '')}
          style={refreshing ? undefined : { transform: `rotate(${progress * 270}deg)` }}
          aria-hidden
        />
        <span className="sr-only">{refreshing ? 'Refreshing' : 'Pull to refresh'}</span>
      </span>
    </div>
  );
}
