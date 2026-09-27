import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { FEATURE_GATE_COPY } from '@/features/dashboard/plans/lib/featureGateCopy';
import {
  DEFAULT_PLAN_FEATURES,
  isFeatureEnabled,
  PLAN_FEATURE_LABELS,
  type PlanFeatureKey,
} from '@/features/dashboard/plans/lib/planFeatures';
import {
  GOLDEN_ALL_PLANS,
  GOLDEN_BUSINESS_PLUS,
  GOLDEN_SOLD_PLANS,
} from '@/features/dashboard/plans/lib/planTierGolden';

import {
  DEFAULT_PLAN_FEATURES as SERVER_DEFAULTS,
  isFeatureEnabled as serverIsFeatureEnabled,
  parsePlanFeatures,
} from '../../../../../../supabase/functions/_shared/planFeatures';

const ROOT = resolve(import.meta.dirname, '../../../../../..');
const serverSource = readFileSync(
  resolve(ROOT, 'supabase/functions/_shared/planFeatures.ts'),
  'utf8'
);
const uiSource = readFileSync(
  resolve(ROOT, 'ui/src/features/dashboard/plans/lib/planFeatures.ts'),
  'utf8'
);

function typeBlock(source: string): string[] {
  const block = source.match(/export type PlanFeatures = \{([\s\S]*?)\n\};/)?.[1] ?? '';
  return block
    .split('\n')
    .map((line) => line.trim())
    .filter(
      (line) => line && !line.startsWith('/**') && !line.startsWith('*') && !line.startsWith('//')
    )
    .map((line) => line.replace(/\s+/g, ' '));
}

const KEYS = Object.keys(DEFAULT_PLAN_FEATURES) as PlanFeatureKey[];

describe('client and server plan feature catalogs stay in sync', () => {
  it('PlanFeatures type declares identical keys and types', () => {
    expect(typeBlock(uiSource)).toEqual(typeBlock(serverSource));
    expect(typeBlock(uiSource).length).toBe(KEYS.length);
  });

  it('search tier union matches', () => {
    const re = /export type SearchVisibilityTier = ([^;]+);/;
    expect(uiSource.match(re)?.[1]).toBe(serverSource.match(re)?.[1]);
  });

  it('defaults are identical', () => {
    expect(DEFAULT_PLAN_FEATURES).toEqual(SERVER_DEFAULTS);
  });

  it('isFeatureEnabled agrees for every key on every golden tier', () => {
    for (const plan of GOLDEN_ALL_PLANS) {
      for (const key of KEYS) {
        expect(isFeatureEnabled(plan.features, key), `${plan.code}.${key}`).toBe(
          serverIsFeatureEnabled(plan.features, key)
        );
      }
    }
  });

  it('every key has a label and gate copy', () => {
    expect(Object.keys(PLAN_FEATURE_LABELS).sort()).toEqual([...KEYS].sort());
    expect(Object.keys(FEATURE_GATE_COPY).sort()).toEqual([...KEYS].sort());
  });
});

describe('server parsePlanFeatures on the golden catalog', () => {
  it.each(GOLDEN_SOLD_PLANS.map((p) => [p.code, p] as const))(
    '%s round-trips unchanged',
    (_code, plan) => {
      expect(parsePlanFeatures(plan.features)).toEqual(plan.features);
    }
  );

  it('retired business_plus normalises its legacy top10 tier to top15', () => {
    const parsed = parsePlanFeatures(GOLDEN_BUSINESS_PLUS.features);
    expect(GOLDEN_BUSINESS_PLUS.features.searchVisibilityTier).toBe('top10');
    expect(parsed).toEqual({ ...GOLDEN_BUSINESS_PLUS.features, searchVisibilityTier: 'top15' });
  });

  it('garbage input falls back to defaults', () => {
    for (const raw of [null, undefined, 'x', 3, [], { teamManagement: 'nope' }]) {
      expect(parsePlanFeatures(raw)).toEqual(SERVER_DEFAULTS);
    }
  });

  it('wrong-typed values fall back per key instead of passing through', () => {
    const parsed = parsePlanFeatures({
      smartPricing: 'yes',
      aiMonthlyCreditAllowance: 'lots',
      searchVisibilityTier: 'top1',
      marketingPublishLimitPerGroup: 'many',
    });
    expect(parsed.smartPricing).toBe(false);
    expect(parsed.aiMonthlyCreditAllowance).toBe(0);
    expect(parsed.searchVisibilityTier).toBe('none');
    expect(parsed.marketingPublishLimitPerGroup).toBe(0);
  });

  it('legacy search tiers normalise to the current ones', () => {
    expect(parsePlanFeatures({ searchVisibilityTier: 'top20' }).searchVisibilityTier).toBe('top30');
    expect(parsePlanFeatures({ searchVisibilityTier: 'top10' }).searchVisibilityTier).toBe('top15');
  });

  it('null maxMembers means unlimited, null publish limit means unlimited', () => {
    const parsed = parsePlanFeatures({
      teamManagement: { enabled: true, maxMembers: null },
      marketingPublishLimitPerGroup: null,
    });
    expect(parsed.teamManagement).toEqual({ enabled: true, maxMembers: null });
    expect(parsed.marketingPublishLimitPerGroup).toBeNull();
  });

  it('a retired row missing newer keys reads as not entitled', () => {
    const parsed = parsePlanFeatures({ marketingStudio: false, aiMarketingGeneration: false });
    expect(parsed.bookingImport).toBe(false);
    expect(parsed.customRoles).toBe(false);
    expect(parsed.propertyShowcase).toBe(false);
  });
});
