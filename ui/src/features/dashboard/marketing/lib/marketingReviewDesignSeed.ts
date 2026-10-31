import type { DesignBinding } from '@/features/dashboard/marketing/lib/designCanvasTypes';
import {
  firstReviewImageUrl,
  formatReviewAttributionFromReview,
  reviewStarLabel,
  truncateReviewQuote,
  type MarketingGuestReview,
} from '@/features/dashboard/marketing/lib/marketingGuestReview';

/** Sample copy when no review is selected yet. */
export const SAMPLE_MARKETING_REVIEW = {
  quote: 'Felt like home the moment we arrived.',
  author: 'Recent guest',
  rating: 5,
  attribution: '- Recent guest',
  stars: reviewStarLabel(5),
} as const;

export type ReviewDesignFields = {
  quote: string;
  author: string;
  rating: number;
  attribution: string;
  stars: string;
  photoUrl: string | null;
  sourceReviewId: string | null;
};

export function resolveReviewDesignFields(
  review: MarketingGuestReview | null | undefined,
  binding: DesignBinding
): ReviewDesignFields {
  if (!review || !review.socialSeedAllowed) {
    return {
      quote: SAMPLE_MARKETING_REVIEW.quote,
      author: SAMPLE_MARKETING_REVIEW.author,
      rating: SAMPLE_MARKETING_REVIEW.rating,
      attribution: SAMPLE_MARKETING_REVIEW.attribution,
      stars: SAMPLE_MARKETING_REVIEW.stars,
      photoUrl: binding.propertyPhoto,
      sourceReviewId: null,
    };
  }

  const quote = truncateReviewQuote(review.comment, 180) || SAMPLE_MARKETING_REVIEW.quote;
  const author = review.author.trim() || 'Guest';
  const rating = Math.min(5, Math.max(1, Math.round(review.rating)));

  return {
    quote,
    author,
    rating,
    attribution: formatReviewAttributionFromReview(review),
    stars: reviewStarLabel(rating),
    photoUrl: firstReviewImageUrl(review) || binding.propertyPhoto,
    sourceReviewId: review.id,
  };
}

/** Merge selected review into a DesignBinding for campaign builders. */
export function bindingWithReview(
  binding: DesignBinding,
  review: MarketingGuestReview | null | undefined
): DesignBinding {
  const fields = resolveReviewDesignFields(review, binding);
  return {
    ...binding,
    reviewQuote: fields.quote,
    reviewAuthor: fields.author,
    reviewRating: fields.rating,
    reviewAttribution: fields.attribution,
    reviewStars: fields.stars,
    reviewPhoto: fields.photoUrl,
    sourceReviewId: fields.sourceReviewId,
    // Prefer review stay photo as page background when present.
    propertyPhoto: fields.photoUrl || binding.propertyPhoto,
  };
}
