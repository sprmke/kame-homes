import { useParams } from 'react-router-dom';

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { fetchOrgAnalyticsSummary } from '@/features/dashboard/analytics/hooks/useAnalyticsApi';
import type { AnalyticsQuery } from '@/features/dashboard/analytics/lib/types';

export const ORG_ANALYTICS_SUMMARY_KEY = ['org-analytics-summary'] as const;

export function useOrgAnalyticsSummary(query: AnalyticsQuery) {
  const { orgSlug = '' } = useParams<{ orgSlug: string }>();
  return useQuery({
    queryKey: [...ORG_ANALYTICS_SUMMARY_KEY, orgSlug, query] as const,
    queryFn: () => fetchOrgAnalyticsSummary(query, orgSlug),
    enabled: !!orgSlug,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
}
