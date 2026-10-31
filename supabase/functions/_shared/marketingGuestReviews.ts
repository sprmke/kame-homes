/**
 * Marketing Studio — property guest reviews for Design/Video social seeding.
 */

import { createServiceClient } from './orgAuth.ts';
import type { GuestReviewMediaItem, PublicGuestReviewDto } from './guestReviewService.ts';
import { listApprovedPublicExternalReviews } from './propertyExternalReviews.ts';

export type MarketingGuestReviewSource = 'kame' | 'facebook' | 'airbnb';

export type MarketingGuestReviewDto = {
  id: string;
  author: string;
  date: string;
  rating: number;
  comment: string;
  feedbackTags: string[];
  media: GuestReviewMediaItem[];
  source: MarketingGuestReviewSource;
  createdAt: string | null;
  checkInDate?: string | null;
  checkOutDate?: string | null;
  /** False for Airbnb external text (platform ToS) — library only. */
  socialSeedAllowed: boolean;
};

export function marketingSocialSeedAllowed(source: MarketingGuestReviewSource): boolean {
  return source === 'kame' || source === 'facebook';
}

export function toMarketingGuestReviewDto(review: PublicGuestReviewDto): MarketingGuestReviewDto {
  const source: MarketingGuestReviewSource =
    review.source === 'facebook' || review.source === 'airbnb' ? review.source : 'kame';
  return {
    id: review.id,
    author: review.author,
    date: review.date,
    rating: review.rating,
    comment: review.comment,
    feedbackTags: review.feedbackTags,
    media: review.media,
    source,
    createdAt: review.createdAt,
    checkInDate: review.checkInDate ?? null,
    checkOutDate: review.checkOutDate ?? null,
    socialSeedAllowed: marketingSocialSeedAllowed(source),
  };
}

export type ListMarketingGuestReviewsOpts = {
  minRating?: number;
  limit?: number;
  /** When set, only return that source. */
  source?: MarketingGuestReviewSource | 'all';
  /** When true, only reviews eligible for Design/Video quote seed. */
  socialSeedOnly?: boolean;
};

function clampMinRating(value: number | undefined): number | undefined {
  if (value == null || !Number.isFinite(value)) return undefined;
  const rounded = Math.round(value);
  if (rounded < 1 || rounded > 5) return undefined;
  return rounded;
}

function clampLimit(value: number | undefined): number {
  if (value == null || !Number.isFinite(value)) return 50;
  return Math.min(100, Math.max(1, Math.floor(value)));
}

function sortMarketingGuestReviewsNewestFirst(
  reviews: MarketingGuestReviewDto[]
): MarketingGuestReviewDto[] {
  return [...reviews].sort((a, b) => {
    const aMs = a.createdAt ? Date.parse(a.createdAt) : Number.NaN;
    const bMs = b.createdAt ? Date.parse(b.createdAt) : Number.NaN;
    const aOk = Number.isFinite(aMs);
    const bOk = Number.isFinite(bMs);
    if (aOk && bOk) return bMs - aMs;
    if (aOk) return -1;
    if (bOk) return 1;
    return 0;
  });
}

/** Pure filter/sort for unit tests and the list endpoint. */
export function filterMarketingGuestReviews(
  reviews: MarketingGuestReviewDto[],
  opts: ListMarketingGuestReviewsOpts = {}
): MarketingGuestReviewDto[] {
  const minRating = clampMinRating(opts.minRating);
  const limit = clampLimit(opts.limit);
  const sourceFilter = opts.source && opts.source !== 'all' ? opts.source : null;

  let next = [...reviews];
  if (minRating != null) {
    next = next.filter((review) => review.rating >= minRating);
  }
  if (sourceFilter) {
    next = next.filter((review) => review.source === sourceFilter);
  }
  if (opts.socialSeedOnly) {
    next = next.filter((review) => review.socialSeedAllowed);
  }

  return sortMarketingGuestReviewsNewestFirst(next).slice(0, limit);
}

export async function listPropertyGuestReviewsForMarketing(
  propertyId: string,
  opts: ListMarketingGuestReviewsOpts = {}
): Promise<MarketingGuestReviewDto[]> {
  // Lazy: guestReviewService pulls UploadService (needs env) — keep pure helpers testable.
  const { listPublicGuestReviews } = await import('./guestReviewService.ts');
  const supabase = createServiceClient();
  const [kame, appSettings] = await Promise.all([
    listPublicGuestReviews(propertyId, 100),
    supabase
      .from('app_settings')
      .select('external_reviews')
      .eq('property_id', propertyId)
      .maybeSingle(),
  ]);

  const external = listApprovedPublicExternalReviews(appSettings.data?.external_reviews);
  const merged = [...kame, ...external].map(toMarketingGuestReviewDto);
  return filterMarketingGuestReviews(merged, opts);
}

/** Word-boundary truncate for canvas/video quote slots. */
export function truncateReviewQuote(text: string, max = 160): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= max) return cleaned;
  const slice = cleaned.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > max * 0.4 ? slice.slice(0, lastSpace) : slice;
  return `${cut.trimEnd()}…`;
}

export function formatReviewAttribution(author: string, date?: string): string {
  const name = author.trim() || 'Guest';
  const when = date?.trim();
  return when ? `— ${name} · ${when}` : `— ${name}`;
}
