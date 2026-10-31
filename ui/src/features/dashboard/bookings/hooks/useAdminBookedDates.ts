/**
 * useAdminBookedDates — property availability ranges for admin date pickers.
 *
 * Hits the same public `get-booked-dates` endpoint the guest calendar and the
 * booking edit form use (returns every non-`CANCELLED` stay + owner-blocked
 * range for the property). Callers pair the result with
 * `createDisabledDateMatcher(bookedDates, booking.id)` so the booking being
 * edited/rescheduled never blocks its own nights.
 */

import { useQuery } from '@tanstack/react-query';

import { guestBookedDatesUrl } from '@/features/guest/form/lib/guestPropertyScope';

import { normalizeDateString, type BookedDateRange } from '@/utils/format/dates';

export const ADMIN_BOOKED_DATES_QUERY_KEY = ['admin-booked-dates'] as const;

async function fetchAdminBookedDates(propertySlug: string | null): Promise<BookedDateRange[]> {
  const apiUrl = import.meta.env.VITE_API_URL;
  const response = await fetch(guestBookedDatesUrl(apiUrl, propertySlug), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
  });
  const result = await response.json();
  if (!response.ok || !result?.success || !Array.isArray(result?.data)) {
    throw new Error('Failed to load property availability');
  }
  return (result.data as BookedDateRange[]).map((entry) => ({
    ...entry,
    checkInDate: normalizeDateString(entry.checkInDate),
    checkOutDate: normalizeDateString(entry.checkOutDate),
  }));
}

export function useAdminBookedDates(propertySlug: string | null, enabled = true) {
  const slug = propertySlug?.trim() ?? '';
  return useQuery<BookedDateRange[]>({
    queryKey: [...ADMIN_BOOKED_DATES_QUERY_KEY, slug],
    queryFn: () => fetchAdminBookedDates(slug || null),
    enabled: enabled && Boolean(slug),
    staleTime: 60_000,
    gcTime: 5 * 60 * 1000,
  });
}
