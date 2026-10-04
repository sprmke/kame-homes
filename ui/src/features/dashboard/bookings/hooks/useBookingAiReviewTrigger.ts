import { useMutation, useQueryClient } from '@tanstack/react-query';

import { bookingDetailQueryKey } from '@/features/dashboard/bookings/hooks/useBooking';
import { bookingAiReviewQueryKey } from '@/features/dashboard/bookings/hooks/useBookingAiReview';
import {
  buildOptimisticProcessingReview,
  hasPriorAiReviewResults,
} from '@/features/dashboard/bookings/lib/bookingAiReviewProgress';
import type { BookingAiReview } from '@/features/dashboard/bookings/lib/types';
import { scopedFunctionsUrl, usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';
import {
  handleAiMutationError,
  parseEdgeJsonOrQuota,
} from '@/features/dashboard/org/lib/aiQuotaToast';

import { supabase } from '@/lib/supabase/client';

async function getAdminJwt(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('No active session. Please sign in');
  return token;
}

async function triggerBookingAiReview(
  bookingId: string,
  propertyId: string | null
): Promise<BookingAiReview> {
  const jwt = await getAdminJwt();
  const res = await fetch(scopedFunctionsUrl('/booking-ai-review', propertyId), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({ bookingId, force: true, refresh: true }),
  });
  return parseEdgeJsonOrQuota<BookingAiReview>(res);
}

export function useBookingAiReviewTrigger(
  bookingId: string | null | undefined,
  onSuccess?: (data: BookingAiReview) => void
) {
  const qc = useQueryClient();
  const propertyId = usePropertyIdParam();
  const queryKey = bookingAiReviewQueryKey(bookingId ?? null, propertyId);

  return useMutation({
    mutationFn: () => triggerBookingAiReview(bookingId as string, propertyId),
    onMutate: async () => {
      if (!bookingId) return {};
      await qc.cancelQueries({ queryKey });
      const previous = qc.getQueryData<BookingAiReview | null>(queryKey);
      qc.setQueryData(
        queryKey,
        previous && hasPriorAiReviewResults(previous)
          ? { ...previous, job_status: 'processing' as const, stale_sections: [] }
          : buildOptimisticProcessingReview(bookingId)
      );
      void qc.invalidateQueries({ queryKey, refetchType: 'active' });
      return { previous };
    },
    onError: (err, _vars, context) => {
      // Plan / credit limits get an Upgrade action; anything else still needs a message,
      // otherwise the spinner just snaps back with no explanation.
      handleAiMutationError(err);
      if (context?.previous !== undefined) {
        qc.setQueryData(queryKey, context.previous);
      }
    },
    onSuccess: (data) => {
      qc.setQueryData(queryKey, data);
      if (data.job_status === 'completed' || data.job_status === 'failed') {
        void qc.invalidateQueries({
          queryKey: bookingDetailQueryKey(bookingId as string, propertyId),
        });
      }
      onSuccess?.(data);
    },
  });
}
