import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

import { guestReputationQueryKey } from '@/features/reviews/hooks/useGuestReputation';
import {
  draftReviewWithAi,
  fetchReviewAutomationRules,
  saveReviewAutomationRules,
  setAutoReviewPaused,
  type ReviewAutomationRules,
} from '@/features/reviews/lib/reviewAutomationApi';

export const REVIEW_AUTOMATION_QUERY_KEY = 'review-automation-rules';

export function useReviewAutomationRules() {
  const propertyId = usePropertyIdParam();
  return useQuery({
    queryKey: [REVIEW_AUTOMATION_QUERY_KEY, propertyId],
    queryFn: () => fetchReviewAutomationRules(propertyId as string),
    enabled: Boolean(propertyId),
    staleTime: 30_000,
  });
}

export function useSaveReviewAutomationRules() {
  const propertyId = usePropertyIdParam();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rules: ReviewAutomationRules) =>
      saveReviewAutomationRules(propertyId as string, rules),
    onSuccess: (rules) => {
      queryClient.setQueryData([REVIEW_AUTOMATION_QUERY_KEY, propertyId], rules);
    },
  });
}

export function useSetAutoReviewPaused(bookingId: string) {
  const propertyId = usePropertyIdParam();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (paused: boolean) => setAutoReviewPaused(propertyId as string, bookingId, paused),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: guestReputationQueryKey(bookingId, propertyId),
      });
    },
  });
}

export function useDraftReviewWithAi(bookingId: string) {
  const propertyId = usePropertyIdParam();
  return useMutation({
    mutationFn: (kind: 'host_review' | 'guest_response') =>
      draftReviewWithAi({
        propertyId: propertyId as string,
        bookingId,
        kind,
      }),
  });
}
