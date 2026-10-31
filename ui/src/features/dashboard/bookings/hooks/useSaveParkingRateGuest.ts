/**
 * useSaveParkingRateGuest — admin-only patch of pay-parking settings before sharing
 * the link or opening the form (rate + parking date window).
 *
 * When parking is added or updated at Ready for Check-in+, clears
 * `parking_completed_at` so the Parking Request sub-step must be completed again.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { BOOKING_QUERY_KEY } from '@/features/dashboard/bookings/hooks/useBooking';
import { callUpdateBookingDetails } from '@/features/dashboard/bookings/lib/updateBookingDetailsApi';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

type Args = {
  bookingId: string;
  parkingRateGuest: number;
  parkingCheckInDate: string;
  parkingCheckOutDate: string;
};

export function useSaveParkingRateGuest() {
  const qc = useQueryClient();
  const propertyId = usePropertyIdParam();

  return useMutation({
    mutationFn: async ({
      bookingId,
      parkingRateGuest,
      parkingCheckInDate,
      parkingCheckOutDate,
    }: Args) => {
      await callUpdateBookingDetails(propertyId, {
        operation: 'save_parking_rate_guest',
        bookingId,
        parkingRateGuest,
        parkingCheckInDate,
        parkingCheckOutDate,
      });
    },
    onSuccess: (_data, { bookingId }) => {
      void qc.invalidateQueries({ queryKey: BOOKING_QUERY_KEY(bookingId) });
    },
  });
}
