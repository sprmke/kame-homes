import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';
import type {
  AiLimitKey,
  AiLimitValues,
  ResolvedAiLimits,
} from '@/features/dashboard/super-admin/lib/aiLimits';

const FN = 'super-admin-ai-limits';
const ROOT_KEY = ['super-admin', 'ai-limits'] as const;

export type AiLimitProfile = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  updatedAt: string | null;
  limits: AiLimitValues;
};

export type AiLimitProfileUsage = {
  organizationAssignments: number;
  propertyAssignments: number;
  developmentAssignments: number;
  plans: Array<{ id: string; code: string; name: string }>;
  affectedOrganizations: number;
  spend30dUsd: number;
};

export type AiLimitsProfilesOverview = {
  profiles: Array<AiLimitProfile & { usage: AiLimitProfileUsage }>;
  developments: Array<{
    id: string;
    name: string;
    propertyCount: number;
    profileId: string | null;
    profileCode: string | null;
  }>;
  plans: Array<{
    id: string;
    code: string;
    name: string;
    profileId: string | null;
    profileCode: string | null;
  }>;
};

export type AiLimitsMatrixRow = {
  organizationId: string;
  name: string;
  slug: string;
  planTier: string;
  aiEnabled: boolean;
  orgProfileCode: string | null;
  planProfileCode: string | null;
  hasOverrides: boolean;
  overrideReason: string | null;
  limits: ResolvedAiLimits;
  usage: {
    todayCalls: number;
    todayCostUsd: number;
    monthCalls: number;
    monthCostUsd: number;
    monthCredits: number;
  };
  breach: boolean;
};

export type AiLimitsMatrix = {
  rows: AiLimitsMatrixRow[];
  total: number;
  truncated: boolean;
  planTiers: string[];
};

export type AiLimitsMatrixFilters = {
  search: string;
  planTier: string;
  profileCode: string;
  status: 'all' | 'breach' | 'overridden' | 'disabled';
  limit: number;
  offset: number;
};

export type AiLimitsOrgDetail = {
  organization: { id: string; name: string; slug: string };
  resolved: {
    limits: ResolvedAiLimits;
    planTier: string;
    orgProfileCode: string | null;
    planProfileCode: string | null;
    hasOverrides: boolean;
    overrideReason: string | null;
  } | null;
  assignment: { profileId: string; profileCode: string | null } | null;
  properties: Array<{
    propertyId: string;
    name: string;
    slug: string;
    residenceName: string | null;
    propertyProfileCode: string | null;
    developmentProfileCode: string | null;
    limits: ResolvedAiLimits;
    usage: { monthCalls: number; monthCostUsd: number };
  }>;
  dailySeries: Array<{ date: string; calls: number; costUsd: number }>;
  profiles: Array<{ id: string; code: string; name: string }>;
};

export function useAiLimitsMatrix(filters: AiLimitsMatrixFilters) {
  return useQuery({
    queryKey: [...ROOT_KEY, 'matrix', filters] as const,
    queryFn: () => {
      const params = new URLSearchParams({ view: 'matrix' });
      for (const [key, value] of Object.entries(filters)) {
        if (value !== '' && value !== 'all') params.set(key, String(value));
      }
      return callEdgeFunction<AiLimitsMatrix>(`${FN}?${params.toString()}`);
    },
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export function useAiLimitsProfiles() {
  return useQuery({
    queryKey: [...ROOT_KEY, 'profiles'] as const,
    queryFn: () => callEdgeFunction<AiLimitsProfilesOverview>(`${FN}?view=profiles`),
    staleTime: 15_000,
  });
}

export function useAiLimitsOrgDetail(orgId: string | null) {
  return useQuery({
    queryKey: [...ROOT_KEY, 'org', orgId] as const,
    enabled: Boolean(orgId),
    queryFn: () =>
      callEdgeFunction<AiLimitsOrgDetail>(`${FN}?view=org&orgId=${encodeURIComponent(orgId!)}`),
  });
}

type ProfileInput = {
  code?: string;
  name?: string;
  description?: string | null;
  limits?: Partial<AiLimitValues>;
};

export type AiLimitsAction =
  | ({ action: 'create_profile' } & ProfileInput)
  | ({ action: 'update_profile'; profileId: string } & ProfileInput)
  | { action: 'delete_profile'; profileId: string }
  | {
      action: 'assign';
      scope: 'organization' | 'property' | 'development';
      scopeIds: string[];
      profileId: string | null;
      note?: string | null;
    }
  | {
      action: 'set_overrides';
      scope: 'organization' | 'property';
      scopeIds: string[];
      limits: Partial<Record<AiLimitKey, number | null>>;
      reason?: string | null;
    }
  | { action: 'set_plan_profile'; planId: string; profileId: string | null };

/** One mutation for every write; invalidates the whole console (and usage, which shows limits). */
export function useAiLimitsAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AiLimitsAction) =>
      callEdgeFunction<unknown>(FN, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ROOT_KEY });
      void qc.invalidateQueries({ queryKey: ['super-admin', 'ai-usage'] });
    },
  });
}
