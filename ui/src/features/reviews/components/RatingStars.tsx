import { Star } from 'lucide-react';

import { cn } from '@/lib/utils';

type Props = {
  /** 0–5; rounded to the nearest whole star. */
  value: number;
  className?: string;
};

/**
 * Read-only star rating for review cards. The input picker is
 * `GuestReviewStarRating`; this one is not focusable and reads as one label.
 */
export function RatingStars({ value, className }: Props) {
  const rating = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <span
      role="img"
      aria-label={`${rating} out of 5 stars`}
      className={cn('inline-flex items-center gap-0.5', className)}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          aria-hidden
          strokeWidth={star <= rating ? 0 : 1.5}
          className={cn(
            'size-4',
            star <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/35'
          )}
        />
      ))}
    </span>
  );
}
