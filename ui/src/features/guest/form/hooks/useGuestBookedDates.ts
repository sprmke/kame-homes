import { useQuery } from '@tanstack/react-query';

import { fetchGuestBookedDates } from '@/features/guest/form/lib/fetchGuestBookedDates';

import type { BookedDateRange } from '@/utils/format/dates';

export const GUEST_BOOKED_DATES_QUERY_KEY = ['guest-booked-dates'] as const;

export function useGuestBookedDates(propertySlug: string) {
  const slug = propertySlug.trim();

  return useQuery<BookedDateRange[]>({
    queryKey: [...GUEST_BOOKED_DATES_QUERY_KEY, slug],
    queryFn: () => fetchGuestBookedDates(slug),
    enabled: Boolean(slug),
    staleTime: 60_000,
    gcTime: 5 * 60 * 1000,
  });
}
