/**
 * External review proof — mirrors `supabase/functions/_shared/propertyExternalReviews.ts`.
 */

export const MAX_PROPERTY_EXTERNAL_REVIEWS = 5;
export const MAX_EXTERNAL_REVIEW_STAY_PHOTOS = 3;
export const MAX_EXTERNAL_REVIEW_TEXT_LENGTH = 2000;

export type ExternalReviewSource = 'facebook' | 'airbnb';

export type ExternalReviewModerationStatus = 'pending' | 'approved' | 'rejected';

export type PropertyExternalReview = {
  id: string;
  source: ExternalReviewSource;
  reviewText: string;
  reviewerName: string;
  starRating: number | null;
  imageUrl: string | null;
  stayPhotoUrls: string[];
  moderationStatus: ExternalReviewModerationStatus;
  createdAt: string | null;
};

export type ExternalReviewFieldErrors = {
  reviewerName?: string;
  reviewText?: string;
  imageUrl?: string;
  stayPhotoUrls?: string;
};

export function normalizeStayPhotoUrls(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    .map((entry) => entry.trim())
    .slice(0, MAX_EXTERNAL_REVIEW_STAY_PHOTOS);
}

export function stayPhotoUrlsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((url, index) => url === b[index]);
}

export function externalReviewContentEqual(
  a: PropertyExternalReview,
  b: PropertyExternalReview
): boolean {
  return (
    a.source === b.source &&
    a.reviewText.trim() === b.reviewText.trim() &&
    a.reviewerName.trim() === b.reviewerName.trim() &&
    a.starRating === b.starRating &&
    (a.imageUrl ?? '') === (b.imageUrl ?? '') &&
    stayPhotoUrlsEqual(a.stayPhotoUrls, b.stayPhotoUrls)
  );
}

/** Host draft edits to approved/rejected reviews return to pending for re-moderation. */
export function applyExternalReviewDraftChange(
  before: PropertyExternalReview,
  after: PropertyExternalReview
): PropertyExternalReview {
  if (before.moderationStatus !== 'approved' && before.moderationStatus !== 'rejected') {
    return after;
  }
  if (externalReviewContentEqual(before, after)) {
    return after;
  }
  return { ...after, moderationStatus: 'pending' };
}

export function createEmptyExternalReview(
  source: ExternalReviewSource = 'airbnb'
): PropertyExternalReview {
  return {
    id: crypto.randomUUID(),
    source,
    reviewText: '',
    reviewerName: '',
    starRating: 5,
    imageUrl: null,
    stayPhotoUrls: [],
    moderationStatus: 'pending',
    createdAt: null,
  };
}

export function normalizeExternalReviewsDraft(raw: unknown): PropertyExternalReview[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MAX_PROPERTY_EXTERNAL_REVIEWS).map((item) => {
    const row = (item ?? {}) as Partial<PropertyExternalReview>;
    const source = row.source === 'facebook' || row.source === 'airbnb' ? row.source : 'airbnb';
    const star =
      row.starRating == null
        ? null
        : Math.min(5, Math.max(1, Math.round(Number(row.starRating)) || 5));
    return {
      id: row.id?.trim() || crypto.randomUUID(),
      source,
      reviewText: row.reviewText?.trim() ?? '',
      reviewerName: row.reviewerName?.trim() ?? '',
      starRating: star,
      imageUrl: row.imageUrl?.trim() || null,
      stayPhotoUrls: normalizeStayPhotoUrls(row.stayPhotoUrls),
      moderationStatus:
        row.moderationStatus === 'approved' || row.moderationStatus === 'rejected'
          ? row.moderationStatus
          : 'pending',
      createdAt: row.createdAt?.trim() || null,
    };
  });
}

export function externalReviewEqual(a: PropertyExternalReview, b: PropertyExternalReview): boolean {
  return (
    a.id === b.id &&
    a.source === b.source &&
    a.reviewText === b.reviewText &&
    a.reviewerName === b.reviewerName &&
    a.starRating === b.starRating &&
    (a.imageUrl ?? '') === (b.imageUrl ?? '') &&
    stayPhotoUrlsEqual(a.stayPhotoUrls, b.stayPhotoUrls)
  );
}

export function externalReviewDirty(
  draft: PropertyExternalReview,
  baseline: PropertyExternalReview | undefined
): boolean {
  if (!baseline) return true;
  return !externalReviewEqual(draft, baseline);
}

/** Persist one review without applying unsaved edits from other draft rows. */
export function mergeExternalReviewsForSingleReviewSave(
  reviewId: string,
  draftReviews: PropertyExternalReview[],
  baselineReviews: PropertyExternalReview[]
): PropertyExternalReview[] | null {
  const draftReview = draftReviews.find((review) => review.id === reviewId);
  if (!draftReview) return null;

  if (baselineReviews.some((review) => review.id === reviewId)) {
    return baselineReviews.map((review) => (review.id === reviewId ? draftReview : review));
  }

  return [...baselineReviews, draftReview];
}

export function externalReviewsEqual(
  a: PropertyExternalReview[],
  b: PropertyExternalReview[]
): boolean {
  if (a.length !== b.length) return false;
  const sortKey = (review: PropertyExternalReview) => review.id;
  const sortedA = [...a].sort((x, y) => sortKey(x).localeCompare(sortKey(y)));
  const sortedB = [...b].sort((x, y) => sortKey(x).localeCompare(sortKey(y)));
  return sortedA.every((review, index) => externalReviewEqual(review, sortedB[index]!));
}

export function externalReviewSourceLabel(source: ExternalReviewSource): string {
  return source === 'airbnb' ? 'Airbnb' : 'Facebook';
}

export function externalReviewModerationLabel(status: ExternalReviewModerationStatus): string {
  switch (status) {
    case 'approved':
      return 'Approved';
    case 'rejected':
      return 'Rejected';
    default:
      return 'Pending';
  }
}

export function rejectedExternalReviewCount(reviews: PropertyExternalReview[]): number {
  return reviews.filter((review) => review.moderationStatus === 'rejected').length;
}

export function externalReviewsAggregateLabel(reviews: PropertyExternalReview[]): {
  label: string;
  tone: 'empty' | 'pending' | 'live' | 'mixed';
} {
  if (reviews.length === 0) {
    return { label: 'None added', tone: 'empty' };
  }
  const approved = reviews.filter((r) => r.moderationStatus === 'approved').length;
  const pending = reviews.filter((r) => r.moderationStatus === 'pending').length;
  if (approved === reviews.length) {
    return { label: `${reviews.length} live on property page`, tone: 'live' };
  }
  if (pending > 0 && approved === 0) {
    return { label: `${reviews.length} submitted · pending approval`, tone: 'pending' };
  }
  return {
    label: `${approved} live · ${pending} pending`,
    tone: pending > 0 ? 'mixed' : 'live',
  };
}

export function getExternalReviewFieldErrors(
  review: PropertyExternalReview
): ExternalReviewFieldErrors {
  const errors: ExternalReviewFieldErrors = {};
  if (!review.reviewerName.trim()) {
    errors.reviewerName = 'Enter reviewer name';
  }
  if (!review.reviewText.trim()) {
    errors.reviewText = 'Enter review text';
  } else if (review.reviewText.trim().length > MAX_EXTERNAL_REVIEW_TEXT_LENGTH) {
    errors.reviewText = 'Review text is too long';
  }
  if (!review.imageUrl?.trim()) {
    errors.imageUrl = 'Add a proof screenshot';
  }
  if (review.stayPhotoUrls.length > MAX_EXTERNAL_REVIEW_STAY_PHOTOS) {
    errors.stayPhotoUrls = `You can add up to ${MAX_EXTERNAL_REVIEW_STAY_PHOTOS} stay photos`;
  }
  return errors;
}

export function isExternalReviewDraftValid(review: PropertyExternalReview): boolean {
  return Object.keys(getExternalReviewFieldErrors(review)).length === 0;
}

export function validateExternalReviewDraft(
  review: PropertyExternalReview,
  label: string
): string | null {
  const errors = getExternalReviewFieldErrors(review);
  const first = errors.reviewerName ?? errors.reviewText ?? errors.imageUrl ?? errors.stayPhotoUrls;
  return first ? `${label}: ${first}` : null;
}

export function validateExternalReviewsDraft(reviews: PropertyExternalReview[]): string | null {
  if (reviews.length > MAX_PROPERTY_EXTERNAL_REVIEWS) {
    return `You can add up to ${MAX_PROPERTY_EXTERNAL_REVIEWS} external reviews`;
  }
  for (let i = 0; i < reviews.length; i++) {
    const err = validateExternalReviewDraft(reviews[i]!, `Review ${i + 1}`);
    if (err) return err;
  }
  return null;
}
