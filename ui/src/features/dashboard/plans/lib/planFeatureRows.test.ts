import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PLAN_FEATURES,
  type PlanFeatureKey,
} from '@/features/dashboard/plans/lib/planFeatures';
import {
  MANAGED_PLAN_CODE,
  PLAN_BASELINE_MATRIX_ROWS,
  PLAN_FEATURE_GROUP_LABELS,
  PLAN_FEATURE_GROUP_ORDER,
  PLAN_FEATURE_ROWS,
  PLAN_MANAGED_MATRIX_ROWS,
  PLAN_STARTER_MATRIX_ROWS,
  planFeatureMatrixGroups,
  type PlanFeatureValue,
} from '@/features/dashboard/plans/lib/planPresentation';
import {
  GOLDEN_SOLD_PLANS,
  goldenSoldPlanDtos,
} from '@/features/dashboard/plans/lib/planTierGolden';

/** Keys that intentionally have no Compare row. Every entry needs a reason. */
const MATRIX_EXEMPT: Partial<Record<PlanFeatureKey, string>> = {
  customPages:
    'Gallery + editor explore-open on every plan; only publicPagesAutosave and propertyShowcase are compared.',
  activityLogExport:
    'GAP: Starter+ but no Compare row or card bullet yet. See docs/workflow/in-progress/plan-tier-test-suite.md (E2).',
};

const EXPECTED: Record<string, Record<string, PlanFeatureValue>> = {
  automatedBookingFlow: { free: off(), starter: on(), growth: on(), pro: on(), managed: on() },
  bookingImport: { free: off(), starter: on(), growth: on(), pro: on(), managed: on() },
  aiValidations: { free: off(), starter: off(), growth: on(), pro: on(), managed: on() },
  copyPropertySettings: { free: off(), starter: off(), growth: on(), pro: on(), managed: on() },
  financeReporting: { free: off(), starter: on(), growth: on(), pro: on(), managed: on() },
  maintenanceReporting: { free: off(), starter: on(), growth: on(), pro: on(), managed: on() },
  calendarSync: { free: off(), starter: off(), growth: on(), pro: on(), managed: on() },
  smartPricing: { free: off(), starter: off(), growth: on(), pro: on(), managed: on() },
  analyticsInsights: { free: off(), starter: off(), growth: on(), pro: on(), managed: on() },
  teamManagement: {
    free: text('Up to 1'),
    starter: text('Up to 3'),
    growth: text('Up to 5'),
    pro: text('Up to 10'),
    managed: text('Unlimited'),
  },
  customRoles: { free: off(), starter: on(), growth: on(), pro: on(), managed: on() },
  marketingStudio: { free: off(), starter: off(), growth: on(), pro: on(), managed: on() },
  aiMarketingGeneration: { free: off(), starter: off(), growth: off(), pro: on(), managed: on() },
  aiMarketingImageGeneration: {
    free: off(),
    starter: off(),
    growth: on(),
    pro: on(),
    managed: on(),
  },
  aiMarketingVideoGeneration: {
    free: off(),
    starter: off(),
    growth: off(),
    pro: on(),
    managed: on(),
  },
  marketingPublishLimitPerGroup: {
    free: off(),
    starter: off(),
    growth: off(),
    pro: text('Unlimited'),
    managed: text('Unlimited'),
  },
  quickReplies: { free: off(), starter: on(), growth: on(), pro: on(), managed: on() },
  metaChatChannel: { free: off(), starter: off(), growth: off(), pro: on(), managed: on() },
  aiChatAutoReply: { free: off(), starter: off(), growth: off(), pro: on(), managed: on() },
  telegramNotifications: { free: off(), starter: on(), growth: on(), pro: on(), managed: on() },
  customTemplates: { free: off(), starter: on(), growth: on(), pro: on(), managed: on() },
  publicPagesAutosave: { free: off(), starter: off(), growth: on(), pro: on(), managed: on() },
  propertyShowcase: { free: off(), starter: off(), growth: on(), pro: on(), managed: on() },
  verifiedBadgeEligible: { free: off(), starter: on(), growth: on(), pro: on(), managed: on() },
  recommendedBadgeEligible: { free: off(), starter: off(), growth: on(), pro: on(), managed: on() },
  searchVisibilityTier: {
    free: off(),
    starter: off(),
    growth: text('Top 30'),
    pro: text('Top 15'),
    managed: text('Top 15'),
  },
  aiDashboardAssistant: { free: off(), starter: off(), growth: off(), pro: on(), managed: on() },
  aiReceptionist: { free: off(), starter: off(), growth: off(), pro: on(), managed: on() },
  aiMonthlyCreditAllowance: {
    free: off(),
    starter: off(),
    growth: text('5,000 / mo'),
    pro: text('25,000 / mo'),
    managed: text('60,000 / mo'),
  },
  fullyManagedByPlatform: { free: off(), starter: off(), growth: off(), pro: off(), managed: on() },
};

function on(): PlanFeatureValue {
  return { kind: 'on' };
}
function off(): PlanFeatureValue {
  return { kind: 'off' };
}
function text(value: string): PlanFeatureValue {
  return { kind: 'text', text: value };
}

describe('PLAN_FEATURE_ROWS coverage', () => {
  it('every feature key has a Compare row or a documented exemption', () => {
    const rowKeys = new Set(PLAN_FEATURE_ROWS.map((row) => row.key));
    const missing = (Object.keys(DEFAULT_PLAN_FEATURES) as PlanFeatureKey[]).filter(
      (key) => !rowKeys.has(key) && !MATRIX_EXEMPT[key]
    );
    expect(missing, 'add a PLAN_FEATURE_ROWS entry or a MATRIX_EXEMPT reason').toEqual([]);
  });

  it('exempt keys really have no row (remove stale exemptions)', () => {
    const rowKeys = new Set(PLAN_FEATURE_ROWS.map((row) => row.key));
    for (const key of Object.keys(MATRIX_EXEMPT))
      expect(rowKeys.has(key as PlanFeatureKey)).toBe(false);
  });

  it('row keys are unique and belong to a known group', () => {
    const keys = PLAN_FEATURE_ROWS.map((row) => row.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const row of PLAN_FEATURE_ROWS) {
      expect(PLAN_FEATURE_GROUP_ORDER, row.key).toContain(row.group);
    }
  });

  it('every group has a label', () => {
    for (const group of PLAN_FEATURE_GROUP_ORDER) {
      expect(PLAN_FEATURE_GROUP_LABELS[group]).toBeTruthy();
    }
  });

  it('the expected table covers every row', () => {
    for (const row of PLAN_FEATURE_ROWS) expect(EXPECTED[row.key], row.key).toBeDefined();
  });
});

describe('PLAN_FEATURE_ROWS cell values per tier', () => {
  for (const row of PLAN_FEATURE_ROWS) {
    it.each(GOLDEN_SOLD_PLANS.map((plan) => [plan.code, plan] as const))(
      `${row.key} on %s`,
      (code, plan) => {
        expect(row.value(plan.features)).toEqual(EXPECTED[row.key][code]);
      }
    );

    it(`${row.key} rank never decreases up the ladder`, () => {
      const ranks = GOLDEN_SOLD_PLANS.map((plan) => row.rank(plan.features));
      for (let i = 1; i < ranks.length; i += 1) {
        expect(ranks[i], `${row.key} ${GOLDEN_SOLD_PLANS[i].code}`).toBeGreaterThanOrEqual(
          ranks[i - 1]
        );
      }
    });

    it(`${row.key} rank is above zero exactly when the cell is not off`, () => {
      for (const plan of GOLDEN_SOLD_PLANS) {
        const cell = row.value(plan.features);
        expect(row.rank(plan.features) > 0, `${row.key} ${plan.code}`).toBe(cell.kind !== 'off');
      }
    });
  }
});

describe('legacy and edge values', () => {
  const search = PLAN_FEATURE_ROWS.find((row) => row.key === 'searchVisibilityTier')!;
  const publish = PLAN_FEATURE_ROWS.find((row) => row.key === 'marketingPublishLimitPerGroup')!;
  const base = GOLDEN_SOLD_PLANS[0].features;

  it('legacy top20 renders as Top 30 and top10 as Top 15', () => {
    expect(search.value({ ...base, searchVisibilityTier: 'top20' })).toEqual(text('Top 30'));
    expect(search.value({ ...base, searchVisibilityTier: 'top10' })).toEqual(text('Top 15'));
    expect(search.rank({ ...base, searchVisibilityTier: 'top20' })).toBe(
      search.rank({ ...base, searchVisibilityTier: 'top30' })
    );
    expect(search.rank({ ...base, searchVisibilityTier: 'top10' })).toBe(
      search.rank({ ...base, searchVisibilityTier: 'top15' })
    );
  });

  it('numeric publish limits render per channel', () => {
    expect(publish.value({ ...base, marketingPublishLimitPerGroup: 3 })).toEqual(
      text('3 / channel')
    );
  });

  it('unlimited outranks every numeric limit', () => {
    expect(publish.rank({ ...base, marketingPublishLimitPerGroup: null })).toBeGreaterThan(
      publish.rank({ ...base, marketingPublishLimitPerGroup: 999 })
    );
  });
});

describe('planFeatureMatrixGroups', () => {
  const plans = goldenSoldPlanDtos();
  const groups = planFeatureMatrixGroups(plans);

  it('follows the property sidebar group order', () => {
    const order = groups.map((g) => g.group);
    const expected = PLAN_FEATURE_GROUP_ORDER.filter((g) => order.includes(g));
    expect(order).toEqual(expected);
  });

  it('places baseline rows in their module and lists them once', () => {
    for (const baseline of PLAN_BASELINE_MATRIX_ROWS) {
      const group = groups.find((g) => g.group === baseline.group)!;
      expect(group.rows.filter((r) => r.key === baseline.key)).toHaveLength(1);
    }
  });

  it('shows the Starter pricing row under Pricing', () => {
    const pricing = groups.find((g) => g.group === 'pricing')!;
    for (const row of PLAN_STARTER_MATRIX_ROWS) {
      expect(pricing.rows.map((r) => r.key)).toContain(row.key);
      expect(row.minSortOrder).toBe(2);
    }
  });

  it('includes managed-only rows only when Managed is on the ladder', () => {
    const managed = groups.find((g) => g.group === 'managed')!;
    for (const row of PLAN_MANAGED_MATRIX_ROWS) {
      expect(managed.rows.map((r) => r.key)).toContain(row.key);
    }
    const withoutManaged = planFeatureMatrixGroups(
      plans.filter((p) => p.code !== MANAGED_PLAN_CODE)
    );
    const keys = withoutManaged.flatMap((g) => g.rows.map((r) => r.key));
    for (const row of PLAN_MANAGED_MATRIX_ROWS) expect(keys).not.toContain(row.key);
  });

  it('drops rows no listed tier turns on and empty groups', () => {
    const freeOnly = planFeatureMatrixGroups([plans[0]]);
    const keys = freeOnly.flatMap((g) => g.rows.map((r) => r.key));
    for (const row of PLAN_FEATURE_ROWS) {
      if (row.value(plans[0].features).kind === 'off') expect(keys).not.toContain(row.key);
    }
    for (const group of freeOnly) expect(group.rows.length).toBeGreaterThan(0);
  });

  it('every feature row with a non-off cell for some tier appears exactly once', () => {
    const keys = groups.flatMap((g) => g.rows.map((r) => r.key));
    for (const row of PLAN_FEATURE_ROWS) expect(keys.filter((k) => k === row.key)).toHaveLength(1);
  });
});
