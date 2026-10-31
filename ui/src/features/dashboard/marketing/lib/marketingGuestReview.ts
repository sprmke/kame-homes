/**
 * Marketing Studio — guest review DTOs + quote helpers (mirrors edge marketingGuestReviews).
 */

export type MarketingGuestReviewSource = 'kame' | 'facebook' | 'airbnb';

export type MarketingGuestReviewMedia = {
  url: string;
  type: 'image' | 'video';
};

export type MarketingGuestReview = {
  id: string;
  author: string;
  date: string;
  rating: number;
  comment: string;
  feedbackTags: string[];
  media: MarketingGuestReviewMedia[];
  source: MarketingGuestReviewSource;
  createdAt: string | null;
  checkInDate?: string | null;
  checkOutDate?: string | null;
  socialSeedAllowed: boolean;
};

import { formatStayDateRange } from '@/utils/format/dates';

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
  return when ? `- ${name} · ${when}` : `- ${name}`;
}

/** Sidebar + canvas/video attribution: prefer booking stay range, else review month/year. */
export function reviewDisplayDate(
  review: Pick<MarketingGuestReview, 'checkInDate' | 'checkOutDate' | 'date'>
): string {
  return formatStayDateRange(review.checkInDate, review.checkOutDate) ?? review.date?.trim() ?? '';
}

export function formatReviewAttributionFromReview(
  review: Pick<MarketingGuestReview, 'author' | 'checkInDate' | 'checkOutDate' | 'date'>
): string {
  return formatReviewAttribution(review.author, reviewDisplayDate(review));
}

export function reviewStarLabel(rating: number): string {
  const clamped = Math.min(5, Math.max(1, Math.round(rating)));
  return '★'.repeat(clamped) + '☆'.repeat(5 - clamped);
}

export function firstReviewImageUrl(review: MarketingGuestReview): string | null {
  const image = review.media.find((item) => item.type === 'image' && item.url.trim());
  return image?.url.trim() || null;
}

export const MARKETING_GUEST_REVIEW_SOURCE_LABELS: Record<MarketingGuestReviewSource, string> = {
  kame: 'Kame',
  facebook: 'Facebook',
  airbnb: 'Airbnb',
};
