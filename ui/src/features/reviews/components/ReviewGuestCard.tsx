import { useState } from 'react';

import { Star } from 'lucide-react';
import { toast } from 'sonner';

import { BookingDetailCard } from '@/features/dashboard/bookings/components/booking-detail/primitives/BookingDetailCard';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';

import { HostGuestReviewSheet } from '@/features/reviews/components/HostGuestReviewSheet';
import { ReviewWindowBadge } from '@/features/reviews/components/ReviewWindowBadge';
import { useSetAutoReviewPaused } from '@/features/reviews/hooks/useReviewAutomation';
import type { GuestReputationPayload } from '@/features/reviews/lib/reviewApi';

import { Button } from '@/components/ui/button';
import { friendlyToastError } from '@/lib/feedback/toastMessages';

type Props = {
  bookingId: string;
  guestName: string;
  payload: GuestReputationPayload | undefined;
  canEdit: boolean;
};

export function ReviewGuestCard({ bookingId, guestName, payload, canEdit }: Props) {
  const [open, setOpen] = useState(false);
  const hostReview = payload?.hostReview ?? null;
  const published = hostReview?.status === 'published';
  const canWrite = Boolean(canEdit && payload?.canHostReview);
  const pause = useSetAutoReviewPaused(bookingId);
  const { canUse: canAutomate } = useFeatureGate('reviewAutomation');
  const { open: openUpgradeModal } = useUpgradeModal();
  const paused = payload?.window?.autoReviewPaused === true;
  // Pausing only matters while auto-review could still write this review.
  const canPause = Boolean(canEdit && payload?.canHostReview && !hostReview);

  let statusLine = 'Window not open yet.';
  if (published) statusLine = 'Published.';
  else if (hostReview?.status === 'submitted')
    statusLine = 'Saved. Hidden until both sides finish, or the window closes.';
  else if (payload?.canHostReview) statusLine = 'Open.';
  else if (payload?.window?.closedReason) statusLine = 'Window closed.';

  return (
    <>
      <BookingDetailCard
        title="Review guest"
        icon={Star}
        badge={<ReviewWindowBadge closesAt={payload?.window?.closesAt} />}
        action={
          canWrite ? (
            <Button type="button" size="sm" className="min-h-[44px]" onClick={() => setOpen(true)}>
              {hostReview ? 'Edit' : 'Write'}
            </Button>
          ) : null
        }
      >
        <div className="space-y-2">
          <p className="text-sm">{statusLine}</p>
          {hostReview ? (
            <p className="text-muted-foreground text-sm">
              {hostReview.overallRating}/5
              {hostReview.wouldHostAgain ? ' · Would host again' : ' · Would not host again'}
            </p>
          ) : null}
          {published && hostReview.reviewText ? (
            <p className="text-sm">{hostReview.reviewText}</p>
          ) : null}
          {canPause ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px]"
              disabled={pause.isPending}
              onClick={() => {
                if (!canAutomate) {
                  openUpgradeModal('reviewAutomation');
                  return;
                }
                void pause.mutateAsync(!paused).catch((err) => {
                  toast.error(friendlyToastError(err, 'Could not update auto-review'));
                });
              }}
            >
              {paused ? 'Resume auto-review' : 'Pause auto-review'}
            </Button>
          ) : null}
        </div>
      </BookingDetailCard>
      <HostGuestReviewSheet
        open={open}
        onOpenChange={setOpen}
        bookingId={bookingId}
        guestName={guestName}
        draft={hostReview}
      />
    </>
  );
}
