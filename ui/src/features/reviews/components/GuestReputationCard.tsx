import { Star } from 'lucide-react';

import { BookingDetailCard } from '@/features/dashboard/bookings/components/booking-detail/primitives/BookingDetailCard';
import {
  BookingDetailRow,
  BookingDetailRowGroup,
} from '@/features/dashboard/bookings/components/booking-detail/primitives/BookingDetailRow';

import type { GuestReputationPayload } from '@/features/reviews/lib/reviewApi';
import {
  HOST_REVIEW_CATEGORY_LABELS,
  HOST_REVIEW_ISSUE_TAG_LABELS,
  HOST_REVIEW_STRENGTH_TAG_LABELS,
} from '@/features/reviews/lib/reviewCatalog';

function formatAvg(value: number | null): string | null {
  return value == null ? null : value.toFixed(1);
}

function tagLabel(id: string): string {
  if (id in HOST_REVIEW_STRENGTH_TAG_LABELS) {
    return HOST_REVIEW_STRENGTH_TAG_LABELS[id as keyof typeof HOST_REVIEW_STRENGTH_TAG_LABELS];
  }
  if (id in HOST_REVIEW_ISSUE_TAG_LABELS) {
    return HOST_REVIEW_ISSUE_TAG_LABELS[id as keyof typeof HOST_REVIEW_ISSUE_TAG_LABELS];
  }
  return id;
}

type Props = {
  payload: GuestReputationPayload | undefined;
  isLoading: boolean;
};

export function GuestReputationCard({ payload, isLoading }: Props) {
  const reputation = payload?.reputation;
  const count = reputation?.reviewCount ?? 0;

  return (
    <BookingDetailCard title="Guest reputation" icon={Star}>
      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : !payload?.hasIdentity || count === 0 ? (
        <p className="text-muted-foreground text-sm">No prior reviews.</p>
      ) : (
        <div className="space-y-4">
          <BookingDetailRowGroup>
            <BookingDetailRow label="Stays reviewed" value={count} numeric />
            <BookingDetailRow label="Overall" value={formatAvg(reputation?.avgOverall ?? null)} />
            <BookingDetailRow
              label={HOST_REVIEW_CATEGORY_LABELS.cleanliness}
              value={formatAvg(reputation?.categoryAvgs.cleanliness ?? null)}
            />
            <BookingDetailRow
              label={HOST_REVIEW_CATEGORY_LABELS.communication}
              value={formatAvg(reputation?.categoryAvgs.communication ?? null)}
            />
            <BookingDetailRow
              label={HOST_REVIEW_CATEGORY_LABELS.house_rules}
              value={formatAvg(reputation?.categoryAvgs.houseRules ?? null)}
            />
            <BookingDetailRow
              label="Would host again"
              value={
                reputation?.wouldHostAgainRate == null
                  ? null
                  : `${Math.round(reputation.wouldHostAgainRate * 100)}%`
              }
            />
          </BookingDetailRowGroup>

          {reputation && reputation.topStrengthTags.length > 0 ? (
            <p className="text-muted-foreground text-sm">
              {reputation.topStrengthTags.map(tagLabel).join(', ')}
            </p>
          ) : null}
          {reputation && reputation.topIssueTags.length > 0 ? (
            <p className="text-muted-foreground text-sm">
              {reputation.topIssueTags.map(tagLabel).join(', ')}
            </p>
          ) : null}

          {payload.recentReviews.length > 0 ? (
            <ul className="space-y-3">
              {payload.recentReviews.map((review, index) => (
                <li key={`${review.createdAt}-${index}`} className="space-y-1">
                  <p className="text-foreground text-sm">
                    {review.overallRating}/5 · {review.areaLabel}
                  </p>
                  {review.reviewText ? (
                    <p className="text-muted-foreground text-sm">{review.reviewText}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </BookingDetailCard>
  );
}
