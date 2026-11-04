import { useEffect, useState } from 'react';

import { Download, Share, X } from 'lucide-react';
import { toast } from 'sonner';

import { FloatingBottomOverlay } from '@/components/pwa/FloatingBottomOverlay';
import { InstallGuideSheet } from '@/components/pwa/InstallGuideSheet';
import type { InstallOfferState } from '@/components/pwa/useInstallOffer';
import { Button } from '@/components/ui/button';
import { PLATFORM_APP_NAME } from '@/lib/platformBranding';
import { promptInstall } from '@/lib/pwa/installPrompt';
import { installGuideFor, type PlatformInfo } from '@/lib/pwa/platform';
import { usePwaSurfaceStore } from '@/lib/pwa/pwaSurfaceStore';
import { pwaTelemetry } from '@/lib/pwa/pwaTelemetry';
import { cn } from '@/lib/utils';

type InstallOfferSheetProps = {
  offer: InstallOfferState;
  platform: PlatformInfo;
};

/**
 * Proactive install offer. Phone/tablet: compact bottom chip above the tab bar
 * (non-blocking; tab bar and header controls stay clickable). Desktop: top-right chip.
 */
export function InstallOfferSheet({ offer, platform }: InstallOfferSheetProps) {
  const { decision, visible, dismiss, dismissForever, complete } = offer;
  const claim = usePwaSurfaceStore((s) => s.claim);
  const release = usePwaSurfaceStore((s) => s.release);
  const [guideOpen, setGuideOpen] = useState(false);
  const [installing, setInstalling] = useState(false);

  const variant = decision.show ? decision.variant : null;
  const placement = decision.show ? decision.placement : null;

  useEffect(() => {
    if (!visible || !variant || !placement) return;
    claim('install');
    pwaTelemetry('install-prompt-shown', { variant, placement });
    return () => release('install');
  }, [visible, variant, placement, claim, release]);

  // `inline` placement is rendered by the page that owns it, never as a floating
  // surface.
  if (!visible || !decision.show || decision.placement === 'inline') return null;

  const guide = installGuideFor(platform);
  const nativeVariant = decision.variant === 'native';

  const onInstall = async () => {
    if (installing) return;
    if (!nativeVariant) {
      setGuideOpen(true);
      return;
    }
    setInstalling(true);
    try {
      const outcome = await promptInstall();
      if (outcome === 'accepted') {
        complete();
        toast.success('Installed. Open it from your home screen.');
      } else if (outcome === 'unavailable') {
        if (guide) setGuideOpen(true);
        else dismiss();
      } else {
        dismiss();
      }
    } finally {
      setInstalling(false);
    }
  };

  const guideSheet =
    guideOpen && guide ? (
      <InstallGuideSheet
        open={guideOpen}
        onOpenChange={(open) => {
          setGuideOpen(open);
          if (!open) complete();
        }}
        platform={platform}
        guide={guide}
      />
    ) : null;

  const mobileChip = (
    <>
      <FloatingBottomOverlay>
        <div
          role="status"
          aria-label={`Install ${PLATFORM_APP_NAME}`}
          className="border-border bg-background pointer-events-auto flex w-full max-w-sm items-center gap-2.5 rounded-xl border px-3 py-2.5 shadow-lg"
        >
          <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-lg">
            <Download className="size-3.5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-foreground text-[13px] font-semibold leading-tight">
              {`Install ${PLATFORM_APP_NAME}`}
            </p>
            {nativeVariant ? (
              <p className="text-muted-foreground text-[11px] leading-snug">
                Add it to your device for a full-screen app with notifications.
              </p>
            ) : (
              <p className="text-muted-foreground inline-flex flex-wrap items-center gap-1 text-[11px] leading-snug">
                Tap <Share className="inline size-3" aria-hidden /> then Add to Home Screen.
              </p>
            )}
          </div>
          <Button
            size="sm"
            className="shrink-0"
            onClick={() => void onInstall()}
            disabled={installing}
          >
            Install
          </Button>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={dismiss}
            className="admin-overflow-trigger shrink-0"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </FloatingBottomOverlay>
      {guideSheet}
    </>
  );

  if (decision.placement === 'sheet') return mobileChip;

  // Desktop chip: bounded width; does not span the viewport.
  return (
    <>
      <div
        role="status"
        className={cn(
          'max-lg:hidden',
          'pointer-events-none fixed right-4 z-[45] w-72',
          'top-[calc(1rem+env(safe-area-inset-top))]'
        )}
      >
        <div className="border-border bg-background pointer-events-auto rounded-xl border p-3 shadow-lg">
          <div className="flex items-start gap-2">
            <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-lg">
              <Download className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-foreground text-sm font-semibold leading-tight">
                {`Install ${PLATFORM_APP_NAME}`}
              </p>
              <p className="text-muted-foreground mt-0.5 text-xs leading-snug">
                Alerts and offline access.
              </p>
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={dismiss}
              className="admin-overflow-trigger"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <Button
            size="sm"
            className="mt-2.5 w-full"
            onClick={() => void onInstall()}
            disabled={installing}
          >
            Install
          </Button>
          <button
            type="button"
            onClick={dismissForever}
            className="text-muted-foreground hover:text-foreground mt-1 w-full py-1 text-xs"
          >
            Don&apos;t ask again
          </button>
        </div>
      </div>
      {guideSheet}
    </>
  );
}
