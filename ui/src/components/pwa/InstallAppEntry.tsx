import { useState } from 'react';

import { Download, Smartphone } from 'lucide-react';
import { toast } from 'sonner';

import { InstallGuideSheet } from '@/components/pwa/InstallGuideSheet';
import { usePwaEnvironment } from '@/components/pwa/usePwaEnvironment';
import { Button } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { PLATFORM_APP_NAME } from '@/lib/platformBranding';
import { canPromptInstall, promptInstall } from '@/lib/pwa/installPrompt';
import { installGuideFor } from '@/lib/pwa/platform';
import { pwaTelemetry } from '@/lib/pwa/pwaTelemetry';

type InstallAppEntryProps = {
  /** `button` for footers/menus, `menu-item` for a full-width row in a sheet. */
  variant?: 'button' | 'menu-item';
  className?: string;
  label?: string;
};

/**
 * Permanent "Install app" entry point (2.2). Hidden when the app is already
 * installed. Opens the native prompt when one is available, otherwise the platform
 * guide; inside an in-app browser it explains why installation has to happen in a
 * real browser.
 */
export function InstallAppEntry({
  variant = 'button',
  className,
  label = 'Install app',
}: InstallAppEntryProps) {
  const env = usePwaEnvironment();
  const [guideOpen, setGuideOpen] = useState(false);
  const [inAppOpen, setInAppOpen] = useState(false);

  if (env.standalone) return null;

  const guide = installGuideFor(env.platform);

  const open = async () => {
    pwaTelemetry('install-prompt-shown', { variant: 'manual' });
    if (canPromptInstall()) {
      const outcome = await promptInstall();
      if (outcome === 'accepted') toast.success('Installed. Open it from your home screen.');
      return;
    }
    if (env.platform.isInAppBrowser) {
      setInAppOpen(true);
      return;
    }
    if (guide) {
      setGuideOpen(true);
      return;
    }
    setInAppOpen(true);
  };

  const content = (
    <>
      {variant === 'menu-item' ? (
        <Smartphone className="text-muted-foreground size-4 shrink-0" aria-hidden />
      ) : (
        <Download className="size-3.5" aria-hidden />
      )}
      <span>{label}</span>
    </>
  );

  return (
    <>
      <Button
        type="button"
        variant={variant === 'menu-item' ? 'ghost' : 'outline'}
        className={className}
        onClick={() => void open()}
      >
        {content}
      </Button>

      {guideOpen && guide ? (
        <InstallGuideSheet
          open={guideOpen}
          onOpenChange={setGuideOpen}
          platform={env.platform}
          guide={guide}
        />
      ) : null}

      <ResponsiveModal open={inAppOpen} onOpenChange={setInAppOpen}>
        <ResponsiveModalContent className="pb-[max(env(safe-area-inset-bottom),1rem)]">
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>{`Install ${PLATFORM_APP_NAME}`}</ResponsiveModalTitle>
            <ResponsiveModalDescription>
              Open this page in Safari or Chrome to add it to your home screen.
            </ResponsiveModalDescription>
          </ResponsiveModalHeader>
          <Button className="mt-4 w-full" variant="outline" onClick={() => setInAppOpen(false)}>
            Done
          </Button>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </>
  );
}
