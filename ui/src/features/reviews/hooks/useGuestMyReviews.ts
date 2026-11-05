import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  fetchMyReviews,
  reportReviewAsGuest,
  respondToHostReview,
  type GuestReviewListTab,
} from '@/features/reviews/lib/guestReviewsApi';

export const GUEST_MY_REVIEWS_QUERY_KEY = 'guest-my-reviews';

export function useGuestMyReviews(tab: GuestReviewListTab) {
  return useInfiniteQuery({
    queryKey: [GUEST_MY_REVIEWS_QUERY_KEY, tab],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => fetchMyReviews(tab, pageParam),
    getNextPageParam: (last) => last.nextCursor,
    staleTime: 30_000,
  });
}

export function useRespondToHostReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: respondToHostReview,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [GUEST_MY_REVIEWS_QUERY_KEY] });
    },
  });
}

export function useReportReviewAsGuest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: reportReviewAsGuest,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [GUEST_MY_REVIEWS_QUERY_KEY] });
    },
  });
}
