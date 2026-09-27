import { describe, expect, it } from 'vitest';

import { deriveOrgEntitlementsFromPlan } from '@/features/dashboard/plans/lib/orgEntitlements';
import type { OrgPlanResponse } from '@/features/dashboard/plans/lib/orgPlanApi';
import {
  GOLDEN_SOLD_PLANS,
  goldenPlanId,
  goldenSoldPlanDtos,
} from '@/features/dashboard/plans/lib/planTierGolden';

function response(subscriptionCode: string | null, plans = goldenSoldPlanDtos()): OrgPlanResponse {
  return {
    plans,
    properties: [],
    subscription: subscriptionCode
      ? {
          id: 'sub-1',
          planId: goldenPlanId(subscriptionCode),
          planCode: subscriptionCode,
          planName: subscriptionCode,
          pricingModel: 'subscription',
          status: 'active',
          pricePhpSnapshot: null,
          currentPeriodStart: null,
          currentPeriodEnd: null,
        }
      : null,
    assignedPropertyIds: [],
    pendingCheckoutUrl: null,
    pendingCheckoutPlanId: null,
    transactions: [],
  };
}

describe('deriveOrgEntitlementsFromPlan', () => {
  it.each(GOLDEN_SOLD_PLANS.map((p) => [p.code, p] as const))(
    'an org subscribed to %s gets that tier',
    (code, plan) => {
      expect(deriveOrgEntitlementsFromPlan(response(code))).toEqual(plan.features);
    }
  );

  it('no subscription means Free', () => {
    expect(deriveOrgEntitlementsFromPlan(response(null))).toEqual(GOLDEN_SOLD_PLANS[0].features);
  });

  it('a subscription to a plan missing from the catalog falls back to Free', () => {
    expect(deriveOrgEntitlementsFromPlan(response('gone'))).toEqual(GOLDEN_SOLD_PLANS[0].features);
  });

  it('is undefined while loading or with an empty catalog', () => {
    expect(deriveOrgEntitlementsFromPlan(undefined)).toBeUndefined();
    expect(deriveOrgEntitlementsFromPlan(response(null, []))).toBeUndefined();
  });
});
