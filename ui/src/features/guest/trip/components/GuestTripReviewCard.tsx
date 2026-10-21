import { Link } from 'react-router-dom';

import { Star } from 'lucide-react';

import { guestReviewPath } from '@/features/guest/lib/guestPublicPaths';
import type { GuestTrip } from '@/features/guest/trip/lib/guestTripApi';

import { ReviewWindowBadge } from '@/features/reviews/components/ReviewWindowBadge';

import { Button } from '@/components/ui/button';

type Props = {
  trip: GuestTrip;
};

export function GuestTripReviewCard({ trip }: Props) {
  const { state, closesAt, hostReviewed, guestText, guestRating, hostText, hostRating } =
    trip.review;
  if (state === 'unavailable' || state === 'closed') return null;
  // The SD refund form opens with the same review step; one call to action is enough.
  if (state === 'open' && trip.actions.sdFormAvailable) return null;

  const href = guestReviewPath(trip.property.slug, trip.bookingId);

  return (
    <section className="border-border bg-card rounded-2xl border p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <Star className="mt-0.5 size-5 shrink-0 text-amber-500" aria-hidden />
        <div className="min-w-0 flex-1">
          {state === 'open' ? (
            <>
              <p className="font-medium">Leave a review</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <ReviewWindowBadge closesAt={closesAt} />
                <Button asChild className="min-h-[44px]">
                  <Link to={href}>Write review</Link>
                </Button>
              </div>
            </>
          ) : null}
          {state === 'submitted' ? (
            <>
              <p className="font-medium">Review submitted</p>
              {guestText ? <p className="text-muted-foreground mt-1 text-sm">{guestText}</p> : null}
              <Button asChild variant="outline" className="mt-3 min-h-[44px]">
                <Link to={href}>Edit</Link>
              </Button>
            </>
          ) : null}
          {state === 'published' ? (
            <>
              <p className="font-medium">Your review</p>
              <p className="mt-1 text-sm">
                {guestRating != null ? `${guestRating} stars. ` : ''}
                {guestText}
              </p>
              {hostReviewed ? (
                <div className="mt-3">
                  <p className="font-medium">Your host's review</p>
                  <p className="mt-1 text-sm">
                    {hostRating != null ? `${hostRating} stars. ` : ''}
                    {hostText}
                  </p>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
