import { describe, expect, it } from 'vitest';

import type { PlanFeatureKey } from '@/features/dashboard/plans/lib/planFeatures';
import {
  isManagedSalesPlan,
  nextUpgradePlan,
  planActionLabel,
  planSelectButtonVariant,
  RECOMMENDED_PLAN_CODE,
  resolveDefaultPlan,
  resolveEffectiveCurrentPlan,
  resolveGateBadgePlan,
  resolveMinimumPlanForFeature,
  resolveUpgradePlanForFeature,
  upgradeBannerActionLabel,
} from '@/features/dashboard/plans/lib/planPresentation';
import {
  GOLDEN_MINIMUM_TIER,
  goldenPlanId,
  goldenSoldPlanDtos,
} from '@/features/dashboard/plans/lib/planTierGolden';

const plans = goldenSoldPlanDtos();
const codes = plans.map((p) => p.code);
const KEYS = Object.keys(GOLDEN_MINIMUM_TIER) as PlanFeatureKey[];

describe('resolveMinimumPlanForFeature', () => {
  it.each(KEYS)('%s routes to its minimum tier', (key) => {
    expect(resolveMinimumPlanForFeature(plans, key)?.code).toBe(GOLDEN_MINIMUM_TIER[key]);
  });

  it('is null when no tier has the feature', () => {
    expect(resolveMinimumPlanForFeature(plans.slice(0, 1), 'smartPricing')).toBeNull();
  });
});

describe('resolveUpgradePlanForFeature', () => {
  it.each(KEYS)('%s: below minimum offers the minimum tier', (key) => {
    const minIdx = codes.indexOf(GOLDEN_MINIMUM_TIER[key]);
    for (let i = 0; i < minIdx; i += 1) {
      expect(resolveUpgradePlanForFeature(plans, key, plans[i].id)?.code).toBe(codes[minIdx]);
    }
  });

  it.each(KEYS)('%s: at or above minimum offers the next rung (or nothing at the top)', (key) => {
    const minIdx = codes.indexOf(GOLDEN_MINIMUM_TIER[key]);
    for (let i = minIdx; i < plans.length; i += 1) {
      expect(resolveUpgradePlanForFeature(plans, key, plans[i].id)?.code ?? null).toBe(
        codes[i + 1] ?? null
      );
    }
  });

  it('re-offers the current plan for an unenrolled property under a plan that has the feature', () => {
    expect(
      resolveUpgradePlanForFeature(plans, 'smartPricing', goldenPlanId('growth'), false)?.code
    ).toBe('growth');
  });

  it('no current plan offers the minimum tier', () => {
    expect(resolveUpgradePlanForFeature(plans, 'aiReceptionist', undefined)?.code).toBe('pro');
  });

  it('Free team-seat cap sends Free to Starter, not another Free review', () => {
    expect(resolveUpgradePlanForFeature(plans, 'teamManagement', goldenPlanId('free'))?.code).toBe(
      'starter'
    );
  });
});

describe('resolveGateBadgePlan', () => {
  it.each(KEYS)('%s badge is the minimum tier when the current plan lacks it', (key) => {
    const minIdx = codes.indexOf(GOLDEN_MINIMUM_TIER[key]);
    for (let i = 0; i < minIdx; i += 1) {
      expect(resolveGateBadgePlan(plans, key, plans[i].id)?.code).toBe(codes[minIdx]);
    }
  });

  it('prefers the current tier when it already has the feature (unenrolled property)', () => {
    expect(resolveGateBadgePlan(plans, 'financeReporting', goldenPlanId('pro'))?.code).toBe('pro');
  });
});

describe('nextUpgradePlan / default plan / effective plan', () => {
  it('walks the ladder and stops at Managed', () => {
    expect(codes.map((_, i) => nextUpgradePlan(plans, plans[i].id)?.code ?? null)).toEqual([
      'starter',
      'growth',
      'pro',
      'managed',
      null,
    ]);
  });

  it('unknown current starts at the bottom of the ladder', () => {
    expect(nextUpgradePlan(plans, undefined)?.code).toBe('free');
  });

  it('Free is the default plan and the fallback when there is no subscription', () => {
    expect(resolveDefaultPlan(plans)?.code).toBe('free');
    expect(resolveEffectiveCurrentPlan(plans, null)?.code).toBe('free');
    expect(resolveEffectiveCurrentPlan(plans, 'plan-deleted')?.code).toBe('free');
    expect(resolveEffectiveCurrentPlan(plans, goldenPlanId('pro'))?.code).toBe('pro');
  });
});

describe('CTA labels', () => {
  it('banner button names the tier, Managed becomes Contact sales', () => {
    expect(plans.map(upgradeBannerActionLabel)).toEqual([
      'Upgrade to Free',
      'Upgrade to Starter',
      'Upgrade to Pro',
      'Upgrade to Business',
      'Contact sales',
    ]);
  });

  it('card action label by direction', () => {
    expect(planActionLabel('current', true)).toBe('Current plan');
    expect(planActionLabel('current', true, 'managed')).toBe('Current plan');
    expect(planActionLabel('upgrade', true, 'managed')).toBe('Contact sales');
    expect(planActionLabel('downgrade', true, 'managed')).toBe('Contact sales');
    expect(planActionLabel('upgrade', false, 'growth')).toBe('Choose plan');
    expect(planActionLabel('upgrade', true, 'growth')).toBe('Upgrade');
    expect(planActionLabel('downgrade', true, 'starter')).toBe('Downgrade');
  });

  it('button variants', () => {
    expect(planSelectButtonVariant(true, 'current')).toBe('outline');
    expect(planSelectButtonVariant(false, 'downgrade', 'starter')).toBe('outline');
    expect(planSelectButtonVariant(false, 'upgrade', 'managed')).toBe('outline-primary');
    expect(planSelectButtonVariant(false, 'upgrade', 'growth')).toBe('default');
  });

  it('Managed is the only sales-assisted tier and Business is the recommended one', () => {
    expect(plans.filter((p) => isManagedSalesPlan(p.code)).map((p) => p.code)).toEqual(['managed']);
    expect(RECOMMENDED_PLAN_CODE).toBe('pro');
  });
});
