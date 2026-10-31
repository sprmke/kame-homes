import { describe, expect, it } from 'vitest';

import {
  canInviteTeamMember,
  DEFAULT_PLAN_FEATURES,
  isFeatureEnabled,
  type PlanFeatureKey,
} from '@/features/dashboard/plans/lib/planFeatures';
import {
  GOLDEN_ALL_PLANS,
  GOLDEN_BUSINESS,
  GOLDEN_FREE,
  GOLDEN_MANAGED,
  GOLDEN_MINIMUM_TIER,
  GOLDEN_PRO,
  GOLDEN_RETIRED_PLANS,
  GOLDEN_SOLD_PLANS,
  GOLDEN_STARTER,
} from '@/features/dashboard/plans/lib/planTierGolden';

const FEATURE_KEYS = Object.keys(DEFAULT_PLAN_FEATURES) as PlanFeatureKey[];

describe('golden catalog shape', () => {
  it.each(GOLDEN_ALL_PLANS.map((p) => [p.code, p] as const))(
    '%s carries exactly the PlanFeatures keys',
    (_code, plan) => {
      expect(Object.keys(plan.features).sort()).toEqual([...FEATURE_KEYS].sort());
    }
  );

  it('sold tiers are Free, Starter, Pro (growth), Business (pro), Managed in order', () => {
    expect(GOLDEN_SOLD_PLANS.map((p) => p.code)).toEqual([
      'free',
      'starter',
      'growth',
      'pro',
      'managed',
    ]);
    expect(GOLDEN_SOLD_PLANS.map((p) => p.displayName)).toEqual([
      'Free',
      'Starter',
      'Pro',
      'Business',
      'Managed',
    ]);
  });

  it('sort order is strictly ascending across sold tiers and only Free is default', () => {
    const orders = GOLDEN_SOLD_PLANS.map((p) => p.sortOrder);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
    expect(new Set(orders).size).toBe(orders.length);
    expect(GOLDEN_SOLD_PLANS.filter((p) => p.isDefault).map((p) => p.code)).toEqual(['free']);
  });

  it('retired tiers are inactive and never sold', () => {
    for (const plan of GOLDEN_RETIRED_PLANS) expect(plan.isActive).toBe(false);
    for (const plan of GOLDEN_SOLD_PLANS) expect(plan.isActive).toBe(true);
  });

  it('list prices and 20% promo match the pricing ladder', () => {
    expect(GOLDEN_SOLD_PLANS.map((p) => p.pricePhp)).toEqual([0, 499, 999, 1799, 4999]);
    expect(GOLDEN_SOLD_PLANS.map((p) => p.discountPercent)).toEqual([0, 20, 20, 20, 20]);
  });
});

describe('tier ladder is cumulative', () => {
  const ladder = GOLDEN_SOLD_PLANS;

  it.each(ladder.slice(1).map((plan, i) => [ladder[i].code, plan.code, ladder[i], plan] as const))(
    '%s -> %s never loses a feature',
    (_from, _to, lower, higher) => {
      for (const key of FEATURE_KEYS) {
        if (isFeatureEnabled(lower.features, key)) {
          expect(isFeatureEnabled(higher.features, key), `${higher.code} lost ${key}`).toBe(true);
        }
      }
      expect(higher.features.aiMonthlyCreditAllowance).toBeGreaterThanOrEqual(
        lower.features.aiMonthlyCreditAllowance
      );
    }
  );

  it('numeric allowances only grow', () => {
    const teamMax = ladder.map((p) => p.features.teamManagement.maxMembers);
    expect(teamMax).toEqual([1, 3, 5, 10, null]);
    expect(ladder.map((p) => p.features.aiMonthlyCreditAllowance)).toEqual([
      0, 0, 5000, 25000, 60000,
    ]);
    expect(ladder.map((p) => p.features.searchVisibilityTier)).toEqual([
      'none',
      'none',
      'top30',
      'top15',
      'top15',
    ]);
    expect(ladder.map((p) => p.features.marketingPublishLimitPerGroup)).toEqual([
      0,
      0,
      0,
      null,
      null,
    ]);
  });
});

describe('minimum tier per feature', () => {
  it.each(FEATURE_KEYS)('%s unlocks at the documented tier and never below it', (key) => {
    const minCode = GOLDEN_MINIMUM_TIER[key];
    const minIndex = GOLDEN_SOLD_PLANS.findIndex((p) => p.code === minCode);
    expect(minIndex, `${key} has an unknown minimum tier`).toBeGreaterThanOrEqual(0);
    GOLDEN_SOLD_PLANS.forEach((plan, index) => {
      expect(isFeatureEnabled(plan.features, key), `${key} on ${plan.code} (min ${minCode})`).toBe(
        index >= minIndex
      );
    });
  });

  it('covers every feature key exactly once', () => {
    expect(Object.keys(GOLDEN_MINIMUM_TIER).sort()).toEqual([...FEATURE_KEYS].sort());
  });
});

describe('per-tier boundaries', () => {
  it('team invites stop at each tier cap', () => {
    const cases = [
      [GOLDEN_FREE, 1],
      [GOLDEN_STARTER, 3],
      [GOLDEN_PRO, 5],
      [GOLDEN_BUSINESS, 10],
    ] as const;
    for (const [plan, cap] of cases) {
      expect(canInviteTeamMember(plan.features, cap - 1), `${plan.code} below cap`).toBe(true);
      expect(canInviteTeamMember(plan.features, cap), `${plan.code} at cap`).toBe(false);
    }
  });

  it('Managed has unlimited seats', () => {
    expect(canInviteTeamMember(GOLDEN_MANAGED.features, 10_000)).toBe(true);
  });

  it('only Managed is fully managed by the platform', () => {
    expect(
      GOLDEN_SOLD_PLANS.filter((p) => p.features.fullyManagedByPlatform).map((p) => p.code)
    ).toEqual(['managed']);
  });

  it('Free keeps public pages open but not the paid editor', () => {
    expect(GOLDEN_FREE.features.customPages).toBe(true);
    expect(GOLDEN_FREE.features.publicPagesAutosave).toBe(false);
    expect(GOLDEN_FREE.features.propertyShowcase).toBe(false);
  });

  it('image generation unlocks a tier before video and text generation', () => {
    expect(GOLDEN_PRO.features.aiMarketingImageGeneration).toBe(true);
    expect(GOLDEN_PRO.features.aiMarketingVideoGeneration).toBe(false);
    expect(GOLDEN_PRO.features.aiMarketingGeneration).toBe(false);
    expect(GOLDEN_BUSINESS.features.aiMarketingVideoGeneration).toBe(true);
  });
});
