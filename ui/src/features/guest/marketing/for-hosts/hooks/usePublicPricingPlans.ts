import { useQuery } from '@tanstack/react-query';

import type { OrgBundlePlanDto } from '@/features/dashboard/plans/lib/orgPlanApi';

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const PUBLIC_PRICING_PLANS_QUERY_KEY = ['public-pricing-plans'] as const;

async function fetchPublicPricingPlans(): Promise<OrgBundlePlanDto[]> {
  const res = await fetch(`${FUNCTIONS_URL}/list-public-pricing-plans`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  const json = (await res.json()) as {
    success?: boolean;
    error?: string;
    data?: { plans?: OrgBundlePlanDto[] };
  };
  if (!res.ok || !json.success || !json.data?.plans) {
    throw new Error(json.error ?? 'Could not load pricing plans');
  }
  return json.data.plans;
}

export function usePublicPricingPlans() {
  return useQuery({
    queryKey: PUBLIC_PRICING_PLANS_QUERY_KEY,
    queryFn: fetchPublicPricingPlans,
    staleTime: 60_000,
  });
}
