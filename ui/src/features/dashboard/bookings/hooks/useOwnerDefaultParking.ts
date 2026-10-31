/**
 * Host-facing: resolve org-owned parking default for a property stay.
 */

import { useQuery } from '@tanstack/react-query';

import { scopedFunctionsUrl, usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

import { supabase } from '@/lib/supabase/client';

export type OwnerDefaultParkingSlot = {
  id: string;
  slug: string;
  name: string;
  residenceName: string | null;
  createdAt?: string | null;
};

export type OwnerDefaultParkingResult = {
  hasOrgParkings: boolean;
  available: OwnerDefaultParkingSlot[];
  defaultParking: OwnerDefaultParkingSlot | null;
  unavailableReason: 'none_owned' | 'all_conflicted' | 'none_active' | null;
  checkInDate: string;
  checkOutDate: string;
};

async function getAdminJwt(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('No active session. Please sign in');
  return token;
}

async function fetchOwnerDefaultParking(
  bookingId: string,
  propertyId: string | null
): Promise<OwnerDefaultParkingResult> {
  const jwt = await getAdminJwt();
  const url = scopedFunctionsUrl('/resolve-owner-default-parking', propertyId);
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
  return json.data as OwnerDefaultParkingResult;
}

export function useOwnerDefaultParking(bookingId: string | null | undefined, enabled = true) {
  const propertyId = usePropertyIdParam();
  return useQuery({
    queryKey: ['owner-default-parking', bookingId, propertyId],
    queryFn: () => fetchOwnerDefaultParking(bookingId as string, propertyId),
    enabled: !!bookingId && enabled,
    staleTime: 30_000,
  });
}
