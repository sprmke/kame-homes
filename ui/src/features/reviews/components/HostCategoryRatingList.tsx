import { GuestReviewStarRating } from '@/features/guest/sd-form/components/GuestReviewStarRating';

import {
  HOST_REVIEW_CATEGORY_IDS,
  HOST_REVIEW_CATEGORY_LABELS,
  type HostCategoryRatings,
  type HostReviewCategoryId,
} from '@/features/reviews/lib/reviewCatalog';

export interface HostCategoryRatingListProps {
  value: HostCategoryRatings;
  onChange: (next: HostCategoryRatings) => void;
  disabled?: boolean;
}

/** Host review of a guest: 3 required category rows. */
export function HostCategoryRatingList({ value, onChange, disabled }: HostCategoryRatingListProps) {
  const setRating = (id: HostReviewCategoryId, rating: number) => {
    onChange({ ...value, [id]: rating });
  };

  return (
    <div className="space-y-1" role="group" aria-label="Guest category ratings">
      {HOST_REVIEW_CATEGORY_IDS.map((id) => (
        <div
          key={id}
          className="border-border/50 flex min-h-[44px] flex-col items-start gap-0.5 border-b py-2 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
        >
          <span id={`host-category-rating-${id}-label`} className="text-foreground text-sm">
            {HOST_REVIEW_CATEGORY_LABELS[id]}
          </span>
          <GuestReviewStarRating
            size="compact"
            value={value[id] ?? 0}
            onChange={(rating) => setRating(id, rating)}
            disabled={disabled}
            className="-ml-3 shrink-0 sm:ml-0"
            ariaLabel={`${HOST_REVIEW_CATEGORY_LABELS[id]} rating`}
          />
        </div>
      ))}
    </div>
  );
}
