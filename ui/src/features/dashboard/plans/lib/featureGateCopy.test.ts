import { describe, expect, it } from 'vitest';

import { FEATURE_GATE_COPY, featureGateCopy } from '@/features/dashboard/plans/lib/featureGateCopy';
import {
  DEFAULT_PLAN_FEATURES,
  type PlanFeatureKey,
} from '@/features/dashboard/plans/lib/planFeatures';
import { GOLDEN_MINIMUM_TIER } from '@/features/dashboard/plans/lib/planTierGolden';

const KEYS = Object.keys(DEFAULT_PLAN_FEATURES) as PlanFeatureKey[];
const TIER_WORD: Record<string, string> = {
  starter: 'Starter',
  growth: 'Pro',
  pro: 'Business',
  managed: 'Managed',
};

describe('featureGateCopy', () => {
  it.each(KEYS)('%s has a title, description and CTA', (key) => {
    const copy = featureGateCopy(key);
    expect(copy).toBe(FEATURE_GATE_COPY[key]);
    expect(copy.title.trim().length).toBeGreaterThan(2);
    expect(copy.description.trim().length).toBeGreaterThan(10);
    expect(copy.ctaLabel.trim().length).toBeGreaterThan(2);
  });

  it.each(KEYS)('%s copy has no em dash', (key) => {
    const { title, description, ctaLabel } = featureGateCopy(key);
    for (const text of [title, description, ctaLabel]) expect(text).not.toContain('—');
  });

  // Where the description names a tier, it must be the real minimum tier.
  it.each(KEYS)('%s names the correct minimum tier when it names one', (key) => {
    // customPages copy is about saving, which is gated by publicPagesAutosave (Pro).
    if (key === 'customPages') return;
    const { description } = featureGateCopy(key);
    const named = Object.entries(TIER_WORD).filter(([, word]) =>
      new RegExp(`\\b${word} and above\\b|\\bon ${word}\\b`).test(description)
    );
    if (named.length === 0) return;
    expect(
      named.map(([code]) => code),
      `${key}: "${description}"`
    ).toEqual([GOLDEN_MINIMUM_TIER[key]]);
  });
});
