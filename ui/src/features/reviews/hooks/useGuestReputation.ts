import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { scopedAdminPath } from '@/features/dashboard/org/lib/adminApiScope';
import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';

import { PROPERTY_REVIEWS_QUERY_KEY } from '@/features/reviews/hooks/usePropertyReviews';
import type { GuestReputationPayload } from '@/features/reviews/lib/reviewApi';
import { useReviewPropertyId } from '@/features/reviews/lib/reviewPropertyScopeContext';

export const GUEST_REPUTATION_QUERY_KEY = 'guest-reputation';

export function guestReputationQueryKey(bookingId: string | null, propertyId: string | null) {
  return [GUEST_REPUTATION_QUERY_KEY, bookingId, propertyId] as const;
}

export type SubmitHostGuestReviewInput = {
  bookingId: string;
  overallRating: number;
  cleanlinessRating: number;
  communicationRating: number;
  houseRulesRating: number;
  wouldHostAgain: boolean;
  strengthTags: string[];
  issueTags: string[];
  reviewText: string;
  privateNote: string;
  internalNote: string;
};

export function useGuestReputation(bookingId: string | null | undefined) {
  const propertyId = useReviewPropertyId();
  return useQuery({
    queryKey: guestReputationQueryKey(bookingId ?? null, propertyId),
    queryFn: () => {
      const path = scopedAdminPath(
        `get-guest-reputation?bookingId=${encodeURIComponent(bookingId as string)}`,
        propertyId
      );
      return callEdgeFunction<GuestReputationPayload>(path);
    },
    enabled: Boolean(bookingId && propertyId),
    staleTime: 30_000,
  });
}

export function useSubmitHostGuestReview(bookingId: string) {
  const propertyId = useReviewPropertyId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<SubmitHostGuestReviewInput, 'bookingId'>) => {
      const path = scopedAdminPath('submit-host-guest-review', propertyId);
      return callEdgeFunction<{ submitted: boolean; wasEdit: boolean }>(path, {
        method: 'POST',
        body: JSON.stringify({ bookingId, ...input }),
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: guestReputationQueryKey(bookingId, propertyId),
      });
      // To write / Written tabs and the KPI row change after a host review.
      void queryClient.invalidateQueries({
        queryKey: [PROPERTY_REVIEWS_QUERY_KEY, propertyId],
      });
    },
  });
}
