import { CloudOff, RefreshCw } from 'lucide-react';

import { cn } from '@/lib/utils';

type OfflineBannerProps = {
  online: boolean;
  /** Pending offline-outbox mutations waiting to sync (Phase 4). */
  pendingCount?: number;
  /** True while the sync engine is draining the outbox (Phase 4). */
  syncing?: boolean;
};

/**
 * Thin top strip shown while the app is offline, or while queued offline changes
 * are still syncing. Hidden entirely when online with nothing pending.
 */
export function OfflineBanner({ online, pendingCount = 0, syncing = false }: OfflineBannerProps) {
  const show = !online || pendingCount > 0 || syncing;
  if (!show) return null;

  const label = !online
    ? pendingCount > 0
      ? `Offline. ${pendingCount} change${pendingCount === 1 ? '' : 's'} will sync when you reconnect`
      : 'Offline. Showing your last synced data'
    : syncing
      ? `Syncing ${pendingCount || ''} change${pendingCount === 1 ? '' : 's'}…`.replace('  ', ' ')
      : `${pendingCount} change${pendingCount === 1 ? '' : 's'} waiting to sync`;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed inset-x-0 top-0 z-[55] flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium',
        'pt-[calc(0.375rem+env(safe-area-inset-top))]',
        !online ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'
      )}
    >
      {!online ? (
        <CloudOff className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <RefreshCw className={cn('h-3.5 w-3.5 shrink-0', syncing && 'animate-spin')} />
      )}
      <span className="truncate">{label}</span>
    </div>
  );
}
