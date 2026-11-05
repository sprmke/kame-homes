import { GuestReviewStarRating } from '@/features/guest/sd-form/components/GuestReviewStarRating';

import {
  GUEST_REVIEW_CATEGORY_IDS,
  GUEST_REVIEW_CATEGORY_LABELS,
  type CategoryRatings,
  type GuestReviewCategoryId,
} from '@/features/reviews/lib/reviewCatalog';

export interface CategoryRatingListProps {
  value: CategoryRatings;
  onChange: (next: CategoryRatings) => void;
  disabled?: boolean;
}

/**
 * D9: all 6 guest categories, required before submit. Five 44px star targets need
 * 220px, so phones put the label above the stars instead of squeezing one row.
 */
export function CategoryRatingList({ value, onChange, disabled }: CategoryRatingListProps) {
  const setRating = (id: GuestReviewCategoryId, rating: number) => {
    onChange({ ...value, [id]: rating });
  };

  return (
    <div className="space-y-1" role="group" aria-label="Category ratings">
      {GUEST_REVIEW_CATEGORY_IDS.map((id) => (
        <div
          key={id}
          className="border-border/50 flex min-h-[44px] flex-col items-start gap-0.5 border-b py-2 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
        >
          <span id={`category-rating-${id}-label`} className="text-foreground text-sm">
            {GUEST_REVIEW_CATEGORY_LABELS[id]}
          </span>
          <GuestReviewStarRating
            size="compact"
            value={value[id] ?? 0}
            onChange={(rating) => setRating(id, rating)}
            disabled={disabled}
            className="-ml-3 shrink-0 sm:ml-0"
            ariaLabel={`${GUEST_REVIEW_CATEGORY_LABELS[id]} rating`}
          />
        </div>
      ))}
    </div>
  );
}
