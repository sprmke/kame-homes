import { describe, expect, it } from 'vitest';

import {
  computeOrgSubscriptionTotalPhp,
  discountedPlanPricePhp,
  normalizeVolumeDiscountTiers,
  resolveVolumeDiscountPercent,
} from '@/features/dashboard/plans/lib/planPricing';
import { GOLDEN_SOLD_PLANS } from '@/features/dashboard/plans/lib/planTierGolden';

const byCode = (code: string) => GOLDEN_SOLD_PLANS.find((p) => p.code === code)!;

/** Promo per-property rate, then org total for N enrolled properties (hand-computed). */
function total(code: string, count: number): number {
  const plan = byCode(code);
  const rate = discountedPlanPricePhp(plan.pricePhp, plan.discountPercent);
  return computeOrgSubscriptionTotalPhp(rate, plan.volumeDiscountTiers, count);
}

describe('promo per-property rate', () => {
  it.each([
    ['free', 0],
    ['starter', 399],
    ['growth', 799],
    ['pro', 1439],
    ['managed', 3999],
  ])('%s is %i after the 20 percent promo (whole pesos, rounded down)', (code, rate) => {
    const plan = byCode(code);
    expect(discountedPlanPricePhp(plan.pricePhp, plan.discountPercent)).toBe(rate);
  });
});

describe('org subscription total by property count', () => {
  const CASES: Record<string, Record<number, number>> = {
    free: { 1: 0, 10: 0, 300: 0 },
    // Starter promo rate is under the 500 ramp floor: flat rate, volume tiers from 20.
    starter: { 1: 399, 9: 3591, 10: 3990, 20: 7341, 50: 15960, 100: 25935, 200: 39900, 300: 47880 },
    // Pro: linear ramp to 500 at 10 properties, then volume tiers.
    growth: { 1: 799, 5: 3330, 10: 5000, 11: 5537, 20: 8789, 50: 15181, 100: 17578, 300: 28764 },
    pro: { 1: 1439, 10: 5000, 20: 8634, 50: 15829, 100: 21585, 300: 30219 },
    managed: { 1: 3999, 10: 5000, 20: 8797, 50: 15996, 100: 23994, 300: 35991 },
  };

  for (const [code, rows] of Object.entries(CASES)) {
    it.each(Object.entries(rows).map(([count, expected]) => [Number(count), expected] as const))(
      `${code} with %i properties costs %i`,
      (count, expected) => {
        expect(total(code, count)).toBe(expected);
      }
    );
  }

  /**
   * Property counts where adding ONE more property makes the org total go DOWN. This is how the
   * seeded volume curves and the 1 to 10 ramp interact today. Pinned so a curve change is a
   * deliberate decision. Flagged for product review: a 19th to 20th property saves money.
   */
  const KNOWN_TOTAL_DROPS: Record<string, number[]> = {
    free: [],
    starter: [20, 50, 100, 200, 300],
    growth: [20, 50, 100, 200, 300],
    pro: [8, 9, 10, 20, 50, 100, 200, 300],
    managed: [7, 8, 9, 10, 20, 50, 100, 200, 300],
  };

  it.each(Object.entries(KNOWN_TOTAL_DROPS))(
    '%s total only drops at the pinned counts',
    (code, drops) => {
      const found: number[] = [];
      for (let count = 2; count <= 320; count += 1) {
        if (total(code, count) < total(code, count - 1)) found.push(count);
      }
      expect(found).toEqual(drops);
    }
  );

  it('per-property cost falls (or holds) as the count grows past the ramp on paid tiers', () => {
    for (const plan of GOLDEN_SOLD_PLANS.filter((p) => p.pricePhp > 0)) {
      let previous = Number.POSITIVE_INFINITY;
      for (const count of [1, 10, 20, 50, 100, 200, 300]) {
        const perProperty = total(plan.code, count) / count;
        expect(perProperty, `${plan.code} ${count}`).toBeLessThanOrEqual(previous);
        previous = perProperty;
      }
    }
  });

  it('zero properties or a Free rate costs nothing', () => {
    for (const plan of GOLDEN_SOLD_PLANS) expect(total(plan.code, 0)).toBe(0);
    expect(total('free', 50)).toBe(0);
  });
});

describe('volume curves match the seeded ladder', () => {
  it.each(GOLDEN_SOLD_PLANS.filter((p) => p.pricePhp > 0).map((p) => [p.code, p] as const))(
    '%s curve is normalised, ascending, and steps up at 10/20/50/100/200/300',
    (_code, plan) => {
      expect(normalizeVolumeDiscountTiers(plan.volumeDiscountTiers)).toEqual(
        plan.volumeDiscountTiers
      );
      expect(plan.volumeDiscountTiers.map((t) => t.minProperties)).toEqual([
        10, 20, 50, 100, 200, 300,
      ]);
      const percents = plan.volumeDiscountTiers.map((t) => t.discountPercent);
      expect([...percents].sort((a, b) => a - b)).toEqual(percents);
    }
  );

  it('higher tiers discount harder at every breakpoint', () => {
    const order = ['starter', 'growth', 'pro', 'managed'].map(byCode);
    for (let i = 1; i < order.length; i += 1) {
      order[i].volumeDiscountTiers.forEach((tier, j) => {
        expect(tier.discountPercent).toBeGreaterThanOrEqual(
          order[i - 1].volumeDiscountTiers[j].discountPercent
        );
      });
    }
  });

  it('resolves the highest breakpoint not above the count', () => {
    const tiers = byCode('growth').volumeDiscountTiers;
    expect(resolveVolumeDiscountPercent(tiers, 9)).toBe(0);
    expect(resolveVolumeDiscountPercent(tiers, 10)).toBe(37);
    expect(resolveVolumeDiscountPercent(tiers, 49)).toBe(45);
    expect(resolveVolumeDiscountPercent(tiers, 50)).toBe(62);
    expect(resolveVolumeDiscountPercent(tiers, 5000)).toBe(88);
  });
});
