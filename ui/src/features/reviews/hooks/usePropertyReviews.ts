import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { scopedAdminPath, usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';
import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';

import type { PropertyReviewsPage, ReviewListTab } from '@/features/reviews/lib/propertyReviewsApi';

export const PROPERTY_REVIEWS_QUERY_KEY = 'property-reviews';

export function propertyReviewsQueryKey(propertyId: string | null, tab: ReviewListTab) {
  return [PROPERTY_REVIEWS_QUERY_KEY, propertyId, tab] as const;
}

export function usePropertyReviews(tab: ReviewListTab) {
  const propertyId = usePropertyIdParam();
  return useInfiniteQuery({
    queryKey: propertyReviewsQueryKey(propertyId, tab),
    enabled: Boolean(propertyId),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ tab });
      if (pageParam) params.set('cursor', pageParam);
      const path = scopedAdminPath(`list-property-reviews?${params.toString()}`, propertyId);
      return callEdgeFunction<PropertyReviewsPage>(path);
    },
    getNextPageParam: (last) => last.nextCursor,
    staleTime: 30_000,
  });
}

export function useRespondToGuestReview() {
  const propertyId = usePropertyIdParam();
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
    },
  });
}

export function useReportReview() {
  const propertyId = usePropertyIdParam();
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
    },
  });
}
