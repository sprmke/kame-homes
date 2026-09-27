import { describe, expect, it } from 'vitest';

import {
  buildPlanTiers,
  MANAGED_PLAN_CODE,
  planDisplayName,
  planFeatureGains,
  planFeatureLosses,
  planFeatureMatrixGroups,
  planPrice,
  planPromoBadge,
  planTierPitch,
} from '@/features/dashboard/plans/lib/planPresentation';
import {
  computeOrgSubscriptionTotalPhp,
  discountedPlanPricePhp,
} from '@/features/dashboard/plans/lib/planPricing';
import {
  CARD_BULLET_COMPARE_LABEL,
  CARD_EXPECTATIONS,
  COMPARE_EXPECTATIONS,
  compareTargetForBullet,
  ONE_PROPERTY_MONTHLY_TOTAL,
  REMOVES,
  TIER_ORDER,
  TIER_TITLES,
  UNLOCKS,
} from '@/features/dashboard/plans/lib/planTierExpectations';
import {
  GOLDEN_MINIMUM_TIER,
  goldenSoldPlanDtos,
} from '@/features/dashboard/plans/lib/planTierGolden';

const plans = goldenSoldPlanDtos();
const strip = (value: string) => value.replace(/\s/g, '');

describe('COMPARE_EXPECTATIONS is exactly what the app renders', () => {
  const groups = planFeatureMatrixGroups(plans);

  it('same groups in the same order', () => {
    expect(groups.map((g) => g.label)).toEqual(COMPARE_EXPECTATIONS.map((g) => g.label));
  });

  it.each(COMPARE_EXPECTATIONS.map((g, i) => [g.label, i] as const))(
    'group %s rows and cells',
    (_l, i) => {
      const rendered = groups[i].rows.map((row) => ({
        label: row.label,
        cells: plans.map((plan) => {
          if ('baseline' in row) return 'on';
          if ('managedOnly' in row) return plan.code === MANAGED_PLAN_CODE ? 'on' : 'off';
          if ('minSortOrder' in row) return plan.sortOrder >= row.minSortOrder ? 'on' : 'off';
          const value = row.value(plan.features);
          return value.kind === 'text' ? value.text : value.kind;
        }),
      }));
      expect(rendered).toEqual(COMPARE_EXPECTATIONS[i].rows);
    }
  );

  it('every row has one cell per tier and no duplicate labels', () => {
    const labels = COMPARE_EXPECTATIONS.flatMap((g) => g.rows.map((r) => r.label));
    expect(new Set(labels).size).toBe(labels.length);
    for (const row of COMPARE_EXPECTATIONS.flatMap((g) => g.rows)) {
      expect(row.cells).toHaveLength(TIER_ORDER.length);
    }
  });

  it('a capability is never "on" for a tier and "off" for a higher one', () => {
    for (const row of COMPARE_EXPECTATIONS.flatMap((g) => g.rows)) {
      const firstOn = row.cells.findIndex((c) => c !== 'off');
      if (firstOn < 0) continue;
      expect(
        row.cells.slice(firstOn).every((c) => c !== 'off'),
        row.label
      ).toBe(true);
    }
  });
});

describe('CARD_EXPECTATIONS is exactly what the cards render', () => {
  const tiers = buildPlanTiers(plans, undefined);

  it.each(TIER_ORDER.map((code) => [code] as const))('%s card', (code) => {
    const tier = tiers.find((t) => t.plan.code === code)!;
    const price = planPrice(tier.plan);
    expect({
      title: planDisplayName(tier.plan),
      price: strip(price.amount),
      compareAt: price.compareAtAmount ? strip(price.compareAtAmount) : null,
      badge: planPromoBadge(code),
      inherits: tier.inheritsFrom,
      pitch: planTierPitch(tier.plan),
      bullets: tier.gains.map((g) => g.label),
    }).toEqual(CARD_EXPECTATIONS[code]);
    expect(TIER_TITLES[code]).toBe(CARD_EXPECTATIONS[code].title);
  });
});

describe('every card bullet is backed by a Compare row that agrees for that tier', () => {
  const rows = new Map(COMPARE_EXPECTATIONS.flatMap((g) => g.rows).map((r) => [r.label, r]));

  for (const [tierIndex, code] of TIER_ORDER.entries()) {
    for (const bullet of CARD_EXPECTATIONS[code].bullets) {
      it(`${code}: ${bullet.slice(0, 70)}`, () => {
        const target = compareTargetForBullet(bullet, tierIndex);
        if (target === null) {
          expect(
            CARD_BULLET_COMPARE_LABEL[bullet],
            'documented as having no Compare row'
          ).toBeNull();
          return;
        }
        const row = rows.get(target.rowLabel);
        expect(row, `Compare has no row "${target.rowLabel}"`).toBeDefined();
        expect(
          target.expected(row!.cells[tierIndex]),
          `${target.rowLabel} for ${code}: ${row!.cells[tierIndex]}`
        ).toBe(true);
      });
    }
  }

  it('the only bullet without a Compare row is Standard template management', () => {
    const orphans = TIER_ORDER.flatMap((code) =>
      CARD_EXPECTATIONS[code].bullets.filter((b) => compareTargetForBullet(b, 0) === null)
    );
    expect(orphans).toEqual(['Standard template management']);
  });

  it('a Compare row that turns on for a tier is either on that tier card or on a lower one', () => {
    // Guards "Compare says Pro has X but no card ever mentions X".
    const known = new Set<string>();
    for (const [tierIndex, code] of TIER_ORDER.entries()) {
      for (const bullet of CARD_EXPECTATIONS[code].bullets) {
        const target = compareTargetForBullet(bullet, tierIndex);
        if (target) known.add(target.rowLabel);
      }
    }
    const baselineLabels = new Set(
      COMPARE_EXPECTATIONS.flatMap((g) => g.rows)
        .filter((r) => r.cells.every((c) => c === 'on'))
        .map((r) => r.label)
    );
    const uncovered = [...rows.keys()].filter(
      (label) => !known.has(label) && !baselineLabels.has(label)
    );
    expect(uncovered).toEqual([]);
  });
});

describe('expectations agree with the golden minimum tiers', () => {
  it('every boolean Compare row turns on at a tier that some golden feature justifies', () => {
    const minIndexes = new Set(
      Object.values(GOLDEN_MINIMUM_TIER).map((code) => TIER_ORDER.indexOf(code as never))
    );
    for (const row of COMPARE_EXPECTATIONS.flatMap((g) => g.rows)) {
      const firstOn = row.cells.findIndex((c) => c !== 'off');
      if (firstOn <= 0) continue;
      expect(minIndexes.has(firstOn), `${row.label} first on at ${TIER_ORDER[firstOn]}`).toBe(true);
    }
  });
});

describe('review dialog expectations match planFeatureGains / planFeatureLosses', () => {
  const byCode = (code: string) => plans.find((p) => p.code === code)!;

  it.each(Object.entries(UNLOCKS))('unlocks %s', (key, labels) => {
    const [from, to] = key.split('>');
    expect(
      planFeatureGains(byCode(from).features, byCode(to).features).map((g) => g.label)
    ).toEqual(labels);
  });

  it.each(Object.entries(REMOVES))('removes %s', (key, labels) => {
    const [from, to] = key.split('>');
    expect(
      planFeatureLosses(byCode(from).features, byCode(to).features).map((g) => g.label)
    ).toEqual(labels);
  });

  it('one-property totals match the pricing math', () => {
    for (const code of TIER_ORDER) {
      const plan = byCode(code);
      const rate = discountedPlanPricePhp(plan.pricePhp, plan.discountPercent);
      const total = computeOrgSubscriptionTotalPhp(rate, plan.volumeDiscountTiers, 1);
      expect(ONE_PROPERTY_MONTHLY_TOTAL[code].replace(/[^\d]/g, '')).toBe(String(total));
    }
  });
});
