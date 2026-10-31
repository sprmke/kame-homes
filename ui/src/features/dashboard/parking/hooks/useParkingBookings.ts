import { useBookings } from '@/features/dashboard/bookings/hooks/useBookings';
import type { BookingsQuery } from '@/features/dashboard/bookings/lib/types';

/** Parking-scoped booking list — same query as `useBookings` with `scope: 'parking'`. */
export function useParkingBookings(query: BookingsQuery) {
  return useBookings(query, { scope: 'parking' });
}
