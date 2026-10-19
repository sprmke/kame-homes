import { useEffect, useMemo, useState } from 'react';

import { Check, ChevronLeft, ChevronRight, Star } from 'lucide-react';

import { MarketingSidebarSection } from '@/features/dashboard/marketing/components/shared/MarketingSidebarSection';
import { usePropertyGuestReviews } from '@/features/dashboard/marketing/hooks/usePropertyGuestReviews';
import {
  firstReviewImageUrl,
  reviewDisplayDate,
  type MarketingGuestReview,
} from '@/features/dashboard/marketing/lib/marketingGuestReview';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 5;

type Props = {
  selectedReviewId: string | null;
  onSelect: (review: MarketingGuestReview) => void;
  /** When true, only show reviews eligible for social seed (hides Airbnb text). */
  socialSeedOnly?: boolean;
};

function ReviewStars({ rating }: { rating: number }) {
  const clamped = Math.min(5, Math.max(1, Math.round(rating)));
  return (
    <span
      className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400"
      aria-label={`${clamped} of 5 stars`}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn('size-3', i < clamped ? 'fill-current' : 'opacity-30')}
          aria-hidden
        />
      ))}
    </span>
  );
}

export function MarketingReviewSidebarSection({
  selectedReviewId,
  onSelect,
  socialSeedOnly = true,
}: Props) {
  const [page, setPage] = useState(0);
  const listParams = useMemo(
    () => ({
      minRating: 4,
      socialSeedOnly,
      limit: 50,
    }),
    [socialSeedOnly]
  );
  const query = usePropertyGuestReviews(listParams);
  const reviews = useMemo(() => query.data ?? [], [query.data]);
  const pageCount = Math.max(1, Math.ceil(reviews.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageReviews = useMemo(() => {
    const start = safePage * PAGE_SIZE;
    return reviews.slice(start, start + PAGE_SIZE);
  }, [reviews, safePage]);
  const showPagination = reviews.length > PAGE_SIZE;

  useEffect(() => {
    setPage(0);
  }, [query.dataUpdatedAt]);

  useEffect(() => {
    if (!selectedReviewId || reviews.length === 0) return;
    const index = reviews.findIndex((review) => review.id === selectedReviewId);
    if (index < 0) return;
    const targetPage = Math.floor(index / PAGE_SIZE);
    setPage((current) => (current === targetPage ? current : targetPage));
  }, [selectedReviewId, reviews]);

  return (
    <MarketingSidebarSection title="Reviews" collapsible={false}>
      {query.isLoading ? (
        <ul className="space-y-2">
          {Array.from({ length: 3 }, (_, i) => (
            <li key={i}>
              <Skeleton className="h-16 w-full rounded-xl" />
            </li>
          ))}
        </ul>
      ) : query.isError ? (
        <p className="text-destructive text-xs">
          {query.error instanceof Error ? query.error.message : 'Could not load reviews'}
        </p>
      ) : reviews.length === 0 ? (
        <p className="text-muted-foreground text-xs">No reviews yet</p>
      ) : (
        <>
          <ul className="space-y-1.5">
            {pageReviews.map((review) => {
              const thumb = firstReviewImageUrl(review);
              const selected = selectedReviewId === review.id;
              const stayLabel = reviewDisplayDate(review);
              return (
                <li key={review.id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    className={cn(
                      'hover:bg-muted/60 relative flex min-h-[44px] w-full items-start gap-2.5 rounded-xl border p-2.5 text-left transition-colors',
                      selected ? 'border-primary bg-primary/5' : 'border-transparent bg-transparent'
                    )}
                    onClick={() => onSelect(review)}
                  >
                    {selected ? (
                      <span className="bg-primary-strong text-primary-foreground absolute left-1.5 top-1.5 flex size-4 items-center justify-center rounded-full">
                        <Check className="size-2.5" aria-hidden strokeWidth={3} />
                      </span>
                    ) : null}
                    {thumb ? (
                      <img
                        src={thumb}
                        alt=""
                        className="bg-muted size-11 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="bg-muted text-muted-foreground flex size-11 shrink-0 items-center justify-center rounded-lg text-[11px] font-medium">
                        {Math.round(review.rating)}★
                      </div>
                    )}
                    <span className="min-w-0 flex-1 space-y-0.5">
                      <ReviewStars rating={review.rating} />
                      <span className="text-foreground line-clamp-2 text-xs leading-snug">
                        {review.comment.trim() || 'No written review'}
                      </span>
                      <span className="text-muted-foreground text-[11px]">
                        {review.author}
                        {stayLabel ? ` · ${stayLabel}` : ''}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {showPagination ? (
            <div className="mt-2 flex items-center justify-between gap-2 px-0.5">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11 shrink-0"
                disabled={safePage <= 0}
                aria-label="Previous reviews"
                onClick={() => setPage((current) => Math.max(0, current - 1))}
              >
                <ChevronLeft className="size-4" aria-hidden />
              </Button>
              <span className="text-muted-foreground text-xs tabular-nums">
                {safePage + 1} / {pageCount}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11 shrink-0"
                disabled={safePage >= pageCount - 1}
                aria-label="Next reviews"
                onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
              >
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            </div>
          ) : null}
        </>
      )}
    </MarketingSidebarSection>
  );
}
