import { useQuery } from '@tanstack/react-query';

import { scopedFunctionsUrl, usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

import { supabase } from '@/lib/supabase/client';

export type LinkedParkingHostContact = { name: string; email: string; phone: string | null };

export type LinkedParkingBooking =
  | { linked: false }
  | {
      linked: true;
      parkingBookingId: string;
      status: string;
      endorsementSentAt: string | null;
      endorsementSendError: string | null;
      endorsementEmailSnapshot: string | null;
      hostContact: LinkedParkingHostContact | null;
    };

async function getAdminJwt(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('No active session. Please sign in');
  return token;
}

async function fetchLinkedParkingBooking(
  bookingId: string,
  propertyId: string | null
): Promise<LinkedParkingBooking> {
  const jwt = await getAdminJwt();
  const url = scopedFunctionsUrl('/get-linked-parking-booking', propertyId);
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
  return json.data as LinkedParkingBooking;
}

/** Phase 7 — powers `ParkingPanel`'s live match/host-contact view once a stay is linked. */
export function useLinkedParkingBooking(
  bookingId: string | null | undefined,
  needParking: boolean
) {
  const propertyId = usePropertyIdParam();
  return useQuery({
    queryKey: ['linked-parking-booking', bookingId, propertyId],
    queryFn: () => fetchLinkedParkingBooking(bookingId as string, propertyId),
    enabled: !!bookingId && needParking,
    staleTime: 15_000,
  });
}
