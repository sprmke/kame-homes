import { describe, expect, it } from 'vitest';

import { planIncludedFeatureGroups } from '@/features/dashboard/plans/lib/planPresentation';
import {
  GOLDEN_FREE,
  GOLDEN_PRO,
  GOLDEN_STARTER,
  goldenPlanDto,
} from '@/features/dashboard/plans/lib/planTierGolden';

function labels(code: typeof GOLDEN_FREE) {
  return planIncludedFeatureGroups(goldenPlanDto(code)).flatMap((group) =>
    group.features.map((feature) => feature.label)
  );
}

describe('planIncludedFeatureGroups', () => {
  it('lists baseline features on Free without pricing management', () => {
    const free = labels(GOLDEN_FREE);
    expect(free).toContain('Dashboard overview');
    expect(free).toContain('Manual booking management');
    expect(free).not.toContain('Pricing management');
  });

  it('includes lower-tier features on higher tiers, not just the delta', () => {
    const starter = labels(GOLDEN_STARTER);
    const pro = labels(GOLDEN_PRO);
    expect(starter).toContain('Pricing management');
    expect(pro).toContain('Pricing management');
    expect(pro).toContain('Dashboard overview');
    for (const label of starter) {
      if (label.startsWith('Up to ')) continue;
      expect(pro).toContain(label);
    }
  });

  it('describes measured limits with the plan values', () => {
    const pro = labels(GOLDEN_PRO);
    expect(pro.some((label) => /^Up to \d+ team members$/.test(label))).toBe(true);
  });

  it('never returns empty groups', () => {
    for (const group of planIncludedFeatureGroups(goldenPlanDto(GOLDEN_PRO))) {
      expect(group.features.length).toBeGreaterThan(0);
    }
  });
});
