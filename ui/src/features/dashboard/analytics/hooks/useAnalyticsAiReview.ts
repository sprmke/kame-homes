import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  fetchAnalyticsAiReview,
  regenerateAnalyticsAiReview,
} from '@/features/dashboard/analytics/hooks/useAnalyticsApi';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

import { AdminEdgeFetchError } from '@/lib/api/adminEdgeFetch';

export const ANALYTICS_AI_REVIEW_KEY = ['analytics-ai-review'] as const;

export function useAnalyticsAiReview() {
  const propertyId = usePropertyIdParam();
  return useQuery({
    queryKey: [...ANALYTICS_AI_REVIEW_KEY, propertyId] as const,
    queryFn: () => fetchAnalyticsAiReview(propertyId),
    enabled: !!propertyId,
    staleTime: 5 * 60_000,
  });
}

export function useRegenerateAnalyticsAiReview() {
  const propertyId = usePropertyIdParam();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (period: { from: string; to: string }) =>
      regenerateAnalyticsAiReview(propertyId, period),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: [...ANALYTICS_AI_REVIEW_KEY, propertyId] });
      if (!result.available) {
        toast.info('AI review is unavailable right now. Showing your last one.');
        return;
      }
      toast.success('Review updated');
    },
    onError: (error: Error) => {
      if (error instanceof AdminEdgeFetchError && error.rateLimited) {
        toast.error('You can analyze this range once a day. Try again tomorrow.');
        return;
      }
      toast.error(error.message || 'Could not refresh the AI performance review');
    },
  });
}
