import { Loader2 } from 'lucide-react';

import type { OrgPlanCheckoutConfirmationState } from '@/features/dashboard/plans/hooks/useOrgPlanCheckoutConfirmation';

import { FloatingPanel } from '@/components/mobile/FloatingPanel';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type PlanCheckoutConfirmationBannerProps = {
  state: OrgPlanCheckoutConfirmationState;
  pendingCheckoutUrl?: string | null;
  onResumePayment?: () => void;
  className?: string;
};

export function PlanCheckoutConfirmationBanner({
  state,
  pendingCheckoutUrl,
  onResumePayment,
  className,
}: PlanCheckoutConfirmationBannerProps) {
  if (state === 'idle') return null;

  if (state === 'cancelled') {
    return (
      <div role="status" className={className}>
        <FloatingPanel padding="md" className="border-border flex items-center gap-3">
          <p className="text-muted-foreground text-sm">Payment cancelled.</p>
        </FloatingPanel>
      </div>
    );
  }

  if (state === 'success') {
    // Celebration modal owns the success moment; no inline banner.
    return null;
  }

  if (state === 'timed_out') {
    return (
      <div role="status" className={className}>
        <FloatingPanel
          padding="md"
          className="border-border flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-muted-foreground text-sm">
            Payment is still pending. If you already paid, wait a moment and refresh.
          </p>
          {pendingCheckoutUrl && onResumePayment ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] shrink-0"
              onClick={onResumePayment}
            >
              Resume payment
            </Button>
          ) : null}
        </FloatingPanel>
      </div>
    );
  }

  return (
    <div role="status" aria-live="polite" className={className}>
      <FloatingPanel
        padding="md"
        className={cn(
          'border-primary/20 bg-primary/5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'
        )}
      >
        <div className="flex items-start gap-3">
          <Loader2 className="text-primary mt-0.5 size-4 shrink-0 animate-spin" aria-hidden />
          <p className="text-foreground text-sm font-medium">Confirming payment…</p>
        </div>
        {pendingCheckoutUrl && onResumePayment ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px] shrink-0"
            onClick={onResumePayment}
          >
            Open checkout
          </Button>
        ) : null}
      </FloatingPanel>
    </div>
  );
}
