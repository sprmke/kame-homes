import { Link } from 'react-router-dom';

import { NoticeCallout } from '@/components/help/NoticeCallout';
import { Button } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalClose,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import type { HowItWorksStep } from '@/lib/help/types';
import { cn } from '@/lib/utils';

export type HowItWorksDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Panel heading, e.g. "How pricing works". */
  title: string;
  /** Three to four steps. */
  steps: HowItWorksStep[];
  /** Optional single tip under the steps. */
  tip?: string;
  /** Internal Help Center path. Omit when no article exists. */
  learnMoreHref?: string;
  className?: string;
};

/**
 * Feature intro panel: dialog on desktop, bottom sheet on phone. Renders as an
 * ordered list so screen readers announce the step count and order.
 */
export function HowItWorksDialog({
  open,
  onOpenChange,
  title,
  steps,
  tip,
  learnMoreHref,
  className,
}: HowItWorksDialogProps) {
  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent
        className={cn('md:max-w-[min(92vw,44rem)]', className)}
        sheetLayout="scroll"
      >
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>{title}</ResponsiveModalTitle>
          <ResponsiveModalDescription className="sr-only">
            {title} in {steps.length} steps.
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <div className="relative py-1">
          <div
            aria-hidden
            className="bg-border absolute bottom-5 left-[1.125rem] top-5 w-px md:hidden"
          />
          <div
            aria-hidden
            className="bg-border absolute left-[12%] right-[12%] top-[1.125rem] hidden h-px md:block"
          />
          <ol className="relative grid gap-4 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
            {steps.map((step, index) => (
              <li key={step.title} className="flex min-w-0 gap-3 md:flex-col md:gap-2">
                <div className="bg-primary/10 text-primary ring-card relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full ring-4">
                  <step.icon className="size-4" aria-hidden />
                </div>
                <div className="min-w-0 space-y-0.5">
                  <p className="text-primary text-[11px] font-semibold uppercase tracking-wide">
                    Step {index + 1}
                  </p>
                  <p className="text-sm font-semibold leading-snug">{step.title}</p>
                  <p className="text-muted-foreground text-xs leading-relaxed">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {tip ? <NoticeCallout tone="info">{tip}</NoticeCallout> : null}

        <ResponsiveModalFooter className="pt-1">
          {learnMoreHref ? (
            <Link
              to={learnMoreHref}
              className="text-primary mr-auto self-center text-xs font-medium underline-offset-4 hover:underline"
            >
              Learn more
            </Link>
          ) : null}
          <ResponsiveModalClose asChild>
            <Button type="button" variant="secondary" size="sm">
              Close
            </Button>
          </ResponsiveModalClose>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
