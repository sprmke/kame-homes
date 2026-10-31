import { Link } from 'react-router-dom';

import { Star } from 'lucide-react';

import { guestPropertyPath } from '@/features/guest/lib/guestPublicPaths';
import type { PublicHostProfile } from '@/features/guest/marketing/properties/hooks/usePublicHost';

import { RatingStars } from '@/features/reviews/components/RatingStars';
import { ReviewResponseBlock } from '@/features/reviews/components/ReviewResponseBlock';

type Props = {
  host: PublicHostProfile;
};

export function HostPublicReviews({ host }: Props) {
  const summary = host.reviewSummary;
  const reviews = host.recentReviews ?? [];
  const count = summary?.count ?? 0;
  if (count === 0 && reviews.length === 0) return null;

  const isNew = count < 3;
  const avg = summary?.avgOverall;

  return (
    <section className="mx-auto mt-10 max-w-6xl px-4 sm:mt-12 sm:px-6 lg:mt-14">
      <div className="border-border border-t pt-8 sm:pt-10">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          {isNew ? (
            <p className="text-foreground text-lg font-semibold">New</p>
          ) : (
            <p className="text-foreground flex items-center gap-2 text-lg font-semibold">
              <Star className="size-5 fill-current" aria-hidden />
              {avg != null ? avg.toFixed(1) : '0.0'}
              <span className="text-muted-foreground text-sm font-normal">
                {count} {count === 1 ? 'review' : 'reviews'}
              </span>
            </p>
          )}
        </div>
        <ul className="space-y-3">
          {reviews.map((review) => (
            <li key={review.id} className="border-border bg-card rounded-xl border p-4">
              <p className="font-medium">{review.guestName}</p>
              {review.propertySlug ? (
                <Link
                  to={guestPropertyPath(review.propertySlug)}
                  className="text-muted-foreground mt-0.5 inline-block text-xs underline-offset-2 hover:underline"
                >
                  {review.propertyName}
                </Link>
              ) : (
                <p className="text-muted-foreground mt-0.5 text-xs">{review.propertyName}</p>
              )}
              <div className="mt-1 flex items-center gap-2">
                <RatingStars value={review.starRating} />
                <span className="text-muted-foreground text-xs">{review.starRating}/5</span>
              </div>
              {review.reviewText ? <p className="mt-2 text-sm">{review.reviewText}</p> : null}
              {review.responseText ? (
                <div className="mt-2">
                  <ReviewResponseBlock responseText={review.responseText} label="Host response" />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
