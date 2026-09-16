/**
 * External review proof stored on app_settings.external_reviews (JSONB).
 * Keep in sync with `ui/src/features/dashboard/org/lib/propertyExternalReviews.ts`.
 * Feedback tag pills are Kame guest reviews only — not Airbnb/Facebook externals.
 */

import type { PublicGuestReviewDto } from './guestReviewService.ts';

export const MAX_PROPERTY_EXTERNAL_REVIEWS = 5;
export const MAX_EXTERNAL_REVIEW_STAY_PHOTOS = 3;
export const MAX_EXTERNAL_REVIEW_TEXT_LENGTH = 2000;

export type ExternalReviewSource = 'facebook' | 'airbnb';

export type ExternalReviewModerationStatus = 'pending' | 'approved' | 'rejected';
export type ExternalReviewModerationDecision = Exclude<ExternalReviewModerationStatus, 'pending'>;

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

const EXTERNAL_REVIEW_SOURCES = new Set<ExternalReviewSource>(['facebook', 'airbnb']);

function newReviewId(): string {
  return crypto.randomUUID();
}

export function createEmptyExternalReview(
  source: ExternalReviewSource = 'airbnb'
): PropertyExternalReview {
  return {
    id: newReviewId(),
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

function normalizeSource(raw: unknown): ExternalReviewSource {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  return EXTERNAL_REVIEW_SOURCES.has(value as ExternalReviewSource)
    ? (value as ExternalReviewSource)
    : 'airbnb';
}

function normalizeModerationStatus(raw: unknown): ExternalReviewModerationStatus {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (value === 'approved' || value === 'rejected') return value;
  return 'pending';
}

function normalizeStarRating(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  if (rounded < 1 || rounded > 5) return null;
  return rounded;
}

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

export function normalizeExternalReviewsDraft(raw: unknown): PropertyExternalReview[] {
  if (!Array.isArray(raw)) return [];
  const parsed: PropertyExternalReview[] = [];
  for (const item of raw.slice(0, MAX_PROPERTY_EXTERNAL_REVIEWS)) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    parsed.push({
      id: typeof row.id === 'string' && row.id.trim() ? row.id.trim() : newReviewId(),
      source: normalizeSource(row.source),
      reviewText: typeof row.reviewText === 'string' ? row.reviewText.trim() : '',
      reviewerName: typeof row.reviewerName === 'string' ? row.reviewerName.trim() : '',
      starRating: normalizeStarRating(row.starRating),
      imageUrl:
        typeof row.imageUrl === 'string' && row.imageUrl.trim() ? row.imageUrl.trim() : null,
      stayPhotoUrls: normalizeStayPhotoUrls(row.stayPhotoUrls),
      moderationStatus: normalizeModerationStatus(row.moderationStatus),
      createdAt:
        typeof row.createdAt === 'string' && row.createdAt.trim() ? row.createdAt.trim() : null,
    });
  }
  return parsed;
}

export function validateExternalReviews(reviews: PropertyExternalReview[]): string | null {
  if (reviews.length > MAX_PROPERTY_EXTERNAL_REVIEWS) {
    return `You can add up to ${MAX_PROPERTY_EXTERNAL_REVIEWS} external reviews`;
  }
  for (let i = 0; i < reviews.length; i++) {
    const review = reviews[i];
    const label = `Review ${i + 1}`;
    if (!review.reviewerName.trim()) return `${label}: Enter reviewer name`;
    if (!review.reviewText.trim()) return `${label}: Enter review text`;
    if (review.reviewText.trim().length > MAX_EXTERNAL_REVIEW_TEXT_LENGTH) {
      return `${label}: Review text is too long`;
    }
    if (!review.imageUrl?.trim()) {
      return `${label}: Add a proof screenshot`;
    }
    const stayCount = review.stayPhotoUrls.length;
    if (stayCount > MAX_EXTERNAL_REVIEW_STAY_PHOTOS) {
      return `${label}: You can add up to ${MAX_EXTERNAL_REVIEW_STAY_PHOTOS} stay photos`;
    }
  }
  return null;
}

/** Owner PATCH: force pending on all submitted reviews; preserve createdAt when id matches. */
export function serializeExternalReviewsForOwnerPatch(
  incoming: PropertyExternalReview[],
  existing: PropertyExternalReview[]
): PropertyExternalReview[] {
  const err = validateExternalReviews(incoming);
  if (err) throw new Error(err);

  const existingById = new Map(existing.map((review) => [review.id, review]));

  return incoming.map((review) => {
    const prior = existingById.get(review.id);
    const contentChanged = !prior || !externalReviewContentEqual(prior, review);
    const resubmitted =
      contentChanged &&
      prior != null &&
      (prior.moderationStatus === 'approved' || prior.moderationStatus === 'rejected');

    return {
      id: review.id.trim() || newReviewId(),
      source: normalizeSource(review.source),
      reviewText: review.reviewText.trim(),
      reviewerName: review.reviewerName.trim(),
      starRating: normalizeStarRating(review.starRating),
      imageUrl: review.imageUrl?.trim() || null,
      stayPhotoUrls: normalizeStayPhotoUrls(review.stayPhotoUrls),
      moderationStatus: contentChanged ? 'pending' : (prior?.moderationStatus ?? 'pending'),
      createdAt: resubmitted
        ? new Date().toISOString()
        : (prior?.createdAt ?? new Date().toISOString()),
    };
  });
}

export type ExternalReviewAssetUploadType = 'external_review_image' | 'external_review_stay_photo';

/** After proof/stay photo upload: mark review pending and persist new asset URL when review exists in JSONB. */
export function applyExternalReviewAssetUpload(
  reviews: PropertyExternalReview[],
  reviewId: string,
  assetType: ExternalReviewAssetUploadType,
  url: string,
  photoIndex?: number
): PropertyExternalReview[] | null {
  const id = reviewId.trim();
  const safeUrl = url.trim();
  if (!id || !safeUrl) return null;

  let found = false;
  const next = reviews.map((review) => {
    if (review.id !== id) return review;

    found = true;
    const wasModerated =
      review.moderationStatus === 'approved' || review.moderationStatus === 'rejected';

    if (assetType === 'external_review_image') {
      const contentChanged = (review.imageUrl ?? '') !== safeUrl;
      if (!contentChanged && !wasModerated) return review;
      return {
        ...review,
        imageUrl: safeUrl,
        moderationStatus: 'pending' as const,
        createdAt: wasModerated || contentChanged ? new Date().toISOString() : review.createdAt,
      };
    }

    const photos = normalizeStayPhotoUrls(review.stayPhotoUrls);
    const idx = Math.min(
      Math.max(photoIndex ?? photos.length, 0),
      MAX_EXTERNAL_REVIEW_STAY_PHOTOS - 1
    );
    const nextPhotos = [...photos];
    if (idx === nextPhotos.length && nextPhotos.length < MAX_EXTERNAL_REVIEW_STAY_PHOTOS) {
      nextPhotos.push(safeUrl);
    } else {
      nextPhotos[idx] = safeUrl;
    }
    const normalizedPhotos = normalizeStayPhotoUrls(nextPhotos);
    const contentChanged = !stayPhotoUrlsEqual(photos, normalizedPhotos);

    if (!contentChanged && !wasModerated) return review;

    return {
      ...review,
      stayPhotoUrls: normalizedPhotos,
      moderationStatus: 'pending' as const,
      createdAt: wasModerated || contentChanged ? new Date().toISOString() : review.createdAt,
    };
  });

  return found ? next : null;
}

export function externalReviewsEqual(
  a: PropertyExternalReview[],
  b: PropertyExternalReview[]
): boolean {
  if (a.length !== b.length) return false;
  const sortKey = (review: PropertyExternalReview) => review.id;
  const sortedA = [...a].sort((x, y) => sortKey(x).localeCompare(sortKey(y)));
  const sortedB = [...b].sort((x, y) => sortKey(x).localeCompare(sortKey(y)));
  return sortedA.every((review, index) => {
    const other = sortedB[index];
    return (
      review.id === other.id &&
      review.source === other.source &&
      review.reviewText === other.reviewText &&
      review.reviewerName === other.reviewerName &&
      review.starRating === other.starRating &&
      (review.imageUrl ?? '') === (other.imageUrl ?? '') &&
      stayPhotoUrlsEqual(review.stayPhotoUrls, other.stayPhotoUrls)
    );
  });
}

function formatReviewMonthYear(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Manila',
  });
}

export function listApprovedPublicExternalReviews(raw: unknown): PublicGuestReviewDto[] {
  return normalizeExternalReviewsDraft(raw)
    .filter((review) => review.moderationStatus === 'approved')
    .map((review) => ({
      id: `ext-${review.id}`,
      author:
        review.reviewerName.trim() ||
        (review.source === 'airbnb' ? 'Airbnb guest' : 'Facebook guest'),
      date: formatReviewMonthYear(review.createdAt) || 'Verified review',
      rating: review.starRating ?? 5,
      comment: review.reviewText,
      feedbackTags: [],
      media: normalizeStayPhotoUrls(review.stayPhotoUrls).map((url) => ({
        url,
        type: 'image' as const,
      })),
      source: review.source,
      createdAt: review.createdAt,
    }));
}

/** Super-admin: set moderation status on one review; throws if missing or not pending. */
export function updateExternalReviewModerationStatus(
  reviews: PropertyExternalReview[],
  reviewId: string,
  decision: ExternalReviewModerationDecision
): PropertyExternalReview[] {
  const id = reviewId.trim();
  if (!id) throw new Error('reviewId is required');

  let found = false;
  const next = reviews.map((review) => {
    if (review.id !== id) return review;
    found = true;
    if (review.moderationStatus !== 'pending') {
      throw new Error('Review is not pending moderation');
    }
    return { ...review, moderationStatus: decision };
  });

  if (!found) throw new Error('Review not found');
  return next;
}

/** Extract storage object path from a public app-settings-assets URL, if present. */
export function externalReviewImageStoragePath(
  imageUrl: string | null,
  propertyId: string,
  reviewId: string
): string | null {
  if (!imageUrl?.trim()) return null;
  const trimmed = imageUrl.trim();
  const marker = '/app-settings-assets/';
  const idx = trimmed.indexOf(marker);
  if (idx >= 0) {
    const path = trimmed.slice(idx + marker.length).split('?')[0];
    return path || null;
  }
  return `external-review/${propertyId}/${reviewId}.jpg`;
}

/** Storage path for stay photo at index 0–2. */
export function externalReviewStayPhotoStoragePath(
  photoUrl: string | null,
  propertyId: string,
  reviewId: string,
  photoIndex: number
): string | null {
  if (!photoUrl?.trim()) return null;
  const trimmed = photoUrl.trim();
  const marker = '/app-settings-assets/';
  const idx = trimmed.indexOf(marker);
  if (idx >= 0) {
    const path = trimmed.slice(idx + marker.length).split('?')[0];
    return path || null;
  }
  const safeIndex = Math.min(Math.max(photoIndex, 0), MAX_EXTERNAL_REVIEW_STAY_PHOTOS - 1);
  return `external-review-stay/${propertyId}/${reviewId}/${safeIndex}.jpg`;
}
