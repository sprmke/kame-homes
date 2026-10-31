import { guestBookedDatesUrl } from '@/features/guest/form/lib/guestPropertyScope';

import { normalizeDateString, type BookedDateRange } from '@/utils/format/dates';

const apiUrl = import.meta.env.VITE_API_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export async function fetchGuestBookedDates(propertySlug: string): Promise<BookedDateRange[]> {
  const slug = propertySlug.trim();
  if (!slug) return [];

  const response = await fetch(guestBookedDatesUrl(apiUrl, slug), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
  });

  const result = (await response.json()) as {
    success?: boolean;
    data?: BookedDateRange[];
    error?: string;
  };

  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.error ?? 'Failed to load booked dates');
  }

  return result.data.map((booking) => ({
    ...booking,
    checkInDate: normalizeDateString(booking.checkInDate),
    checkOutDate: normalizeDateString(booking.checkOutDate),
  }));
}
