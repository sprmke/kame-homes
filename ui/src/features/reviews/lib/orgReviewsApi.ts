import type {
  PropertyReviewSummary,
  ReceivedReviewItem,
} from '@/features/reviews/lib/propertyReviewsApi';

export type OrgPropertyReviewRow = {
  propertyId: string;
  propertySlug: string;
  propertyName: string;
  count: number;
  avgOverall: number | null;
  responseRate: number;
  dueCount: number;
};

export type OrgReviewSummary = PropertyReviewSummary & {
  properties: OrgPropertyReviewRow[];
};

export type OrgReceivedReviewItem = ReceivedReviewItem & {
  propertyId: string;
  propertySlug: string;
  propertyName: string;
};

export type OrgReviewsPage = {
  summary: OrgReviewSummary;
  items: OrgReceivedReviewItem[];
  nextCursor: string | null;
};
