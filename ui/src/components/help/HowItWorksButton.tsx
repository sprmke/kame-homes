import { useState } from 'react';

import { HelpCircle } from 'lucide-react';

import { HowItWorksDialog } from '@/components/help/HowItWorksDialog';
import { MobileHeroActionButton } from '@/components/mobile/MobileHeroActionButton';
import type { HowItWorksStep } from '@/lib/help/types';
import { cn } from '@/lib/utils';

export type HowItWorksButtonProps = {
  /** Feature name used in the accessible label, e.g. "pricing" → "How pricing works". */
  feature: string;
  title: string;
  steps: HowItWorksStep[];
  tip?: string;
  learnMoreHref?: string;
  className?: string;
  /** Frosted mobile hero chrome, next to the tenant switcher. */
  hero?: boolean;
};

/**
 * Header icon button that opens the feature's How it works panel. Use the
 * header variant in `AdminPageHeader` actions; use `hero` inside the mobile
 * brand hero so it matches the other trailing icons.
 */
export function HowItWorksButton({
  feature,
  title,
  steps,
  tip,
  learnMoreHref,
  className,
  hero = false,
}: HowItWorksButtonProps) {
  const [open, setOpen] = useState(false);
  const label = `How ${feature} works`;

  const trigger = hero ? (
    <MobileHeroActionButton
      aria-label={label}
      title={label}
      onClick={() => setOpen(true)}
      className={className}
    >
      <HelpCircle aria-hidden />
    </MobileHeroActionButton>
  ) : (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => setOpen(true)}
      className={cn(
        'text-muted-foreground hover:text-foreground hover:bg-muted relative inline-flex size-9 shrink-0 touch-manipulation items-center justify-center rounded-full transition-colors',
        "before:absolute before:-inset-1.5 before:content-['']",
        'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        className
      )}
    >
      <HelpCircle className="size-4" aria-hidden />
    </button>
  );

  return (
    <>
      {trigger}
      <HowItWorksDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        steps={steps}
        tip={tip}
        learnMoreHref={learnMoreHref}
      />
    </>
  );
}
