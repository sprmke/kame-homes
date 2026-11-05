import { useState, type ReactNode } from 'react';

import { Lightbulb, X, type LucideIcon } from 'lucide-react';

import { HowItWorksDialog } from '@/components/help/HowItWorksDialog';
import { dismissIntro, introDismissalKey, isIntroDismissed } from '@/lib/help/introDismissal';
import type { HowItWorksStep } from '@/lib/help/types';
import { cn } from '@/lib/utils';

type IntroCardHowItWorks = {
  /** Feature name used in the button label, e.g. "pricing". */
  feature: string;
  title: string;
  steps: HowItWorksStep[];
  tip?: string;
  learnMoreHref?: string;
};

export type IntroCardProps = {
  /** Stable feature key, e.g. `pricing.smart`. */
  featureKey: string;
  /** Current viewer. Keeps a shared device from hiding another person's card. */
  userId?: string | null;
  /** Bump when the feature changes meaningfully and the card should show again. */
  version?: number;
  /** One sentence. */
  text: ReactNode;
  icon?: LucideIcon;
  /** Optional How it works panel opened from the card. */
  howItWorks?: IntroCardHowItWorks;
  onDismiss?: () => void;
  className?: string;
};

/**
 * First-visit nudge, dismissed for good per viewer and device. Renders nothing
 * until the dismissal state is read, so there is no flash of card then gone.
 *
 * Only one IntroCard may be visible per page. Blocking banners (plan limit,
 * announcement) take priority.
 */
export function IntroCard({
  featureKey,
  userId,
  version = 1,
  text,
  icon: Icon = Lightbulb,
  howItWorks,
  onDismiss,
  className,
}: IntroCardProps) {
  const storageKey = introDismissalKey({ userId, featureKey, version });
  const [trackedKey, setTrackedKey] = useState(storageKey);
  const [dismissed, setDismissed] = useState(() => isIntroDismissed(storageKey));
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);

  // Another viewer signed in on this device: re-read before painting.
  if (trackedKey !== storageKey) {
    setTrackedKey(storageKey);
    setDismissed(isIntroDismissed(storageKey));
  }

  if (dismissed) return null;

  const dismiss = () => {
    dismissIntro(storageKey);
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <>
      <div
        role="note"
        className={cn(
          'border-primary/20 bg-primary/[0.06] motion-safe:animate-in motion-safe:fade-in-0 flex items-start gap-2.5 rounded-xl border px-3 py-2.5',
          className
        )}
      >
        <Icon className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
        <p className="text-foreground min-w-0 flex-1 text-xs leading-relaxed">{text}</p>
        {howItWorks ? (
          <button
            type="button"
            onClick={() => setHowItWorksOpen(true)}
            className="text-primary shrink-0 text-xs font-semibold underline-offset-4 hover:underline"
          >
            How it works
          </button>
        ) : null}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss tip"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring -m-1 inline-flex size-6 shrink-0 touch-manipulation items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>

      {howItWorks ? (
        <HowItWorksDialog
          open={howItWorksOpen}
          onOpenChange={setHowItWorksOpen}
          title={howItWorks.title}
          steps={howItWorks.steps}
          tip={howItWorks.tip}
          learnMoreHref={howItWorks.learnMoreHref}
        />
      ) : null}
    </>
  );
}
