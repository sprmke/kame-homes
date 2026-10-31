/**
 * Two-way review category + tag catalogs — UI mirror of
 * `supabase/functions/_shared/reviewCategories.ts`. Keep in sync (parity test:
 * `reviewCatalog.test.ts`).
 */

export const GUEST_REVIEW_CATEGORY_IDS = [
  'cleanliness',
  'accuracy',
  'check_in',
  'communication',
  'location',
  'value',
] as const;
export type GuestReviewCategoryId = (typeof GUEST_REVIEW_CATEGORY_IDS)[number];

export const GUEST_REVIEW_CATEGORY_LABELS: Record<GuestReviewCategoryId, string> = {
  cleanliness: 'Cleanliness',
  accuracy: 'Accuracy',
  check_in: 'Check-in',
  communication: 'Communication',
  location: 'Location',
  value: 'Value',
};

export type CategoryRatings = Partial<Record<GuestReviewCategoryId, number>>;

/** D9: all 6 categories are required before the guest can submit. */
export function isGuestCategoryRatingsComplete(ratings: CategoryRatings): boolean {
  return GUEST_REVIEW_CATEGORY_IDS.every((id) => {
    const value = ratings[id];
    return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5;
  });
}

export const HOST_REVIEW_CATEGORY_IDS = ['cleanliness', 'communication', 'house_rules'] as const;
export type HostReviewCategoryId = (typeof HOST_REVIEW_CATEGORY_IDS)[number];

export const HOST_REVIEW_CATEGORY_LABELS: Record<HostReviewCategoryId, string> = {
  cleanliness: 'Left the place clean',
  communication: 'Communication',
  house_rules: 'Followed house rules',
};

export const MAX_HOST_REVIEW_TAGS = 6;

export const HOST_REVIEW_STRENGTH_TAG_IDS = [
  'great_communicator',
  'left_it_spotless',
  'followed_house_rules',
  'respectful_of_neighbors',
  'on_time_checkin',
  'would_host_again',
  'took_great_care',
  'easy_to_reach',
] as const;

export const HOST_REVIEW_ISSUE_TAG_IDS = [
  'left_it_messy',
  'broke_house_rules',
  'noise_complaints',
  'unauthorized_guests',
  'damaged_property',
  'poor_communication',
  'late_checkout',
  'smoking_violation',
] as const;

export const HOST_REVIEW_STRENGTH_TAG_LABELS: Record<
  (typeof HOST_REVIEW_STRENGTH_TAG_IDS)[number],
  string
> = {
  great_communicator: 'Great communicator',
  left_it_spotless: 'Left it spotless',
  followed_house_rules: 'Followed house rules',
  respectful_of_neighbors: 'Respectful of neighbors',
  on_time_checkin: 'On-time check-in',
  would_host_again: 'Would host again',
  took_great_care: 'Took great care of the place',
  easy_to_reach: 'Easy to reach',
};

export const HOST_REVIEW_ISSUE_TAG_LABELS: Record<
  (typeof HOST_REVIEW_ISSUE_TAG_IDS)[number],
  string
> = {
  left_it_messy: 'Left it messy',
  broke_house_rules: 'Broke house rules',
  noise_complaints: 'Noise complaints',
  unauthorized_guests: 'Unauthorized guests',
  damaged_property: 'Damaged property',
  poor_communication: 'Poor communication',
  late_checkout: 'Late checkout',
  smoking_violation: 'Smoking violation',
};

export const REVIEW_TEXT_MAX_LEN = 2000;
export const REVIEW_RESPONSE_MAX_LEN = 1000;
export const REVIEW_PRIVATE_NOTE_MAX_LEN = 1000;
export const HOST_REVIEW_TEXT_MIN_WHEN_LOW = 30;

export type HostCategoryRatings = Partial<Record<HostReviewCategoryId, number>>;

export function isHostCategoryRatingsComplete(ratings: HostCategoryRatings): boolean {
  return HOST_REVIEW_CATEGORY_IDS.every((id) => {
    const value = ratings[id];
    return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5;
  });
}

export function hostReviewTextRequired(overallRating: number, reviewText: string): boolean {
  if (overallRating > 3) return false;
  return reviewText.trim().length < HOST_REVIEW_TEXT_MIN_WHEN_LOW;
}
