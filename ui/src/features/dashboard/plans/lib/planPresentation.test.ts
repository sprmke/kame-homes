import { describe, expect, it } from 'vitest';

import type { OrgBundlePlanDto } from '@/features/dashboard/plans/lib/orgPlanApi';
import type { PlanFeatures } from '@/features/dashboard/plans/lib/planFeatures';
import {
  isPlanDowngrade,
  MANAGED_PLAN_CODE,
  resolveDowngradeBlockedReason,
} from '@/features/dashboard/plans/lib/planPresentation';

const emptyFeatures = {} as PlanFeatures;

function plan(
  overrides: Partial<OrgBundlePlanDto> & Pick<OrgBundlePlanDto, 'id' | 'code' | 'sortOrder'>
): OrgBundlePlanDto {
  return {
    name: overrides.code,
    tagline: null,
    pricingModel: 'subscription',
    pricePhp: 0,
    discountPercent: 0,
    volumeDiscountTiers: [],
    volumeRampFloorPhp: 0,
    volumeRampAtCount: 10,
    features: emptyFeatures,
    isDefault: false,
    ...overrides,
  };
}

describe('isPlanDowngrade', () => {
  const pro = plan({ id: 'pro', code: 'pro', sortOrder: 30, pricePhp: 1439 });
  const starter = plan({ id: 'starter', code: 'starter', sortOrder: 10, pricePhp: 399 });
  const free = plan({ id: 'free', code: 'free', sortOrder: 0, isDefault: true });

  it('detects paid to lower paid', () => {
    expect(isPlanDowngrade(pro, starter)).toBe(true);
  });

  it('detects paid to Free', () => {
    expect(isPlanDowngrade(pro, free)).toBe(true);
  });

  it('rejects upgrades', () => {
    expect(isPlanDowngrade(starter, pro)).toBe(false);
  });
});

describe('resolveDowngradeBlockedReason', () => {
  const starter = plan({ id: 'starter', code: 'starter', sortOrder: 10 });
  const free = plan({ id: 'free', code: 'free', sortOrder: 0, isDefault: true });

  it('blocks past_due', () => {
    expect(
      resolveDowngradeBlockedReason({
        subscriptionStatus: 'past_due',
        currentPlanCode: 'pro',
        targetPlan: starter,
      })
    ).toMatch(/overdue/i);
  });

  it('blocks suspended to paid tier', () => {
    expect(
      resolveDowngradeBlockedReason({
        subscriptionStatus: 'suspended',
        currentPlanCode: 'pro',
        targetPlan: starter,
      })
    ).toMatch(/restore access/i);
  });

  it('allows suspended to Free', () => {
    expect(
      resolveDowngradeBlockedReason({
        subscriptionStatus: 'suspended',
        currentPlanCode: 'pro',
        targetPlan: free,
      })
    ).toBeNull();
  });

  it('blocks Managed current plan', () => {
    expect(
      resolveDowngradeBlockedReason({
        subscriptionStatus: 'active',
        currentPlanCode: MANAGED_PLAN_CODE,
        targetPlan: starter,
      })
    ).toMatch(/Managed/i);
  });

  it('detects upgrade as not downgrade', () => {
    const pro = plan({ id: 'pro', code: 'pro', sortOrder: 30, pricePhp: 1439 });
    expect(isPlanDowngrade(starter, pro)).toBe(false);
  });
});
