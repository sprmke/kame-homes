/**
 * Booking detail **AI Summary** tab — same section results as the modal, after a finished run.
 * Hidden until `hasBookingAiReviewRun`; never auto-triggers AI on page view.
 * Wrapped in `BookingDetailCard` so it reads as one of the tab panels, not a modal fragment.
 */

import type { ReactNode } from 'react';

import { Loader2, Sparkles } from 'lucide-react';

import { BookingAiSummaryResultsList } from '@/features/dashboard/bookings/components/booking-detail/BookingAiSummaryResults';
import { BookingDetailCard } from '@/features/dashboard/bookings/components/booking-detail/primitives/BookingDetailCard';
import { useBookingAiReview } from '@/features/dashboard/bookings/hooks/useBookingAiReview';
import { useBookingAiReviewTrigger } from '@/features/dashboard/bookings/hooks/useBookingAiReviewTrigger';
import type { BookingAssetPreviewHandler } from '@/features/dashboard/bookings/hooks/useBookingAssetPreview';
import {
  canRefreshBookingAiReview,
  hasBookingAiReviewRun,
  isBookingAiReviewRunning,
} from '@/features/dashboard/bookings/lib/bookingAiReviewProgress';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';
import { TierBadge } from '@/features/dashboard/plans/components/TierBadge';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';

import { Button } from '@/components/ui/button';

type Props = {
  booking: BookingRow;
  onPreview?: BookingAssetPreviewHandler;
};

function PanelShell({ children, action }: { children: React.ReactNode; action?: ReactNode }) {
  return (
    <BookingDetailCard
      title="AI Summary"
      icon={Sparkles}
      badge={<TierBadge feature="aiValidations" />}
      action={action}
      bodyClassName="!p-0"
    >
      {children}
    </BookingDetailCard>
  );
}

export function AiSummaryPanel({ booking, onPreview }: Props) {
  const { data: review, isLoading, isError, refetch, isFetching } = useBookingAiReview(booking.id);
  const trigger = useBookingAiReviewTrigger(booking.id);
  const { canUse: canRunAiValidation, isLoading: entitlementsLoading } =
    useFeatureGate('aiValidations');
  const { open: openUpgradeModal } = useUpgradeModal();
  // Past results stay readable after a downgrade; only a new run needs the plan.
  const recheck = () => {
    if (canRunAiValidation) trigger.mutate();
    else if (!entitlementsLoading) openUpgradeModal('aiValidations');
  };
  const isRunning = isBookingAiReviewRunning(review, trigger.isPending);
  const canRefresh = canRefreshBookingAiReview(review, trigger.isPending);

  if (isLoading) {
    return (
      <PanelShell>
        <div className="divide-border divide-y" aria-busy="true" aria-label="Loading AI Summary">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex px-3.5 py-3.5">
              <div className="min-w-0 flex-1 space-y-2">
                <span className="bg-muted block h-4 w-24 rounded-full" />
                <span className="bg-muted block h-3.5 w-[80%] max-w-md rounded-full" />
              </div>
              <div className="border-border bg-muted/30 hidden w-[104px] shrink-0 border-l sm:block" />
            </div>
          ))}
        </div>
      </PanelShell>
    );
  }

  if (isError) {
    return (
      <PanelShell>
        <div className="text-muted-foreground px-4 py-4 text-sm sm:px-5">
          <p>Could not load AI Summary.</p>
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="text-primary focus-ring mt-2 rounded font-semibold underline underline-offset-2 disabled:opacity-50"
          >
            Try again
          </button>
        </div>
      </PanelShell>
    );
  }

  if (!hasBookingAiReviewRun(review)) return null;

  const refreshAction =
    canRefresh || isRunning ? (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="min-h-[44px] lg:h-9 lg:min-h-0"
        onClick={recheck}
        disabled={isRunning}
        aria-busy={isRunning || undefined}
      >
        {isRunning ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {isRunning ? 'Checking' : 'Recheck'}
      </Button>
    ) : undefined;

  return (
    <div className="space-y-4">
      {review?.job_status === 'failed' && !isRunning ? (
        <div className="border-destructive/25 bg-destructive/10 text-destructive rounded-lg border px-3 py-2.5 text-sm">
          Some checks could not finish.
        </div>
      ) : null}
      <PanelShell action={refreshAction}>
        <BookingAiSummaryResultsList
          booking={booking}
          review={review}
          onPreview={onPreview}
          frame="bare"
        />
      </PanelShell>
    </div>
  );
}
