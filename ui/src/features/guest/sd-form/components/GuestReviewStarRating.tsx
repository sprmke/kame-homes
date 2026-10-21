import { useState } from 'react';

import { Star } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface GuestReviewStarRatingProps {
  value: number;
  onChange: (rating: number) => void;
  disabled?: boolean;
  /** Compact picker for dense admin forms (default: guest-facing large stars). */
  size?: 'guest' | 'compact';
  className?: string;
  /** Override the radiogroup's accessible name (default: "Star rating"). */
  ariaLabel?: string;
}

export function GuestReviewStarRating({
  value,
  onChange,
  disabled = false,
  size = 'guest',
  className,
  ariaLabel = 'Star rating',
}: GuestReviewStarRatingProps) {
  const [hoverRating, setHoverRating] = useState(0);
  const displayRating = hoverRating || value;
  const isGuest = size === 'guest';

  return (
    <div
      className={cn(
        isGuest
          ? 'border-primary/10 from-primary/[0.04] via-card to-muted/15 flex flex-col items-center gap-4 rounded-xl border bg-gradient-to-b px-4 py-6 sm:px-6'
          : 'flex h-10 items-center',
        className
      )}
    >
      {isGuest ? (
        <div className="space-y-1 text-center">
          <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Rating</p>
          {value > 0 ? (
            <p className="text-foreground text-sm font-semibold tabular-nums" aria-live="polite">
              {value} of 5
            </p>
          ) : null}
        </div>
      ) : null}

      <div
        className={cn('flex items-center', isGuest ? 'justify-center gap-0.5 sm:gap-1' : 'gap-0')}
        role="radiogroup"
        aria-label={ariaLabel}
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = star <= displayRating;
          return (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={value === star}
              disabled={disabled}
              aria-label={`${star} star${star === 1 ? '' : 's'}`}
              className={cn(
                'flex items-center justify-center rounded-xl transition-transform duration-150 motion-reduce:transition-none',
                'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-50',
                isGuest
                  ? 'min-h-[44px] min-w-[44px] hover:scale-110 active:scale-95 motion-reduce:transform-none'
                  : 'inline-flex size-10 min-h-[44px] min-w-[44px] sm:size-9 sm:min-h-0 sm:min-w-0'
              )}
              onMouseEnter={() => !disabled && setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              // Preview on keyboard focus only. A sheet's auto-focus after a tap would
              // otherwise light the first star as if a 1-star rating were chosen.
              onFocus={(event) => {
                if (!disabled && event.currentTarget.matches(':focus-visible')) {
                  setHoverRating(star);
                }
              }}
              onBlur={() => setHoverRating(0)}
              onClick={() => onChange(star)}
            >
              <Star
                className={cn(
                  isGuest ? 'size-8 sm:size-9' : 'size-[18px]',
                  'transition-colors duration-150',
                  filled ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/35'
                )}
                strokeWidth={filled ? 0 : 1.5}
                aria-hidden
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
