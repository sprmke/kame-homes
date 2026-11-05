import { useEffect, useState } from 'react';

import { AlertTriangle, CloudOff, RefreshCw, SignalLow, UploadCloud } from 'lucide-react';

import { SyncCenterCard } from '@/features/dashboard/offline/components/SyncCenterCard';
import { useOfflineSync } from '@/features/dashboard/offline/hooks/useOfflineSync';

import { offlineBannerModel } from '@/components/pwa/offlineBannerModel';
import { FloatingBottomOverlay } from '@/components/pwa/FloatingBottomOverlay';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { useConnectivity } from '@/hooks/useConnectivity';
import { usePwaSurfaceStore } from '@/lib/pwa/pwaSurfaceStore';
import { cn } from '@/lib/utils';

/**
 * Connectivity strip.
 *
 * Deliberately anchored to the *bottom* (above the tab bar / contextual action bar)
 * rather than the top: in v1 it was `fixed top-0 z-[55]` with no layout offset and
 * covered page headers and the standalone status-bar area (P1-7). A bottom strip
 * never covers a header, and `aboveBottomTabBarOverlayClassName()` keeps it clear
 * of the single bottom nav layer.
 *
 * Tapping opens the Sync Center only when a change is queued or failed.
 * A sync with an empty outbox stays hidden, so the sheet is never an empty close button.
 */
export function OfflineBanner() {
  const { status } = useConnectivity();
  const { pendingCount, failedCount, syncing } = useOfflineSync();
  const [syncOpen, setSyncOpen] = useState(false);
  const claim = usePwaSurfaceStore((s) => s.claim);
  const release = usePwaSurfaceStore((s) => s.release);

  const banner = offlineBannerModel({ status, pendingCount, failedCount, syncing });

  useEffect(() => {
    if (!banner.interactive) setSyncOpen(false);
  }, [banner.interactive]);

  // Claim the floating-surface slot so a lower-priority update prompt waits.
  useEffect(() => {
    if (!banner.visible) return;
    claim('offline');
    return () => release('offline');
  }, [banner.visible, claim, release]);

  if (!banner.visible) return null;

  const tone =
    status === 'offline'
      ? 'bg-muted text-muted-foreground'
      : status === 'degraded'
        ? 'bg-warning/15 text-warning-foreground'
        : 'bg-primary/10 text-primary';

  const label = banner.label;

  const Icon =
    status === 'offline'
      ? CloudOff
      : status === 'degraded'
        ? SignalLow
        : failedCount > 0
          ? AlertTriangle
          : syncing
            ? RefreshCw
            : UploadCloud;

  const interactive = banner.interactive;

  return (
    <>
      <FloatingBottomOverlay>
        <button
          type="button"
          role="status"
          aria-live="polite"
          disabled={!interactive}
          onClick={interactive ? () => setSyncOpen(true) : undefined}
          className={cn(
            'border-border pointer-events-auto flex max-w-sm items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-md',
            tone,
            !interactive && 'cursor-default'
          )}
        >
          <Icon className={cn('size-3.5 shrink-0', syncing && 'animate-spin')} aria-hidden />
          <span className="truncate">{label}</span>
        </button>
      </FloatingBottomOverlay>

      <ResponsiveModal open={syncOpen && interactive} onOpenChange={setSyncOpen}>
        <ResponsiveModalContent className="pb-[max(env(safe-area-inset-bottom),1rem)]">
          <ResponsiveModalTitle className="sr-only">Offline changes</ResponsiveModalTitle>
          <SyncCenterCard />
        </ResponsiveModalContent>
      </ResponsiveModal>
    </>
  );
}
