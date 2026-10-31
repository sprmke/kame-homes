import { useState } from 'react';

import { useNavigate } from 'react-router-dom';

import { Flag, Lock, Megaphone, Reply } from 'lucide-react';

import { propertySectionPath } from '@/features/dashboard/org/lib/tenantPaths';

import { RatingStars } from '@/features/reviews/components/RatingStars';
import { ReportReviewSheet } from '@/features/reviews/components/ReportReviewSheet';
import { ReviewResponseBlock } from '@/features/reviews/components/ReviewResponseBlock';
import { ReviewResponseSheet } from '@/features/reviews/components/ReviewResponseSheet';
import type { ReceivedReviewItem } from '@/features/reviews/lib/propertyReviewsApi';
import { GUEST_REVIEW_CATEGORY_LABELS } from '@/features/reviews/lib/reviewCatalog';

import { ResponsiveOverflowMenu } from '@/components/mobile/ResponsiveOverflowMenu';
import { Button } from '@/components/ui/button';

type Props = {
  review: ReceivedReviewItem;
  orgSlug: string;
  propertySlug: string;
  canRespond: boolean;
};

export function ReviewCard({ review, orgSlug, propertySlug, canRespond }: Props) {
  const navigate = useNavigate();
  const [respondOpen, setRespondOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const guestName = review.guestName || 'Guest';
  const marketingHref = `${propertySectionPath(orgSlug, propertySlug, 'marketing')}?tab=design&reviewId=${encodeURIComponent(review.id)}`;

  return (
    <>
      <article className="border-border bg-card rounded-xl border p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium">{guestName}</p>
            <div className="mt-1 flex items-center gap-2">
              <RatingStars value={review.starRating} />
              <span className="text-muted-foreground text-xs">{review.starRating}/5</span>
            </div>
          </div>
          <ResponsiveOverflowMenu
            label="Review actions"
            actionGroups={[
              [
                {
                  key: 'marketing',
                  label: 'Use in marketing',
                  icon: <Megaphone className="size-4" aria-hidden />,
                  onSelect: () => navigate(marketingHref),
                },
                ...(canRespond
                  ? [
                      {
                        key: 'report',
                        label: 'Report',
                        icon: <Flag className="size-4" aria-hidden />,
                        onSelect: () => setReportOpen(true),
                      },
                    ]
                  : []),
              ],
            ]}
          />
        </div>

        {review.reviewText ? <p className="mt-3 text-sm">{review.reviewText}</p> : null}

        {Object.keys(review.categoryRatings).length > 0 ? (
          <ul className="text-muted-foreground mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            {Object.entries(review.categoryRatings).map(([key, value]) => (
              <li key={key}>
                {GUEST_REVIEW_CATEGORY_LABELS[key as keyof typeof GUEST_REVIEW_CATEGORY_LABELS] ??
                  key}
                : {value}
              </li>
            ))}
          </ul>
        ) : null}

        {review.privateNote ? (
          <p className="text-muted-foreground mt-3 flex items-start gap-2 text-sm">
            <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {review.privateNote}
          </p>
        ) : null}

        <div className="mt-3 space-y-3">
          <ReviewResponseBlock responseText={review.responseText} />
          {canRespond ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px]"
              onClick={() => setRespondOpen(true)}
            >
              <Reply className="mr-2 size-4" aria-hidden />
              {review.responseText ? 'Edit response' : 'Respond'}
            </Button>
          ) : null}
        </div>
      </article>
      <ReviewResponseSheet
        open={respondOpen}
        onOpenChange={setRespondOpen}
        bookingId={review.bookingId}
        guestName={guestName}
        existingText={review.responseText}
      />
      <ReportReviewSheet
        open={reportOpen}
        onOpenChange={setReportOpen}
        reviewKind="guest_review"
        reviewId={review.id}
      />
    </>
  );
}
