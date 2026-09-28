import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { scopedOrgFunctionsUrl, useOrgScopeKey } from '@/features/dashboard/org/lib/adminApiScope';

import { supabase } from '@/lib/supabase/client';

/** `enabled` is the only host-writable field; limits are platform-managed (read-only). */
export type AiPlatformOrgSettingsDto = {
  organizationId: string;
  enabled: boolean;
  dailyCallLimit: number;
  monthlyCallLimit: number;
  dailyCostUsdLimit: number;
  planTier: string;
  updatedAt: string | null;
};

export type AiPlatformUsageFeatureBreakdown = {
  feature: string;
  calls: number;
  estimatedCostUsd: number;
};

export type AiPlatformUsagePropertyBreakdown = {
  propertyId: string;
  todayCallCount: number;
  todayCostUsd: number;
  monthCallCount: number;
  monthCostUsd: number;
};

export type AiPlatformUsageSummaryDto = {
  todayCallCount: number;
  monthCallCount: number;
  todayCostUsd: number;
  monthCostUsd: number;
  /** Derived from cost via the platform credit_unit_usd. */
  todayCreditsConsumed: number;
  monthCreditsConsumed: number;
  dailyCallLimit: number;
  monthlyCallLimit: number;
  dailyCostUsdLimit: number;
  dailyCreditLimit: number;
  monthlyCreditLimit: number;
  /** Purchased top-up balance, drawn down once monthlyCreditLimit is exceeded. */
  walletBalanceCredits: number;
  dailyRemaining: number;
  monthlyRemaining: number;
  dailyCostRemaining: number;
  planTier: string;
  quotaExceeded: boolean;
  featureBreakdown: AiPlatformUsageFeatureBreakdown[];
  propertyBreakdown: AiPlatformUsagePropertyBreakdown[];
};

const settingsKey = (orgSlug: string | null, orgId: string | null) =>
  ['org', orgSlug ?? orgId, 'ai-platform-settings'] as const;
const usageKey = (orgSlug: string | null, orgId: string | null) =>
  ['org', orgSlug ?? orgId, 'ai-platform-usage'] as const;

async function getAdminJwt(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('No active session. Please sign in');
  return token;
}

async function fetchOrgAi<T>(url: string, init?: RequestInit): Promise<T> {
  const jwt = await getAdminJwt();
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  const json = (await res.json()) as { success?: boolean; error?: string; data?: T };
  if (!res.ok || !json.success) {
    throw new Error(json.error ?? 'Request failed');
  }
  return json.data as T;
}

export function useAiPlatformSettings() {
  const { orgSlug, orgId } = useOrgScopeKey();
  return useQuery({
    queryKey: settingsKey(orgSlug, orgId),
    enabled: Boolean(orgSlug || orgId),
    queryFn: () =>
      fetchOrgAi<AiPlatformOrgSettingsDto>(
        scopedOrgFunctionsUrl('ai-platform-settings', orgSlug, orgId)
      ),
  });
}

export function useUpdateAiPlatformSettings() {
  const { orgSlug, orgId } = useOrgScopeKey();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: { enabled: boolean }) =>
      fetchOrgAi<AiPlatformOrgSettingsDto>(
        scopedOrgFunctionsUrl('ai-platform-settings', orgSlug, orgId),
        {
          method: 'PATCH',
          body: JSON.stringify(patch),
        }
      ),
    onSuccess: (data) => {
      qc.setQueryData(settingsKey(orgSlug, orgId), data);
      qc.invalidateQueries({ queryKey: usageKey(orgSlug, orgId) });
      // Org master syncs every property.enabled — refresh property AI caches.
      qc.invalidateQueries({ queryKey: ['property'], exact: false });
      // The assistant swaps its composer for a turn-on card while org AI is off.
      qc.invalidateQueries({
        queryKey: ['org', orgSlug ?? orgId, 'ai-dashboard-assistant-settings'],
      });
      qc.invalidateQueries({
        queryKey: ['org', orgSlug ?? orgId, 'ai-dashboard-assistant-access'],
      });
    },
  });
}

export function useAiPlatformUsage() {
  const { orgSlug, orgId } = useOrgScopeKey();
  return useQuery({
    queryKey: usageKey(orgSlug, orgId),
    enabled: Boolean(orgSlug || orgId),
    queryFn: () =>
      fetchOrgAi<AiPlatformUsageSummaryDto>(
        scopedOrgFunctionsUrl('ai-platform-usage', orgSlug, orgId)
      ),
    staleTime: 30_000,
  });
}
