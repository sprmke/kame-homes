import { Download, Plus, Share } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { PLATFORM_APP_NAME } from '@/lib/platformBranding';
import type { InstallGuideKind, PlatformInfo } from '@/lib/pwa/platform';
import { cn } from '@/lib/utils';

export type InstallGuideSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platform: PlatformInfo;
  guide: InstallGuideKind;
};

type Step = { icon: typeof Share; text: string };

/**
 * Step-by-step "Add to Home Screen" guide for platforms without
 * `beforeinstallprompt`. Steps track the detected OS version: iOS 26 moved Share
 * behind the "…" button in the compact tab bar.
 */
export function installGuideSteps(platform: PlatformInfo, guide: InstallGuideKind): Step[] {
  if (guide === 'ios-safari') {
    const iosMajor = platform.osVersion?.major ?? 0;
    if (iosMajor >= 26) {
      return [
        { icon: Plus, text: 'Tap the “…” button in the tab bar.' },
        { icon: Share, text: 'Tap Share.' },
        { icon: Download, text: 'Tap Add to Home Screen, then Add.' },
      ];
    }
    return [
      { icon: Share, text: 'Tap Share in the toolbar.' },
      { icon: Plus, text: 'Scroll down and tap Add to Home Screen.' },
      { icon: Download, text: 'Tap Add.' },
    ];
  }
  if (guide === 'ios-other') {
    return [
      { icon: Plus, text: `Open this page in Safari to install ${PLATFORM_APP_NAME}.` },
      { icon: Share, text: 'In Safari, tap Share.' },
      { icon: Download, text: 'Tap Add to Home Screen, then Add.' },
    ];
  }
  if (guide === 'macos-safari') {
    return [
      { icon: Plus, text: 'Open the File menu.' },
      { icon: Download, text: `Choose Add to Dock. ${PLATFORM_APP_NAME} opens as an app.` },
    ];
  }
  return [
    { icon: Plus, text: 'Open the browser menu (⋮).' },
    { icon: Download, text: 'Tap Install app or Add to Home screen.' },
  ];
}

export function InstallGuideSheet({ open, onOpenChange, platform, guide }: InstallGuideSheetProps) {
  const steps = installGuideSteps(platform, guide);
  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent className="pb-[max(env(safe-area-inset-bottom),1rem)]">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>{`Install ${PLATFORM_APP_NAME}`}</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            Add it to your device for a full-screen app with notifications.
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>
        <ol className="mt-2 space-y-3">
          {steps.map((step, index) => (
            <li key={step.text} className="flex items-start gap-3">
              <span
                className={cn(
                  'bg-primary/10 text-primary mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold'
                )}
                aria-hidden
              >
                {index + 1}
              </span>
              <span className="text-foreground pt-0.5 text-sm leading-snug">{step.text}</span>
            </li>
          ))}
        </ol>
        <Button className="mt-5 w-full" variant="outline" onClick={() => onOpenChange(false)}>
          Done
        </Button>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
