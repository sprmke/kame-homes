/**
 * Guest trip page link for one booking (`/properties/:slug/trip`). The URL carries a fresh
 * booking access key so the guest can open it without signing in. Fetched up front (stateless
 * HMAC, no DB write) so Copy stays synchronous inside the click for Safari's clipboard rules.
 */

import { useCallback } from 'react';

import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import type { BookingRow } from '@/features/dashboard/bookings/lib/types';
import { scopedFunctionsUrl, usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

import { supabase } from '@/lib/supabase/client';

export type BookingTripLink = {
  /** Empty until the link has loaded (or for parking-only bookings). */
  url: string;
  open: () => void;
  copy: () => void;
};

async function fetchTripLink(bookingId: string, propertyId: string | null): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const jwt = data.session?.access_token;
  if (!jwt) throw new Error('Not signed in');
  const res = await fetch(scopedFunctionsUrl('/issue-guest-trip-link', propertyId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ bookingId }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    error?: string;
    data?: { tripUrl?: string };
  };
  if (!res.ok || !json.success || !json.data?.tripUrl) {
    throw new Error(json.error ?? `HTTP ${res.status}`);
  }
  return json.data.tripUrl;
}

export function useBookingTripLink(booking: BookingRow | null | undefined): BookingTripLink {
  const propertyId = usePropertyIdParam();
  const bookingId = booking?.id ?? '';
  const enabled = Boolean(bookingId) && !booking?.parking_id;

  const { data: url = '' } = useQuery({
    queryKey: ['booking-trip-link', bookingId, propertyId ?? null],
    queryFn: () => fetchTripLink(bookingId, propertyId),
    enabled,
    // Access keys last 180 days; refresh well before that while the page stays open.
    staleTime: 6 * 60 * 60 * 1000,
    retry: 1,
  });

  const open = useCallback(() => {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [url]);

  const copy = useCallback(() => {
    if (!url) return;
    void navigator.clipboard
      .writeText(url)
      .then(() => toast.success('Trip link copied'))
      .catch(() => toast.error('Could not copy link'));
  }, [url]);

  return { url: enabled ? url : '', open, copy };
}
