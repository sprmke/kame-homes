import { useMemo } from 'react';

import { Link } from 'react-router-dom';

import { ExternalLink, Flag, Lock, Reply, ThumbsDown, ThumbsUp } from 'lucide-react';

import { propertySectionPath } from '@/features/dashboard/org/lib/tenantPaths';

import { RatingStars } from '@/features/reviews/components/RatingStars';
import { ReviewAvatar } from '@/features/reviews/components/ReviewAvatar';
import {
  ReviewBody,
  ReviewMediaGrid,
  ReviewTagList,
} from '@/features/reviews/components/ReviewCardContent';
import { ReviewResponseBlock } from '@/features/reviews/components/ReviewResponseBlock';
import { ReviewWindowBadge } from '@/features/reviews/components/ReviewWindowBadge';
import type {
  ReceivedReviewItem,
  WrittenReviewItem,
} from '@/features/reviews/lib/propertyReviewsApi';
import {
  GUEST_REVIEW_CATEGORY_LABELS,
  type GuestReviewCategoryId,
} from '@/features/reviews/lib/reviewCatalog';
import { normalizeReviewMedia } from '@/features/reviews/lib/reviewMedia';

import { AdminDialogShell } from '@/components/AdminDialogShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatManilaLongDate, formatStayDateRange } from '@/utils/format/dates';

type SharedProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string;
  propertySlug: string;
  /** Org rollup only — names the listing the review belongs to. */
  propertyName?: string;
};

function Header({
  guestName,
  rating,
  meta,
  propertyName,
}: {
  guestName: string;
  rating: number;
  meta: string | null;
  propertyName?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <ReviewAvatar name={guestName} />
      <div className="min-w-0">
        <p className="text-foreground truncate text-sm font-semibold">{guestName}</p>
        {propertyName ? (
          <p className="text-muted-foreground truncate text-xs font-medium">{propertyName}</p>
        ) : null}
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <RatingStars value={rating} className="shrink-0" />
          {meta ? <span className="text-data-secondary">{meta}</span> : null}
        </div>
      </div>
    </div>
  );
}

function CategoryList({ ratings }: { ratings: Record<string, number> }) {
  const entries = Object.entries(ratings).filter(([, value]) => typeof value === 'number') as Array<
    [GuestReviewCategoryId, number]
  >;
  if (entries.length === 0) return null;

  return (
    <div>
      <p className="text-muted-foreground mb-2 text-xs font-semibold">Rating breakdown</p>
      <ul className="grid grid-cols-1 gap-x-8 gap-y-1.5 sm:grid-cols-2">
        {entries.map(([id, value]) => (
          <li key={id} className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground min-w-0 truncate text-xs">
              {GUEST_REVIEW_CATEGORY_LABELS[id] ?? id}
            </span>
            <span className="text-foreground shrink-0 text-xs font-semibold tabular-nums">
              {value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Full guest review: body, tags, media, per-category scores, notes and response. */
export function ReceivedReviewDetailSheet({
  open,
  onOpenChange,
  review,
  orgSlug,
  propertySlug,
  propertyName,
  canRespond,
  onRespond,
  onReport,
}: SharedProps & {
  review: ReceivedReviewItem;
  canRespond: boolean;
  onRespond: () => void;
  onReport: () => void;
}) {
  const guestName = review.guestName || 'Guest';
  const media = useMemo(() => normalizeReviewMedia(review.mediaUrls), [review.mediaUrls]);
  const stayRange = formatStayDateRange(review.checkInDate, review.checkOutDate);
  const bookingHref = `${propertySectionPath(orgSlug, propertySlug, 'bookings')}/${review.bookingId}`;

  return (
    <AdminDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Guest review"
      sizeClassName="max-w-[min(calc(100vw-1.5rem),34rem)] sm:max-w-[min(90vw,34rem)]"
      footer={
        <>
          {canRespond ? (
            <Button type="button" variant="ghost" className="min-h-[44px]" onClick={onReport}>
              <Flag className="mr-1.5 size-4" aria-hidden />
              Report
            </Button>
          ) : null}
          <Button type="button" variant="outline" className="min-h-[44px]" asChild>
            <Link to={bookingHref}>
              <ExternalLink className="mr-1.5 size-4" aria-hidden />
              Open booking
            </Link>
          </Button>
          {canRespond ? (
            <Button type="button" className="min-h-[44px]" onClick={onRespond}>
              <Reply className="mr-1.5 size-4" aria-hidden />
              {review.responseText ? 'Edit response' : 'Respond'}
            </Button>
          ) : null}
        </>
      }
    >
      <div className="space-y-4">
        <Header
          guestName={guestName}
          rating={review.starRating}
          meta={stayRange}
          propertyName={propertyName}
        />
        <ReviewBody text={review.reviewText} />
        <ReviewTagList tags={review.feedbackTags} />
        <ReviewMediaGrid media={media} guestName={guestName} />
        <CategoryList ratings={review.categoryRatings} />
        {review.privateNote ? (
          <ReviewResponseBlock
            responseText={review.privateNote}
            label="Private note"
            tone="muted"
            icon={<Lock className="size-3 shrink-0" aria-hidden />}
          />
        ) : null}
        <ReviewResponseBlock responseText={review.responseText} />
      </div>
    </AdminDialogShell>
  );
}

/** A review the team wrote about a guest. Read-only once submitted. */
export function WrittenReviewDetailSheet({
  open,
  onOpenChange,
  review,
  orgSlug,
  propertySlug,
  propertyName,
}: SharedProps & { review: WrittenReviewItem }) {
  const guestName = review.guestName || 'Guest';
  const pending = review.status === 'submitted';
  const bookingHref = `${propertySectionPath(orgSlug, propertySlug, 'bookings')}/${review.bookingId}`;

  return (
    <AdminDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Your guest review"
      sizeClassName="max-w-[min(calc(100vw-1.5rem),32rem)] sm:max-w-[min(90vw,32rem)]"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px]"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          <Button type="button" className="min-h-[44px]" asChild>
            <Link to={bookingHref}>Open booking</Link>
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Header
          guestName={guestName}
          rating={review.overallRating}
          meta={formatManilaLongDate(review.submittedAt) || null}
          propertyName={propertyName}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={review.wouldHostAgain ? 'success' : 'destructive'}
            className="font-medium"
          >
            {review.wouldHostAgain ? (
              <ThumbsUp className="size-3" aria-hidden />
            ) : (
              <ThumbsDown className="size-3" aria-hidden />
            )}
            {review.wouldHostAgain ? 'Would host again' : 'Would not host again'}
          </Badge>
          {pending ? (
            <>
              <Badge variant="outline" className="font-medium">
                Hidden until publish
              </Badge>
              <ReviewWindowBadge closesAt={review.closesAt} />
            </>
          ) : null}
        </div>
        <ReviewBody text={review.reviewText} />
        <ReviewResponseBlock
          responseText={review.responseText}
          label="Guest response"
          tone="muted"
        />
      </div>
    </AdminDialogShell>
  );
}
