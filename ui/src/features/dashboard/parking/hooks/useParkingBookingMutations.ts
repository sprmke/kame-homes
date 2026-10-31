import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { BOOKINGS_QUERY_KEY } from '@/features/dashboard/bookings/hooks/useBookings';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';
import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';

function parkingScopedPath(fn: string, parkingId: string) {
  return `${fn}?parking_id=${encodeURIComponent(parkingId)}`;
}

export function useClaimParkingBooking(parkingId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { bookingId: string; endorsementNote?: string }) => {
      if (!parkingId) throw new Error('Parking context required');
      return callEdgeFunction<{ booking: BookingRow }>(
        parkingScopedPath('claim-parking-booking', parkingId),
        {
          method: 'POST',
          body: JSON.stringify({ ...payload, parkingId }),
        }
      );
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: BOOKINGS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['booking', variables.bookingId] });
      toast.success('Booking accepted');
    },
    onError: (err: Error) => {
      toast.error(err.message === 'already_claimed' ? 'Already claimed' : err.message);
      queryClient.invalidateQueries({ queryKey: BOOKINGS_QUERY_KEY });
    },
  });
}

export function useDeclineParkingBooking(parkingId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { bookingId: string }) => {
      if (!parkingId) throw new Error('Parking context required');
      return callEdgeFunction<{ bookingTerminated: boolean }>(
        parkingScopedPath('decline-parking-booking', parkingId),
        {
          method: 'POST',
          body: JSON.stringify({ ...payload, parkingId }),
        }
      );
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: BOOKINGS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['booking', variables.bookingId] });
      toast.success('Request declined');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useTransitionParkingBooking(parkingId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { bookingId: string; toStatus: string }) => {
      if (!parkingId) throw new Error('Parking context required');
      return callEdgeFunction<BookingRow>(
        parkingScopedPath('transition-parking-booking', parkingId),
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: BOOKINGS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['booking', variables.bookingId] });
      toast.success('Booking updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
