import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { fetchAnalyticsSummary } from '@/features/dashboard/analytics/hooks/useAnalyticsApi';
import type { AnalyticsQuery } from '@/features/dashboard/analytics/lib/types';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

export const ANALYTICS_SUMMARY_KEY = ['analytics-summary'] as const;

/** Historical data changes at most once a day — safe to cache far longer than live KPIs. */
const ANALYTICS_STALE_TIME_MS = 5 * 60_000;

export function usePropertyAnalyticsSummary(query: AnalyticsQuery) {
  const propertyId = usePropertyIdParam();
  return useQuery({
    queryKey: [...ANALYTICS_SUMMARY_KEY, propertyId, query] as const,
    queryFn: () => fetchAnalyticsSummary(query, propertyId),
    placeholderData: keepPreviousData,
    staleTime: ANALYTICS_STALE_TIME_MS,
  });
}
