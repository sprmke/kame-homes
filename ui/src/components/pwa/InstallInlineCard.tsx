import { useState } from 'react';

import { Download } from 'lucide-react';
import { toast } from 'sonner';

import { InstallGuideSheet } from '@/components/pwa/InstallGuideSheet';
import { useInstallOffer } from '@/components/pwa/useInstallOffer';
import { usePwaEnvironment } from '@/components/pwa/usePwaEnvironment';
import { Button } from '@/components/ui/button';
import { PLATFORM_APP_NAME } from '@/lib/platformBranding';
import { promptInstall } from '@/lib/pwa/installPrompt';
import { installGuideFor } from '@/lib/pwa/platform';
import { pwaTelemetry } from '@/lib/pwa/pwaTelemetry';

/**
 * In-page install card for a signed-in guest with an upcoming trip (never a
 * floating surface). Rendered by `/account/trips`; see
 * `routeCapabilities` (`installOffer: 'inline'`).
 */
export function InstallInlineCard() {
  const offer = useInstallOffer({ hasUpcomingTrip: true });
  const { platform } = usePwaEnvironment();
  const [guideOpen, setGuideOpen] = useState(false);

  if (!offer.visible || !offer.decision.show) return null;
  const guide = installGuideFor(platform);

  const onInstall = async () => {
    pwaTelemetry('install-prompt-shown', { variant: offer.decision.show ? offer.decision.variant : 'native', placement: 'inline' });
    if (offer.decision.show && offer.decision.variant !== 'native') {
      if (guide) setGuideOpen(true);
      return;
    }
    const outcome = await promptInstall();
    if (outcome === 'accepted') {
      offer.complete();
      toast.success('Installed. Open it from your home screen.');
    } else {
      offer.dismiss();
    }
  };

  return (
    <>
      <div className="border-border bg-card rounded-xl border p-4">
        <div className="flex items-start gap-3">
          <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
            <Download className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-foreground text-sm font-semibold leading-tight">
              {`Install ${PLATFORM_APP_NAME}`}
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs leading-snug">
              Trip reminders and messages, without the browser.
            </p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <Button size="sm" className="flex-1" onClick={() => void onInstall()}>
            Install
          </Button>
          <Button size="sm" variant="ghost" onClick={offer.dismiss}>
            Not now
          </Button>
        </div>
      </div>
      {guideOpen && guide ? (
        <InstallGuideSheet
          open={guideOpen}
          onOpenChange={(open) => {
            setGuideOpen(open);
            if (!open) offer.complete();
          }}
          platform={platform}
          guide={guide}
        />
      ) : null}
    </>
  );
}
