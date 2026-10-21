import type { CategoryRatings } from '@/features/reviews/lib/reviewCatalog';

export type ReviewListTab = 'received' | 'written' | 'to_write';

export type PropertyReviewSummary = {
  count: number;
  avgOverall: number | null;
  distribution: Record<'1' | '2' | '3' | '4' | '5', number>;
  categoryAvgs: Record<string, number | null>;
  categorySample: number;
  responseRate: number;
  dueCount: number;
};

export type ReceivedReviewItem = {
  id: string;
  bookingId: string;
  guestName: string | null;
  starRating: number;
  reviewText: string | null;
  privateNote: string | null;
  categoryRatings: CategoryRatings;
  feedbackTags: string[];
  mediaUrls: unknown;
  responseText: string | null;
  publishedAt: string | null;
  checkInDate: string | null;
  checkOutDate: string | null;
};

export type WrittenReviewItem = {
  id: string;
  bookingId: string;
  guestName: string | null;
  overallRating: number;
  reviewText: string | null;
  status: string;
  wouldHostAgain: boolean;
  responseText: string | null;
  closesAt: string | null;
  submittedAt: string;
};

export type ToWriteItem = {
  bookingId: string;
  guestName: string | null;
  closesAt: string;
  checkInDate: string | null;
  checkOutDate: string | null;
};

export type PropertyReviewsPage = {
  tab: ReviewListTab;
  summary: PropertyReviewSummary;
  items: Array<ReceivedReviewItem | WrittenReviewItem | ToWriteItem>;
  nextCursor: string | null;
};
