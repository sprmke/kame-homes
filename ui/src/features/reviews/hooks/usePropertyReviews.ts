import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { scopedAdminPath, usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';
import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';

import { ORG_REVIEWS_QUERY_KEY } from '@/features/reviews/hooks/useOrgReviews';
import {
  reviewsQueryToApiParams,
  type PropertyReviewsPage,
  type ReviewListTab,
  type ReviewsQuery,
} from '@/features/reviews/lib/propertyReviewsApi';
import { useReviewPropertyId } from '@/features/reviews/lib/reviewPropertyScopeContext';

export const PROPERTY_REVIEWS_QUERY_KEY = 'property-reviews';

export function propertyReviewsQueryKey(
  propertyId: string | null,
  tab: ReviewListTab,
  params?: string
) {
  return [PROPERTY_REVIEWS_QUERY_KEY, propertyId, tab, params ?? ''] as const;
}

export function usePropertyReviews(
  tab: ReviewListTab,
  query: ReviewsQuery,
  options: { enabled?: boolean } = {}
) {
  const propertyId = usePropertyIdParam();
  const params = reviewsQueryToApiParams(tab, query).toString();
  return useQuery({
    queryKey: propertyReviewsQueryKey(propertyId, tab, params),
    enabled: Boolean(propertyId) && options.enabled !== false,
    queryFn: () =>
      callEdgeFunction<PropertyReviewsPage>(
        scopedAdminPath(`list-property-reviews?${params}`, propertyId)
      ),
    placeholderData: (previous) => previous,
    staleTime: 30_000,
  });
}

export function useRespondToGuestReview() {
  const propertyId = useReviewPropertyId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { bookingId: string; responseText: string | null }) => {
      const path = scopedAdminPath('respond-to-guest-review', propertyId);
      return callEdgeFunction<{ saved: boolean }>(path, {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [PROPERTY_REVIEWS_QUERY_KEY, propertyId],
      });
      void queryClient.invalidateQueries({ queryKey: [ORG_REVIEWS_QUERY_KEY] });
    },
  });
}

export function useReportReview() {
  const propertyId = useReviewPropertyId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      reviewKind: 'guest_review' | 'host_guest_review';
      reviewId: string;
      reason: string;
      details: string;
    }) => {
      const path = scopedAdminPath('report-review', propertyId);
      return callEdgeFunction<{ reported: boolean }>(path, {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [PROPERTY_REVIEWS_QUERY_KEY, propertyId],
      });
      void queryClient.invalidateQueries({ queryKey: [ORG_REVIEWS_QUERY_KEY] });
    },
  });
}
