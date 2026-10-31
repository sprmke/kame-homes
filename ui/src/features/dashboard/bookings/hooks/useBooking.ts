import { useQuery } from '@tanstack/react-query';

import type { BookingRow } from '@/features/dashboard/bookings/lib/types';
import { useOptionalParkingContext } from '@/features/dashboard/org/components/RequireParkingContext';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

import { supabase } from '@/lib/supabase/client';

export const BOOKING_QUERY_KEY = (id: string) => ['booking', id] as const;

export function bookingDetailQueryKey(
  bookingId: string,
  scopeOrPropertyId?: string | null | { propertyId?: string | null; parkingId?: string | null }
) {
  const scope =
    typeof scopeOrPropertyId === 'object' &&
    scopeOrPropertyId !== null &&
    !Array.isArray(scopeOrPropertyId)
      ? scopeOrPropertyId
      : { propertyId: scopeOrPropertyId ?? null, parkingId: null };
  return [
    ...BOOKING_QUERY_KEY(bookingId),
    scope.propertyId ?? null,
    scope.parkingId ?? null,
  ] as const;
}

/** Fetches a single booking row by ID from guest_submissions (admin session required). */
export function useBooking(
  bookingId: string | undefined,
  options?: { propertyId?: string | null; parkingId?: string | null }
) {
  const routePropertyId = usePropertyIdParam();
  const parkingContext = useOptionalParkingContext();
  const routeParkingId = parkingContext?.parking.id ?? null;

  const propertyId = options?.propertyId ?? routePropertyId;
  const parkingId = options?.parkingId ?? routeParkingId;

  return useQuery<BookingRow | null>({
    queryKey: bookingDetailQueryKey(bookingId ?? '', { propertyId, parkingId }),
    queryFn: async () => {
      if (!bookingId) return null;

      let request = supabase.from('guest_submissions').select('*').eq('id', bookingId);

      if (propertyId) {
        request = request.eq('property_id', propertyId);
      } else if (parkingId) {
        request = request.eq('parking_id', parkingId);
      }

      const { data, error } = await request.single();

      if (error) {
        if (error.code !== 'PGRST116') throw new Error(error.message);
        // Parking-scoped, not found: may be a pre-claim broadcast request
        // (parking_id still null). Caller must verify candidacy separately
        // (see useParkingBroadcastStatus) before treating this as authorized.
        if (parkingId) {
          const { data: unclaimed, error: unclaimedError } = await supabase
            .from('guest_submissions')
            .select('*')
            .eq('id', bookingId)
            .is('parking_id', null)
            .maybeSingle();
          if (unclaimedError) throw new Error(unclaimedError.message);
          return (unclaimed ?? null) as BookingRow | null;
        }
        return null;
      }

      return (data ?? null) as BookingRow | null;
    },
    enabled: !!bookingId,
    staleTime: 10_000,
  });
}
