import { useQuery } from '@tanstack/react-query';

import { guestEdgeAuthHeaders } from '@/features/guest/auth/lib/guestEdgeAuthHeaders';

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL as string;

export type LinkableParkingBooking = {
  id: string;
  propertyName: string | null;
  propertySlug: string | null;
  checkInDate: string;
  checkOutDate: string;
  towerAndUnitNumber: string | null;
  carPlateNumber: string | null;
  carBrandModel: string | null;
  carColor: string | null;
  guestName: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
};

async function fetchLinkableParkingBookings(): Promise<LinkableParkingBooking[]> {
  const authHeaders = await guestEdgeAuthHeaders();
  const res = await fetch(`${FUNCTIONS_URL}/list-linkable-property-bookings`, {
    headers: authHeaders,
  });
  const json = (await res.json()) as {
    success?: boolean;
    data?: { bookings: LinkableParkingBooking[] };
    error?: string;
  };
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error ?? 'Could not load your bookings');
  }
  return json.data.bookings;
}

/**
 * Phase 7 self-serve entry point — property stays this signed-in guest can still link a
 * marketplace parking booking to (`need_parking = true`, confirmed, not yet linked). Feeds the
 * "which stay is this for?" picker in `ParkingRegistrationForm`.
 */
export function useLinkableParkingBookings(enabled: boolean) {
  return useQuery({
    queryKey: ['linkable-parking-bookings'],
    queryFn: fetchLinkableParkingBookings,
    enabled,
    staleTime: 30_000,
  });
}
