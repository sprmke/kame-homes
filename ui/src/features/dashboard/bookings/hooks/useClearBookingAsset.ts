/**
 * useClearBookingAsset — clears a booking document URL (+ AI verdict columns when applicable).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { BOOKING_QUERY_KEY } from '@/features/dashboard/bookings/hooks/useBooking';
import { invalidateBookingAiReviewQueries } from '@/features/dashboard/bookings/hooks/useBookingAiReview';
import { BOOKINGS_QUERY_KEY } from '@/features/dashboard/bookings/hooks/useBookings';
import type { AssetType } from '@/features/dashboard/bookings/hooks/useUploadBookingAsset';
import { callUpdateBookingDetails } from '@/features/dashboard/bookings/lib/updateBookingDetailsApi';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

type ClearArgs = {
  bookingId: string;
  assetType: AssetType;
};

export function useClearBookingAsset() {
  const qc = useQueryClient();
  const propertyId = usePropertyIdParam();

  return useMutation({
    mutationFn: async ({ bookingId, assetType }: ClearArgs) => {
      await callUpdateBookingDetails(propertyId, {
        operation: 'clear_asset',
        bookingId,
        assetType,
      });
    },
    onSuccess: async (_, { bookingId }) => {
      await qc.invalidateQueries({ queryKey: BOOKING_QUERY_KEY(bookingId) });
      await qc.invalidateQueries({ queryKey: BOOKINGS_QUERY_KEY });
      await invalidateBookingAiReviewQueries(qc, bookingId);
    },
  });
}
