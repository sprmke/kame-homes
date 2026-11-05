import type { MarketingGuestReview } from '@/features/dashboard/marketing/lib/marketingGuestReview';

/**
 * Hands a picked guest review to the next editor that mounts (Reviews panel →
 * "Open as new design"), without putting review text in the URL.
 */
let pending: MarketingGuestReview | null = null;

export function setPendingMarketingReview(review: MarketingGuestReview | null): void {
  pending = review;
}

/** Returns the pending review once, then clears it. */
export function takePendingMarketingReview(): MarketingGuestReview | null {
  const review = pending;
  pending = null;
  return review;
}
