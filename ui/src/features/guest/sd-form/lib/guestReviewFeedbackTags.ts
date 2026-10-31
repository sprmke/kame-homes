export type GuestReviewFeedbackTag = {
  id: string;
  label: string;
};

/** Positive tags — shown when overall rating is 4–5 (Airbnb-style compliment pills). */
export const GUEST_REVIEW_POSITIVE_TAGS: GuestReviewFeedbackTag[] = [
  { id: 'sparkling_clean', label: 'Sparkling clean' },
  { id: 'easy_check_in', label: 'Easy check-in' },
  { id: 'great_location', label: 'Great location' },
  { id: 'responsive_host', label: 'Responsive host' },
  { id: 'thoughtful_touches', label: 'Thoughtful touches' },
  { id: 'matched_listing', label: 'Matched listing' },
  { id: 'comfortable_stay', label: 'Comfortable stay' },
  { id: 'well_equipped', label: 'Well equipped' },
  { id: 'good_value', label: 'Good value' },
  { id: 'felt_at_home', label: 'Felt at home' },
];

/** Constructive tags — shown when overall rating is 1–3. */
export const GUEST_REVIEW_CONSTRUCTIVE_TAGS: GuestReviewFeedbackTag[] = [
  { id: 'could_be_cleaner', label: 'Could be cleaner' },
  { id: 'hard_to_find', label: 'Hard to find' },
  { id: 'slow_responses', label: 'Slow responses' },
  { id: 'didnt_match_photos', label: "Didn't match photos" },
  { id: 'needs_maintenance', label: 'Needs maintenance' },
  { id: 'noisy_area', label: 'Noisy area' },
  { id: 'missing_amenities', label: 'Missing amenities' },
  { id: 'check_in_issues', label: 'Check-in issues' },
  { id: 'unclear_instructions', label: 'Unclear instructions' },
];

export const MAX_GUEST_REVIEW_FEEDBACK_TAGS = 6;

const POSITIVE_TAG_IDS = new Set(GUEST_REVIEW_POSITIVE_TAGS.map((tag) => tag.id));
const CONSTRUCTIVE_TAG_IDS = new Set(GUEST_REVIEW_CONSTRUCTIVE_TAGS.map((tag) => tag.id));

const TAG_LABEL_BY_ID = new Map(
  [...GUEST_REVIEW_POSITIVE_TAGS, ...GUEST_REVIEW_CONSTRUCTIVE_TAGS].map((tag) => [
    tag.id,
    tag.label,
  ])
);

export function guestReviewTagsForRating(starRating: number): GuestReviewFeedbackTag[] {
  return starRating >= 4 ? GUEST_REVIEW_POSITIVE_TAGS : GUEST_REVIEW_CONSTRUCTIVE_TAGS;
}

export function guestReviewFeedbackPrompt(starRating: number): string {
  return starRating >= 4 ? 'What stood out?' : 'What could improve?';
}

export function filterGuestReviewTagsForRating(starRating: number, tagIds: string[]): string[] {
  const allowed = starRating >= 4 ? POSITIVE_TAG_IDS : CONSTRUCTIVE_TAG_IDS;
  return tagIds.filter((id) => allowed.has(id));
}

export function guestReviewFeedbackTagLabel(tagId: string): string {
  return TAG_LABEL_BY_ID.get(tagId) ?? tagId;
}

export function validateGuestReviewFeedbackTagsClient(
  starRating: number,
  tagIds: string[]
): string | null {
  if (tagIds.length === 0) return null;
  if (tagIds.length > MAX_GUEST_REVIEW_FEEDBACK_TAGS) {
    return `Select up to ${MAX_GUEST_REVIEW_FEEDBACK_TAGS} tags`;
  }
  const allowed = starRating >= 4 ? POSITIVE_TAG_IDS : CONSTRUCTIVE_TAG_IDS;
  for (const id of tagIds) {
    if (!allowed.has(id)) return 'Invalid feedback tag';
  }
  return null;
}
