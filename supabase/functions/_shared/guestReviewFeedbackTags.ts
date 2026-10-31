/**
 * Guest review feedback pill ids — keep in sync with
 * ui/src/features/guest/sd-form/lib/guestReviewFeedbackTags.ts
 */

export const MAX_GUEST_REVIEW_FEEDBACK_TAGS = 6;

export const GUEST_REVIEW_POSITIVE_TAG_IDS = [
  'sparkling_clean',
  'easy_check_in',
  'great_location',
  'responsive_host',
  'thoughtful_touches',
  'matched_listing',
  'comfortable_stay',
  'well_equipped',
  'good_value',
  'felt_at_home',
] as const;

export const GUEST_REVIEW_CONSTRUCTIVE_TAG_IDS = [
  'could_be_cleaner',
  'hard_to_find',
  'slow_responses',
  'didnt_match_photos',
  'needs_maintenance',
  'noisy_area',
  'missing_amenities',
  'check_in_issues',
  'unclear_instructions',
] as const;

const POSITIVE_SET = new Set<string>(GUEST_REVIEW_POSITIVE_TAG_IDS);
const CONSTRUCTIVE_SET = new Set<string>(GUEST_REVIEW_CONSTRUCTIVE_TAG_IDS);

export function parseGuestReviewFeedbackTags(raw: FormDataEntryValue | null): string[] {
  if (raw == null) return [];
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) return [];
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function validateGuestReviewFeedbackTags(
  starRating: number,
  tagIds: string[]
): string | null {
  if (tagIds.length === 0) return null;
  if (tagIds.length > MAX_GUEST_REVIEW_FEEDBACK_TAGS) {
    return `Select up to ${MAX_GUEST_REVIEW_FEEDBACK_TAGS} tags`;
  }
  const allowed = starRating >= 4 ? POSITIVE_SET : CONSTRUCTIVE_SET;
  for (const id of tagIds) {
    if (!allowed.has(id)) return 'Invalid feedback tag';
  }
  return null;
}
