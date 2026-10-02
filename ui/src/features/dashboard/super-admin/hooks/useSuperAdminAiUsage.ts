import { useQuery } from '@tanstack/react-query';

import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';

export type SuperAdminAiUsageRange = '30d' | '90d' | '12mo';

export type SuperAdminAiUsage = {
  range: SuperAdminAiUsageRange;
  generatedAt: string;
  totals: {
    costUsd: number;
    calls: number;
    credits?: number;
    orgsWithUsage: number;
    quotaBreaches: number;
    monthToDateUsd: number;
    projectedMonthEndUsd: number;
    platformDailyCapUsd: number;
  };
  dailySeries: { date: string; costUsd: number; calls: number }[];
  featureBreakdown: {
    feature: string;
    costUsd: number;
    credits?: number;
    calls: number;
    errors: number;
    errorRatePct: number;
    fallbackRatePct: number;
    cacheHitRatePct?: number;
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
    profileCode: string | null;
    hasOverrides: boolean;
    dailyLimit: number;
    monthlyLimit: number;
    todayCalls: number;
    monthCalls: number;
    overDaily: boolean;
    overMonthly: boolean;
  }[];
  quotaBreaches: SuperAdminAiUsage['topOrgs'];
  /** One row per active plan; orgs without a subscription count under the default plan. */
  planUsage?: SuperAdminAiPlanUsage[];
  /** Marketing Studio image/video jobs created in the range. */
  marketingGenerations?: {
    rows: SuperAdminAiGenerationRow[];
    failureReasons: Array<{ code: string; count: number }>;
    unbilledCompleted: number;
  };
  /** Thumbs on AI assistant replies in the range (absent on older deploys). */
  assistantFeedback?: {
    up: number;
    down: number;
    positivePct: number | null;
    recentNegative: Array<{ reason: string | null; createdAt: string; orgName: string | null }>;
  };
  /** Latest assistant golden eval runs, newest first (`eval:ai --suite assistant --record`). */
  assistantEvalRuns?: AssistantEvalRun[];
};

export type SuperAdminAiPlanUsage = {
  planCode: string;
  planName: string;
  orgCount: number;
  activeOrgs: number;
  calls: number;
  credits: number;
  costUsd: number;
  creditAllowancePerOrg: number;
  monthCredits: number;
  orgsAtAllowance: number;
};

export type SuperAdminAiGenerationRow = {
  mediaType: 'image' | 'video';
  qualityTier: string;
  resolution: string | null;
  total: number;
  completed: number;
  failed: number;
  blocked: number;
  cancelled: number;
  inFlight: number;
  successRatePct: number;
  credits: number;
  costUsd: number;
  renderP50Seconds: number | null;
  renderP95Seconds: number | null;
};

export type AssistantEvalRun = {
  id: string;
  createdAt: string;
  routed: boolean;
  passed: number;
  total: number;
  avgToolsSent: number | null;
  promptVersion: string | null;
  modules: Array<{ module: string; passed: number; total: number }>;
  failedCaseIds: string[];
};

export function useSuperAdminAiUsage(range: SuperAdminAiUsageRange) {
  return useQuery({
    queryKey: ['super-admin', 'ai-usage', range],
    queryFn: () => callEdgeFunction<SuperAdminAiUsage>(`super-admin-ai-usage?range=${range}`),
    staleTime: 60_000,
  });
}
