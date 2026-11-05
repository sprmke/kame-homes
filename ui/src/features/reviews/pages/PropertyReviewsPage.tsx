import { ReviewsListPage } from '@/features/reviews/pages/ReviewsListPage';

/** Property-scoped reviews — one listing, with the Auto-review sheet. */
export function PropertyReviewsPage() {
  return <ReviewsListPage scope="property" />;
}
