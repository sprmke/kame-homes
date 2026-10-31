/**
 * Lightweight host "Find parking" setup — marks `need_parking` without legacy
 * rate/date modal. Marketplace pricing lives on parking listings / platform settings.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { BOOKING_QUERY_KEY } from '@/features/dashboard/bookings/hooks/useBooking';
import { callUpdateBookingDetails } from '@/features/dashboard/bookings/lib/updateBookingDetailsApi';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

type Args = {
  bookingId: string;
};

export function useEnsureNeedParking() {
  const qc = useQueryClient();
  const propertyId = usePropertyIdParam();

  return useMutation({
    mutationFn: async ({ bookingId }: Args) => {
      const result = await callUpdateBookingDetails(propertyId, {
        operation: 'ensure_need_parking',
        bookingId,
      });
      if (result.skipped) return { skipped: true as const };
      return { skipped: false as const };
    },
    onSuccess: (_data, { bookingId }) => {
      void qc.invalidateQueries({ queryKey: BOOKING_QUERY_KEY(bookingId) });
    },
  });
}
