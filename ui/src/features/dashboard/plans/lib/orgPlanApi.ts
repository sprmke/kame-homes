import type { PlanFeatures } from '@/features/dashboard/plans/lib/planFeatures';
import type { VolumeDiscountTier } from '@/features/dashboard/plans/lib/planPricing';

import { supabase } from '@/lib/supabase/client';

function supabaseBaseUrl(): string {
  return (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, '');
}

export type OrgBundlePlanDto = {
  id: string;
  code: string;
  name: string;
  tagline: string | null;
  sortOrder: number;
  pricingModel: string;
  pricePhp: number | null;
  discountPercent: number;
  volumeDiscountTiers: VolumeDiscountTier[];
  volumeRampFloorPhp: number;
  volumeRampAtCount: number;
  features: PlanFeatures;
  isDefault: boolean;
};

export type OrgPropertyDto = {
  id: string;
  name: string;
  slug: string;
  status: string;
};

export type OrgSubscriptionDto = {
  id: string;
  planId: string;
  planCode: string;
  planName: string;
  pricingModel: string;
  status: string;
  pricePhpSnapshot: number | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  gracePeriodEndsAt?: string | null;
};

export type OrgPaymentTransactionDto = {
  id: string;
  planId: string;
  amount: number;
  currency: string;
  status: string;
  checkoutUrl: string | null;
  paymentMethodType: string | null;
  createdAt: string;
  paidAt: string | null;
};

export type OrgPlanResponse = {
  plans: OrgBundlePlanDto[];
  properties: OrgPropertyDto[];
  subscription: OrgSubscriptionDto | null;
  assignedPropertyIds: string[];
  pendingCheckoutUrl: string | null;
  pendingCheckoutPlanId: string | null;
  transactions: OrgPaymentTransactionDto[];
};

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not signed in');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export async function fetchOrgPlan(orgId: string): Promise<OrgPlanResponse> {
  const res = await fetch(`${supabaseBaseUrl()}/org-plan?orgId=${encodeURIComponent(orgId)}`, {
    headers: await authHeaders(),
  });
  const json = (await res.json()) as {
    success?: boolean;
    error?: string;
    data?: OrgPlanResponse;
  };
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error ?? 'Failed to load org plan');
  }
  return json.data;
}

/** Covers first purchase, renewal, and mid-cycle changes (property count and/or tier) — the
 * server auto-detects which based on whether the org already has a live subscription and
 * whether the plan or org property count actually changed, prorating when it's a genuine change.
 * Billing always includes every property in the organization. */
export async function createOrgPlanCheckout(
  organizationId: string,
  planId: string
): Promise<{ checkoutUrl: string; transactionId: string }> {
  const res = await fetch(`${supabaseBaseUrl()}/create-org-subscription-checkout`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ organizationId, planId }),
  });
  const json = (await res.json()) as {
    success?: boolean;
    error?: string;
    data?: { checkoutUrl: string; transactionId: string };
  };
  if (!res.ok || !json.success || !json.data?.checkoutUrl) {
    throw new Error(json.error ?? 'Could not start checkout');
  }
  return json.data;
}

/** Self-serve downgrade (paid→lower paid or paid→Free) — applies immediately, no PayMongo. */
export async function applyOrgPlanDowngrade(
  organizationId: string,
  planId: string
): Promise<{ orgSubscriptionId: string | null; toFree: boolean }> {
  const res = await fetch(`${supabaseBaseUrl()}/apply-org-plan-downgrade`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ organizationId, planId }),
  });
  const json = (await res.json()) as {
    success?: boolean;
    error?: string;
    data?: { orgSubscriptionId: string | null; toFree: boolean };
  };
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error ?? 'Could not change plan');
  }
  return json.data;
}
