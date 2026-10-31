import { describe, expect, it } from 'vitest';

import {
  PLAN_CODE_DISPLAY_NAME,
  PLAN_FAQ_ITEMS,
  PLAN_FEATURE_ROWS,
  PLAN_MANAGED_MATRIX_ROWS,
  PLAN_PROMO_BADGE,
  PLAN_TIER_CARD_GAINS,
  PLANS_PAGE_SUBTITLE,
  PLANS_TAB_SECTION_TITLES,
  planDisplayName,
  planDisplayNameFromSubscription,
  planDiscountLabel,
  planPrice,
  planPromoBadge,
  planQuickFacts,
  planTierPitch,
  subscriptionStatusMeta,
} from '@/features/dashboard/plans/lib/planPresentation';
import {
  GOLDEN_SOLD_PLANS,
  goldenPlanDto,
  goldenSoldPlanDtos,
} from '@/features/dashboard/plans/lib/planTierGolden';

const plans = goldenSoldPlanDtos();
const EM_DASH = '—';

describe('display names', () => {
  it('codes map to the host-facing names (growth is Pro, pro is Business)', () => {
    expect(plans.map((p) => planDisplayName(p))).toEqual([
      'Free',
      'Starter',
      'Pro',
      'Business',
      'Managed',
    ]);
    expect(
      plans.map((p) => planDisplayNameFromSubscription({ planCode: p.code, planName: 'x' }))
    ).toEqual(['Free', 'Starter', 'Pro', 'Business', 'Managed']);
  });

  it('code wins over stale DB name and tagline', () => {
    expect(planDisplayName({ code: 'growth', name: 'Level 3', tagline: 'Level 3' })).toBe('Pro');
    expect(planDisplayName({ code: 'pro', name: 'Growth', tagline: 'Growth' })).toBe('Business');
  });

  it('unknown code uses a real tagline, then the name, then a fallback', () => {
    expect(planDisplayName({ code: 'x', name: 'Custom', tagline: 'Big teams' })).toBe('Big teams');
    expect(planDisplayName({ code: 'x', name: 'Custom', tagline: 'Level 2' })).toBe('Custom');
    expect(planDisplayName({ code: 'x', name: ' ', tagline: null })).toBe('Plan');
    expect(planDisplayNameFromSubscription(null)).toBe('');
  });

  it('every sold code has a display name and none for retired plans', () => {
    for (const plan of GOLDEN_SOLD_PLANS) expect(PLAN_CODE_DISPLAY_NAME[plan.code]).toBeTruthy();
    expect(PLAN_CODE_DISPLAY_NAME.business_plus).toBeUndefined();
  });
});

describe('promo badges and pitches', () => {
  it('badges by tier', () => {
    expect(plans.map((p) => planPromoBadge(p.code))).toEqual([
      null,
      'Best value',
      'Most popular',
      'Recommended',
      'Hands-off hosting',
    ]);
    expect(Object.keys(PLAN_PROMO_BADGE)).not.toContain('free');
  });

  it('each sold tier has a trimmed one-line pitch', () => {
    for (const plan of plans) {
      const pitch = planTierPitch(plan);
      expect(pitch, plan.code).toBeTruthy();
      expect(pitch, `${plan.code} pitch has stray whitespace`).toBe(pitch!.trim());
    }
  });

  it('weak taglines never become the pitch on unknown tiers', () => {
    expect(planTierPitch({ ...plans[1], code: 'other', tagline: 'Starter' })).toBeNull();
    expect(planTierPitch({ ...plans[1], code: 'other', tagline: 'For big teams' })).toBe(
      'For big teams'
    );
  });
});

describe('planPrice per tier', () => {
  it.each([
    ['free', '₱0', undefined],
    ['starter', '₱399', '₱499'],
    ['growth', '₱799', '₱999'],
    ['pro', '₱1,439', '₱1,799'],
    ['managed', '₱3,999', '₱4,999'],
  ])('%s shows %s with compare-at %s', (code, amount, compareAt) => {
    const plan = plans.find((p) => p.code === code)!;
    const price = planPrice(plan);
    expect(price.amount.replace(/\s/g, '')).toBe(amount);
    expect(price.suffix).toBe('/month');
    expect(price.compareAtAmount?.replace(/\s/g, '')).toBe(compareAt);
    expect(price.discountPercent).toBe(compareAt ? 20 : undefined);
  });

  it('a locked-in charged price skips list and promo math', () => {
    expect(planPrice({ ...plans[2], chargedPricePhp: 5000 }).amount.replace(/\s/g, '')).toBe(
      '₱5,000'
    );
    expect(planPrice({ ...plans[0], chargedPricePhp: 0 }).amount.replace(/\s/g, '')).toBe('₱0');
  });

  it('commission plans read as a per-booking fee', () => {
    expect(planPrice({ ...plans[1], pricingModel: 'commission' })).toEqual({
      amount: '8% fee',
      suffix: 'per booking',
    });
  });

  it('discount label is whole percent only', () => {
    expect(planDiscountLabel(20)).toBe('20% off');
    expect(planDiscountLabel(20.9)).toBe('20% off');
    expect(planDiscountLabel(0)).toBe('');
  });

  it('retired Business Plus is priced but never in the sold ladder', () => {
    expect(goldenPlanDto({ ...GOLDEN_SOLD_PLANS[3], code: 'business_plus' }).code).toBe(
      'business_plus'
    );
  });
});

describe('planQuickFacts', () => {
  it('Free shows only the seat cap', () => {
    expect(planQuickFacts(plans[0].features)).toEqual([
      { label: 'Team members', value: 'Up to 1' },
    ]);
  });

  it('Starter adds nothing measurable beyond seats', () => {
    expect(planQuickFacts(plans[1].features).map((f) => f.label)).toEqual(['Team members']);
  });

  it('Pro and Business show seats, credits and search placement', () => {
    const facts = (i: number) =>
      Object.fromEntries(planQuickFacts(plans[i].features).map((f) => [f.label, f.value]));
    expect(facts(2)).toEqual({
      'Team members': 'Up to 5',
      'Search placement': 'Top 30',
      'AI credits': '5,000 / mo',
    });
    expect(facts(3)).toEqual({
      'Team members': 'Up to 10',
      'Search placement': 'Top 15',
      'AI credits': '25,000 / mo',
    });
  });

  it('Managed shows unlimited seats', () => {
    expect(planQuickFacts(plans[4].features)).toContainEqual({
      label: 'Team members',
      value: 'Unlimited',
    });
  });
});

describe('subscription status labels', () => {
  it.each([
    ['active', 'Active', 'success'],
    ['trialing', 'Trial', 'secondary'],
    ['past_due', 'Past due', 'destructive'],
    ['suspended', 'Suspended', 'destructive'],
    ['canceled', 'Cancelled', 'secondary'],
    ['weird', 'weird', 'secondary'],
  ])('%s', (status, label, tone) => {
    expect(subscriptionStatusMeta(status)).toEqual({ label, tone });
  });
});

describe('host-facing copy rules', () => {
  const strings: Array<[string, string]> = [
    ...Object.entries(PLAN_TIER_CARD_GAINS).flatMap(([code, list]) =>
      list.map((s): [string, string] => [`card ${code}`, s])
    ),
    ...PLAN_MANAGED_MATRIX_ROWS.map((r): [string, string] => ['managed row', r.label]),
    ...PLAN_FEATURE_ROWS.map((r): [string, string] => [`row ${r.key}`, r.label]),
    ...PLAN_FAQ_ITEMS.flatMap((f): [string, string][] => [
      ['faq question', f.question],
      ['faq answer', f.answer],
    ]),
    ['subtitle', PLANS_PAGE_SUBTITLE],
    ...Object.values(PLANS_TAB_SECTION_TITLES).map((s): [string, string] => ['tab title', s]),
  ];

  it.each(strings)('%s has no em dash or double space: %s', (_where, text) => {
    expect(text).not.toContain(EM_DASH);
    expect(text).not.toMatch(/ {2,}/);
    expect(text).toBe(text.trim());
  });

  it('FAQ answers every item and mentions Managed sales flow', () => {
    expect(PLAN_FAQ_ITEMS.length).toBeGreaterThanOrEqual(7);
    for (const item of PLAN_FAQ_ITEMS) {
      expect(item.question.endsWith('?')).toBe(true);
      expect(item.answer.length).toBeGreaterThan(20);
    }
    expect(PLAN_FAQ_ITEMS.some((f) => /Managed/.test(f.question))).toBe(true);
  });

  it('FAQ credit answer matches the tiers that have credits', () => {
    const credits = PLAN_FAQ_ITEMS.find((f) => /AI credits/.test(f.question))!;
    expect(credits.answer).toMatch(/Free and Starter do not include AI credits/);
    expect(plans[0].features.aiMonthlyCreditAllowance).toBe(0);
    expect(plans[1].features.aiMonthlyCreditAllowance).toBe(0);
    expect(plans[2].features.aiMonthlyCreditAllowance).toBeGreaterThan(0);
  });
});
