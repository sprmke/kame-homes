/**
 * Two-way review category + tag catalogs. Mirror in
 * ui/src/features/reviews/lib/reviewCatalog.ts — keep in sync (parity test).
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

/** D9: all 6 guest categories are required at submit time. */
export function validateGuestCategoryRatings(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return 'All category ratings are required';
  }
  const record = raw as Record<string, unknown>;
  for (const id of GUEST_REVIEW_CATEGORY_IDS) {
    const value = record[id];
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 5) {
      return `${GUEST_REVIEW_CATEGORY_LABELS[id]} rating is required (1-5)`;
    }
  }
  return null;
}

export function parseGuestCategoryRatings(raw: unknown): CategoryRatings {
  const out: CategoryRatings = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const record = raw as Record<string, unknown>;
  for (const id of GUEST_REVIEW_CATEGORY_IDS) {
    const value = record[id];
    if (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5) {
      out[id] = value;
    }
  }
  return out;
}

export function parseGuestCategoryRatingsFromFormValue(
  raw: FormDataEntryValue | null
): CategoryRatings {
  if (raw == null) return {};
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) return {};
  try {
    return parseGuestCategoryRatings(JSON.parse(text));
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Host -> guest categories (fixed, typed columns — not JSONB).
// ---------------------------------------------------------------------------

export const HOST_REVIEW_CATEGORY_IDS = ['cleanliness', 'communication', 'house_rules'] as const;
export type HostReviewCategoryId = (typeof HOST_REVIEW_CATEGORY_IDS)[number];

export const HOST_REVIEW_CATEGORY_LABELS: Record<HostReviewCategoryId, string> = {
  cleanliness: 'Left the place clean',
  communication: 'Communication',
  house_rules: 'Followed house rules',
};

export function isValidStarRating(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5;
}

const HOST_REVIEW_TEXT_MIN_WHEN_LOW = 30;

/** Host review of a guest: overall + 3 categories + would-host-again. Text required when overall ≤ 3. */
export function validateHostGuestReviewFields(input: {
  overallRating: unknown;
  cleanlinessRating: unknown;
  communicationRating: unknown;
  houseRulesRating: unknown;
  wouldHostAgain: unknown;
  reviewText: string | null;
}): string | null {
  if (!isValidStarRating(input.overallRating)) return 'Overall rating is required (1-5)';
  if (!isValidStarRating(input.cleanlinessRating)) return 'Cleanliness rating is required (1-5)';
  if (!isValidStarRating(input.communicationRating))
    return 'Communication rating is required (1-5)';
  if (!isValidStarRating(input.houseRulesRating)) return 'House rules rating is required (1-5)';
  if (typeof input.wouldHostAgain !== 'boolean') return 'Would host again is required';
  if (input.overallRating <= 3) {
    const text = input.reviewText?.trim() ?? '';
    if (text.length < HOST_REVIEW_TEXT_MIN_WHEN_LOW) {
      return `Review text is required when overall is 3 or below (at least ${HOST_REVIEW_TEXT_MIN_WHEN_LOW} characters)`;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Host -> guest tags (strengths shown when overall >= 4, issues otherwise).
// ---------------------------------------------------------------------------

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

const STRENGTH_SET = new Set<string>(HOST_REVIEW_STRENGTH_TAG_IDS);
const ISSUE_SET = new Set<string>(HOST_REVIEW_ISSUE_TAG_IDS);

export function parseHostReviewTags(raw: FormDataEntryValue | unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw
      .filter((item): item is string => typeof item === 'string')
      .map((s) => s.trim())
      .filter(Boolean);
  }
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

export function validateHostReviewTags(overallRating: number, tagIds: string[]): string | null {
  if (tagIds.length === 0) return null;
  if (tagIds.length > MAX_HOST_REVIEW_TAGS) return `Select up to ${MAX_HOST_REVIEW_TAGS} tags`;
  const allowed = overallRating >= 4 ? STRENGTH_SET : ISSUE_SET;
  for (const id of tagIds) {
    if (!allowed.has(id)) return 'Invalid tag';
  }
  return null;
}
