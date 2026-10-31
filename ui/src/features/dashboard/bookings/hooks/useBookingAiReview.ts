import { useQuery, type QueryClient } from '@tanstack/react-query';

import { isStuckProcessingReview } from '@/features/dashboard/bookings/lib/bookingAiReviewProgress';
import type { BookingAiReview } from '@/features/dashboard/bookings/lib/types';
import { scopedFunctionsUrl, usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

import { supabase } from '@/lib/supabase/client';

export const BOOKING_AI_REVIEW_QUERY_KEY = 'booking-ai-review';

const POLL_MS = 1000;

function bookingAiReviewQueryKey(bookingId: string | null, propertyId: string | null) {
  return [BOOKING_AI_REVIEW_QUERY_KEY, bookingId, propertyId];
}

async function getAdminJwt(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('No active session. Please sign in');
  return token;
}

async function fetchBookingAiReview(
  bookingId: string,
  propertyId: string | null
): Promise<BookingAiReview | null> {
  const jwt = await getAdminJwt();
  const url = scopedFunctionsUrl('/get-booking-ai-review', propertyId);
  const params = new URLSearchParams();
  params.set('bookingId', bookingId);
  const qs = url.includes('?') ? `&${params.toString()}` : `?${params.toString()}`;
  const res = await fetch(`${url}${qs}`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.error ?? `HTTP ${res.status}`);
  }
  return (json.data as BookingAiReview | null) ?? null;
}

export function useBookingAiReview(bookingId: string | null | undefined) {
  const propertyId = usePropertyIdParam();
  return useQuery({
    queryKey: bookingAiReviewQueryKey(bookingId ?? null, propertyId),
    queryFn: () => fetchBookingAiReview(bookingId as string, propertyId),
    enabled: !!bookingId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data || data.job_status !== 'processing') return false;
      // Orphaned row from a killed background worker — stop hammering GET.
      if (isStuckProcessingReview(data)) return false;
      return POLL_MS;
    },
    refetchIntervalInBackground: true,
    staleTime: 0,
  });
}

export function invalidateBookingAiReviewQueries(qc: QueryClient, bookingId?: string) {
  return qc.invalidateQueries({
    queryKey: bookingId ? [BOOKING_AI_REVIEW_QUERY_KEY, bookingId] : [BOOKING_AI_REVIEW_QUERY_KEY],
  });
}

export { bookingAiReviewQueryKey };
