import { ReviewsListPage } from '@/features/reviews/pages/ReviewsListPage';

/** Org rollup — every listing in one list, plus the By-property tab. */
export function OrgReviewsPage() {
  return <ReviewsListPage scope="org" />;
}
