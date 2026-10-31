import { useQuery } from '@tanstack/react-query';

import { fetchGuestBookedDates } from '@/features/guest/form/lib/fetchGuestBookedDates';

import { useOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';

import type { BookedDateRange } from '@/utils/format/dates';

export const MARKETING_BOOKED_DATES_QUERY_KEY = ['marketing-booked-dates'] as const;

export function useMarketingBookedDates() {
  const { propertySlug } = useOrgContext();

  return useQuery<BookedDateRange[]>({
    queryKey: [...MARKETING_BOOKED_DATES_QUERY_KEY, propertySlug],
    queryFn: () => fetchGuestBookedDates(propertySlug),
    enabled: Boolean(propertySlug),
    staleTime: 60_000,
    gcTime: 5 * 60 * 1000,
  });
}
