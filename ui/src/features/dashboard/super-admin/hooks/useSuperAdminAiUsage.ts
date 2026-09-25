import { useQuery } from '@tanstack/react-query';

import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';

export type SuperAdminAiUsageRange = '30d' | '90d' | '12mo';

export type SuperAdminAiUsage = {
  range: SuperAdminAiUsageRange;
  generatedAt: string;
  totals: { costUsd: number; calls: number; orgsWithUsage: number; quotaBreaches: number };
  dailySeries: { date: string; costUsd: number; calls: number }[];
  featureBreakdown: {
    feature: string;
    costUsd: number;
    calls: number;
    errors: number;
    errorRatePct: number;
    fallbackRatePct: number;
    latencyP50Ms: number | null;
    latencyP95Ms: number | null;
  }[];
  topOrgs: {
    organizationId: string;
    organizationName: string;
    organizationSlug: string | null;
    costUsd: number;
    calls: number;
    aiEnabled: boolean;
    dailyLimit: number;
    monthlyLimit: number;
    todayCalls: number;
    monthCalls: number;
    overDaily: boolean;
    overMonthly: boolean;
  }[];
  quotaBreaches: SuperAdminAiUsage['topOrgs'];
};

export function useSuperAdminAiUsage(range: SuperAdminAiUsageRange) {
  return useQuery({
    queryKey: ['super-admin', 'ai-usage', range],
    queryFn: () => callEdgeFunction<SuperAdminAiUsage>(`super-admin-ai-usage?range=${range}`),
    staleTime: 60_000,
  });
}
