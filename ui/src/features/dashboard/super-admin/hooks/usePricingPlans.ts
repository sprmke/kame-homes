import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';
import type { PlanFeatures } from '@/features/dashboard/plans/lib/planFeatures';
import type { VolumeDiscountTier } from '@/features/dashboard/plans/lib/planPricing';
import type {
  OrgSubscriptionSummary,
  PricingPlan,
} from '@/features/dashboard/super-admin/types/pricingPlan';

import { ADMIN_DEFAULT_PAGE_SIZE } from '@/lib/table/pagination';

export const PRICING_PLANS_QUERY_KEY = ['super-admin', 'pricing-plans'] as const;
export const ORG_SUBSCRIPTIONS_QUERY_KEY = ['super-admin', 'org-subscriptions'] as const;

export type OrgSubscriptionsSummary = {
  total: number;
  assigned: number;
  unassigned: number;
  activeSubscriptions: number;
  properties: number;
};

export function usePricingPlans(
  search = '',
  status: 'all' | 'active' | 'inactive' = 'all',
  page = 1,
  limit: number = ADMIN_DEFAULT_PAGE_SIZE
) {
  const params = new URLSearchParams();
  if (search.trim()) params.set('search', search.trim());
  if (status !== 'all') params.set('status', status);
  params.set('page', String(page));
  params.set('limit', String(limit));

  const query = useQuery({
    queryKey: [...PRICING_PLANS_QUERY_KEY, search, status, page, limit],
    queryFn: () =>
      callEdgeFunction<{ plans: PricingPlan[]; total: number }>(
        `pricing-plans?${params.toString()}`
      ),
    placeholderData: keepPreviousData,
  });

  return {
    ...query,
    rows: query.data?.plans ?? [],
    total: query.data?.total ?? 0,
  };
}

export function useUpdatePricingPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      planId: string;
      name?: string;
      tagline?: string | null;
      sortOrder?: number;
      pricePhp?: number | null;
      discountPercent?: number;
      volumeDiscountTiers?: VolumeDiscountTier[];
      volumeRampFloorPhp?: number;
      volumeRampAtCount?: number;
      features?: PlanFeatures;
      isActive?: boolean;
    }) =>
      callEdgeFunction<{ plan: PricingPlan }>('pricing-plans', {
        method: 'PATCH',
        body: JSON.stringify(input),
      }).then((data) => data.plan),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: PRICING_PLANS_QUERY_KEY });
    },
  });
}

export function useOrgSubscriptionsAdmin(
  search: string,
  planCode: string,
  page = 1,
  limit: number = ADMIN_DEFAULT_PAGE_SIZE
) {
  const params = new URLSearchParams();
  if (search.trim()) params.set('search', search.trim());
  if (planCode.trim() && planCode !== 'all') params.set('planCode', planCode.trim());
  params.set('page', String(page));
  params.set('limit', String(limit));
  const qs = params.toString();

  const query = useQuery({
    queryKey: [...ORG_SUBSCRIPTIONS_QUERY_KEY, search, planCode, page, limit],
    queryFn: () =>
      callEdgeFunction<{ organizations: OrgSubscriptionSummary[]; total: number }>(
        `org-subscriptions-admin?${qs}`
      ),
    placeholderData: keepPreviousData,
  });

  return {
    ...query,
    rows: query.data?.organizations ?? [],
    total: query.data?.total ?? 0,
  };
}

/** Platform-wide (unfiltered) aggregate counts for the summary cards. */
export function useOrgSubscriptionsSummary() {
  const query = useQuery({
    queryKey: [...ORG_SUBSCRIPTIONS_QUERY_KEY, 'summary'],
    queryFn: () =>
      callEdgeFunction<{ summary: OrgSubscriptionsSummary }>(
        'org-subscriptions-admin?summary=true'
      ).then((data) => data.summary),
  });

  return {
    ...query,
    summary: query.data ?? null,
  };
}

export function useAssignOrgPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      organizationId: string;
      planId: string;
      propertyIds?: string[];
      overridePricePhp?: number;
      note?: string;
    }) =>
      callEdgeFunction('org-subscriptions-admin', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ORG_SUBSCRIPTIONS_QUERY_KEY });
    },
  });
}

export type HostVerificationRewardGrant = {
  orgSubscriptionId: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string | null;
  status: string;
  planCode: string | null;
  planName: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
};

export const HOST_VERIFICATION_REWARD_GRANTS_QUERY_KEY = [
  'super-admin',
  'host-verification-reward-grants',
] as const;

export function useHostVerificationRewardGrants() {
  const query = useQuery({
    queryKey: HOST_VERIFICATION_REWARD_GRANTS_QUERY_KEY,
    queryFn: () =>
      callEdgeFunction<{ grants: HostVerificationRewardGrant[] }>(
        'org-subscriptions-admin?rewards=true'
      ).then((data) => data.grants),
  });

  return {
    ...query,
    grants: query.data ?? [],
  };
}

export function useRevokeHostVerificationReward() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { organizationId: string; orgSubscriptionId: string }) =>
      callEdgeFunction('org-subscriptions-admin', {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'revoke_reward',
          organizationId: input.organizationId,
          orgSubscriptionId: input.orgSubscriptionId,
        }),
      }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: HOST_VERIFICATION_REWARD_GRANTS_QUERY_KEY }),
        qc.invalidateQueries({ queryKey: ORG_SUBSCRIPTIONS_QUERY_KEY }),
      ]);
      toast.success('Reward revoked');
    },
    onError: (error: Error) => toast.error(error.message || 'Could not revoke reward'),
  });
}
