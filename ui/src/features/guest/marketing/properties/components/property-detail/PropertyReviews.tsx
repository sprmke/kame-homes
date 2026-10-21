import { useEffect, useMemo, useRef, useState } from 'react';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Star, X } from 'lucide-react';
import { createPortal } from 'react-dom';

import { GuestDialogShell } from '@/features/guest/marketing/shared/components/GuestDialogShell';
import type { PublicReviewSummary } from '@/features/guest/marketing/properties/types/publicProperty';
import { guestReviewFeedbackTagLabel } from '@/features/guest/sd-form/lib/guestReviewFeedbackTags';
import { GUEST_REVIEW_CATEGORY_LABELS } from '@/features/reviews/lib/reviewCatalog';
import { ReviewResponseBlock } from '@/features/reviews/components/ReviewResponseBlock';

import { MobileChoiceItem, MobileChoiceSheet } from '@/components/mobile/MobileChoiceSheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface PropertyReviewItem {
  id: string;
  author: string;
  date: string;
  rating: number;
  comment: string;
  source?: 'kame' | 'facebook' | 'airbnb';
  feedbackTags?: string[];
  media?: Array<{ url: string; type: 'image' | 'video' }>;
  /** ISO timestamp for newest-first sort when present. */
  createdAt?: string | null;
  responseText?: string | null;
}

interface PropertyReviewsProps {
  rating: number;
  totalReviews: number;
  reviews?: PropertyReviewItem[];
  summary?: PublicReviewSummary | null;
}

type ReviewSort = 'newest' | 'highest' | 'lowest';

const reviewSourceLabel = (source?: PropertyReviewItem['source']) => {
  switch (source) {
    case 'airbnb':
      return 'Airbnb';
    case 'facebook':
      return 'Facebook';
    case 'kame':
      return 'Guest review';
    default:
      return null;
  }
};

function reviewImageUrls(review: PropertyReviewItem): string[] {
  return (review.media ?? [])
    .filter((item) => item.type === 'image' && item.url.trim())
    .map((item) => item.url.trim());
}

function sortReviewsNewestFirst(reviews: PropertyReviewItem[]): PropertyReviewItem[] {
  return [...reviews].sort((a, b) => {
    const aMs = a.createdAt ? Date.parse(a.createdAt) : Number.NaN;
    const bMs = b.createdAt ? Date.parse(b.createdAt) : Number.NaN;
    const aOk = Number.isFinite(aMs);
    const bOk = Number.isFinite(bMs);
    if (aOk && bOk) return bMs - aMs;
    if (aOk) return -1;
    if (bOk) return 1;
    return 0;
  });
}

function ReviewAuthorHeader({ review }: { review: PropertyReviewItem }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="from-primary to-primary/80 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-lg font-semibold text-white">
          {review.author.charAt(0)}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-foreground font-medium">{review.author}</p>
            {reviewSourceLabel(review.source) ? (
              <span className="border-border bg-muted/50 text-muted-foreground rounded-full border px-2 py-0.5 text-[11px] font-medium">
                {reviewSourceLabel(review.source)}
              </span>
            ) : null}
          </div>
          <p className="text-muted-foreground text-sm">{review.date}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1" aria-label={`${review.rating} of 5 stars`}>
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={cn(
              'h-4 w-4',
              i < review.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'
            )}
            aria-hidden
          />
        ))}
      </div>
    </div>
  );
}

function ReviewFeedbackTags({ review }: { review: PropertyReviewItem }) {
  if (!review.feedbackTags?.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {review.feedbackTags.map((tagId) => (
        <span
          key={tagId}
          className="border-border bg-muted/50 text-foreground rounded-full border px-3 py-1 text-xs font-medium"
        >
          {guestReviewFeedbackTagLabel(tagId)}
        </span>
      ))}
    </div>
  );
}

function ReviewPhotoGrid({
  urls,
  reviewId,
  onPhotoClick,
}: {
  urls: string[];
  reviewId: string;
  onPhotoClick: (index: number) => void;
}) {
  if (urls.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {urls.map((url, mediaIndex) => (
        <button
          key={`${reviewId}-media-${mediaIndex}`}
          type="button"
          onClick={() => onPhotoClick(mediaIndex)}
          className="border-border bg-muted/30 block size-20 overflow-hidden rounded-lg border sm:size-24"
          aria-label={`View review photo ${mediaIndex + 1}`}
        >
          <img src={url} alt="" className="size-full object-cover" loading="lazy" />
        </button>
      ))}
    </div>
  );
}

function ReviewListComment({ comment, onSeeMore }: { comment: string; onSeeMore: () => void }) {
  const textRef = useRef<HTMLParagraphElement>(null);
  const [isClamped, setIsClamped] = useState(false);

  useEffect(() => {
    const node = textRef.current;
    if (!node) return;

    const measure = () => {
      setIsClamped(node.scrollHeight > node.clientHeight + 1);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [comment]);

  return (
    <div className="space-y-1">
      <p ref={textRef} className="text-muted-foreground line-clamp-2">
        {comment}
      </p>
      {isClamped ? (
        <button
          type="button"
          onClick={onSeeMore}
          className="text-foreground text-sm font-medium underline-offset-2 hover:underline"
        >
          See more
        </button>
      ) : null}
    </div>
  );
}

function ReviewDetailDialog({
  review,
  open,
  onOpenChange,
  onPhotoClick,
  dismissLocked,
}: {
  review: PropertyReviewItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPhotoClick: (urls: string[], index: number) => void;
  dismissLocked?: boolean;
}) {
  if (!review) return null;

  const photos = reviewImageUrls(review);

  return (
    <GuestDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Review"
      dismissLocked={dismissLocked}
      sizeClassName="max-w-[min(calc(100vw-1.5rem),36rem)] sm:max-w-[min(90vw,36rem)]"
      heightClassName="max-h-[min(90dvh,44rem)]"
      bodyClassName="space-y-4"
    >
      <ReviewAuthorHeader review={review} />
      <ReviewFeedbackTags review={review} />
      {review.comment ? (
        <p className="text-muted-foreground whitespace-pre-wrap text-sm leading-relaxed">
          {review.comment}
        </p>
      ) : null}
      <ReviewPhotoGrid
        urls={photos}
        reviewId={review.id}
        onPhotoClick={(index) => onPhotoClick(photos, index)}
      />
    </GuestDialogShell>
  );
}

function ReviewPhotoLightbox({
  urls,
  index,
  onClose,
  onIndexChange,
}: {
  urls: string[];
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}) {
  const hasMultiple = urls.length > 1;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        onClose();
        return;
      }
      if (!hasMultiple) return;
      if (event.key === 'ArrowLeft') {
        onIndexChange(index === 0 ? urls.length - 1 : index - 1);
      }
      if (event.key === 'ArrowRight') {
        onIndexChange((index + 1) % urls.length);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [hasMultiple, index, onClose, onIndexChange, urls.length]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pointer-events-auto fixed inset-0 z-[110] flex items-center justify-center bg-black p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Review photo"
      data-review-photo-lightbox=""
      onClick={onClose}
    >
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
        className="pointer-events-auto absolute right-4 top-4 z-10 flex size-11 min-h-[44px] min-w-[44px] items-center justify-center text-white/90 transition-colors hover:text-white"
        aria-label="Close photo"
      >
        <X className="size-6" aria-hidden />
      </button>

      {hasMultiple ? (
        <p className="absolute left-1/2 top-4 z-10 -translate-x-1/2 text-sm tabular-nums text-white/80">
          {index + 1} / {urls.length}
        </p>
      ) : null}

      {hasMultiple ? (
        <>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onIndexChange(index === 0 ? urls.length - 1 : index - 1);
            }}
            className="pointer-events-auto absolute left-4 top-1/2 z-10 flex size-11 min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center text-white/90 transition-colors hover:text-white"
            aria-label="Previous photo"
          >
            <ChevronLeft className="size-6" aria-hidden />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onIndexChange((index + 1) % urls.length);
            }}
            className="pointer-events-auto absolute right-4 top-1/2 z-10 flex size-11 min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center text-white/90 transition-colors hover:text-white"
            aria-label="Next photo"
          >
            <ChevronRight className="size-6" aria-hidden />
          </button>
        </>
      ) : null}

      <motion.img
        key={urls[index]}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        src={urls[index]}
        alt=""
        className="max-h-[min(85dvh,720px)] max-w-[min(92vw,960px)] object-contain"
        onClick={(event) => event.stopPropagation()}
      />
    </motion.div>,
    document.body
  );
}

export function PropertyReviews({
  rating,
  totalReviews,
  reviews = [],
  summary,
}: PropertyReviewsProps) {
  const [sort, setSort] = useState<ReviewSort>('newest');
  const [sortOpen, setSortOpen] = useState(false);
  const resolvedReviews = useMemo(() => {
    const copy = [...reviews];
    if (sort === 'highest') return copy.sort((a, b) => b.rating - a.rating);
    if (sort === 'lowest') return copy.sort((a, b) => a.rating - b.rating);
    return sortReviewsNewestFirst(copy);
  }, [reviews, sort]);
  const [showAll, setShowAll] = useState(false);
  const [photoLightbox, setPhotoLightbox] = useState<{ urls: string[]; index: number } | null>(
    null
  );
  const [detailReview, setDetailReview] = useState<PropertyReviewItem | null>(null);

  const displayedReviews = showAll ? resolvedReviews : resolvedReviews.slice(0, 4);
  const countLabel = totalReviews > 0 ? totalReviews : resolvedReviews.length;

  if (resolvedReviews.length === 0) {
    return null;
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.7 }}
      className="space-y-6"
      aria-labelledby="property-reviews-heading"
    >
      <div className="flex items-center gap-3">
        <Star className="h-8 w-8 fill-amber-400 text-amber-400" aria-hidden />
        <div>
          <h2 id="property-reviews-heading" className="sr-only">
            Reviews
          </h2>
          <span className="text-foreground text-3xl font-bold tabular-nums sm:text-4xl">
            {countLabel < 3 ? 'New' : rating}
          </span>
          <p className="text-muted-foreground">
            {countLabel} review{countLabel === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {summary && countLabel >= 3 ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,16rem)_1fr]">
          <ol className="space-y-1.5">
            {(['5', '4', '3', '2', '1'] as const).map((star) => {
              const amount = summary.distribution[star] ?? 0;
              const pct = summary.count > 0 ? Math.round((amount / summary.count) * 100) : 0;
              return (
                <li key={star} className="flex items-center gap-2 text-sm">
                  <span className="w-3 tabular-nums">{star}</span>
                  <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
                    <div className="h-full bg-amber-400" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ol>
          {summary.categorySample >= 3 ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              {Object.entries(GUEST_REVIEW_CATEGORY_LABELS).map(([id, label]) => {
                const value = summary.categoryAvgs[id === 'check_in' ? 'checkIn' : id];
                if (value == null) return null;
                return (
                  <p key={id}>
                    {label}{' '}
                    <span className="font-medium tabular-nums">{Number(value).toFixed(1)}</span>
                  </p>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          Sort: {sort === 'newest' ? 'Newest' : sort === 'highest' ? 'Highest' : 'Lowest'}
        </p>
        <Button
          type="button"
          variant="outline"
          className="min-h-[44px]"
          onClick={() => setSortOpen(true)}
        >
          Sort
        </Button>
      </div>
      <MobileChoiceSheet open={sortOpen} onOpenChange={setSortOpen} title="Sort reviews">
        <MobileChoiceItem
          selected={sort === 'newest'}
          label="Newest"
          onSelect={() => {
            setSort('newest');
            setSortOpen(false);
          }}
        />
        <MobileChoiceItem
          selected={sort === 'highest'}
          label="Highest"
          onSelect={() => {
            setSort('highest');
            setSortOpen(false);
          }}
        />
        <MobileChoiceItem
          selected={sort === 'lowest'}
          label="Lowest"
          onSelect={() => {
            setSort('lowest');
            setSortOpen(false);
          }}
        />
      </MobileChoiceSheet>

      <div className="space-y-6">
        {displayedReviews.map((review, index) => {
          const photos = reviewImageUrls(review);

          return (
            <motion.div
              key={review.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * index }}
              className="border-border border-b pb-6 last:border-0"
            >
              <div className="mb-3">
                <ReviewAuthorHeader review={review} />
              </div>

              {review.feedbackTags && review.feedbackTags.length > 0 ? (
                <div className="mb-3">
                  <ReviewFeedbackTags review={review} />
                </div>
              ) : null}

              {review.comment ? (
                <div className="mb-3">
                  <ReviewListComment
                    comment={review.comment}
                    onSeeMore={() => setDetailReview(review)}
                  />
                </div>
              ) : null}

              <ReviewResponseBlock
                responseText={review.responseText ?? null}
                label="Response from host"
              />

              {photos.length > 0 ? (
                <ReviewPhotoGrid
                  urls={photos}
                  reviewId={review.id}
                  onPhotoClick={(photoIndex) =>
                    setPhotoLightbox({ urls: photos, index: photoIndex })
                  }
                />
              ) : null}
            </motion.div>
          );
        })}
      </div>

      {resolvedReviews.length > 4 ? (
        <Button
          variant="outline"
          onClick={() => setShowAll(!showAll)}
          className="w-full gap-2 rounded-xl sm:w-auto"
        >
          {showAll ? 'Show less' : `Show all ${countLabel} reviews`}
          <ChevronRight className={cn('h-4 w-4 transition-transform', showAll && 'rotate-90')} />
        </Button>
      ) : null}

      <ReviewDetailDialog
        review={detailReview}
        open={detailReview != null}
        dismissLocked={photoLightbox != null}
        onOpenChange={(open) => {
          if (!open) setDetailReview(null);
        }}
        onPhotoClick={(urls, photoIndex) => setPhotoLightbox({ urls, index: photoIndex })}
      />

      <AnimatePresence>
        {photoLightbox ? (
          <ReviewPhotoLightbox
            urls={photoLightbox.urls}
            index={photoLightbox.index}
            onClose={() => setPhotoLightbox(null)}
            onIndexChange={(photoIndex) =>
              setPhotoLightbox((current) => (current ? { ...current, index: photoIndex } : current))
            }
          />
        ) : null}
      </AnimatePresence>
    </motion.section>
  );
}
