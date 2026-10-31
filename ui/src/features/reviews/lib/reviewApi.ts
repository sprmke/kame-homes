/**
 * Shared review API types. Guest write still goes through
 * `features/guest/sd-form/lib/api.ts` (SD form + guest-review share one path).
 */

import type { CategoryRatings } from '@/features/reviews/lib/reviewCatalog';

export type GuestReviewDraft = {
  status: 'submitted' | 'published' | 'removed';
  starRating: number;
  categoryRatings: CategoryRatings;
  reviewText: string | null;
  privateNote: string | null;
  feedbackTags: string[];
  mediaUrls: Array<{ url: string; type: 'image' | 'video' }>;
};

export type HostGuestReviewDraft = {
  status: 'submitted' | 'published' | 'removed';
  overallRating: number;
  cleanlinessRating: number;
  communicationRating: number;
  houseRulesRating: number;
  wouldHostAgain: boolean;
  strengthTags: string[];
  issueTags: string[];
  reviewText: string | null;
  privateNote: string | null;
  internalNote: string | null;
  publishedAt: string | null;
};

export type GuestReputation = {
  reviewCount: number;
  avgOverall: number | null;
  categoryAvgs: {
    cleanliness: number | null;
    communication: number | null;
    houseRules: number | null;
  };
  wouldHostAgainRate: number | null;
  topStrengthTags: string[];
  topIssueTags: string[];
  lastStayAt: string | null;
};

export type ScreeningReview = {
  reviewText: string | null;
  overallRating: number;
  areaLabel: string;
  createdAt: string;
};

export type GuestReputationPayload = {
  hasIdentity: boolean;
  reputation: GuestReputation;
  recentReviews: ScreeningReview[];
  hostReview: HostGuestReviewDraft | null;
  window: {
    closesAt: string;
    publishedAt: string | null;
    closedReason: string | null;
    autoReviewPaused: boolean;
  } | null;
  canHostReview: boolean;
};
