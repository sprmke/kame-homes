import { describe, expect, it } from 'vitest';

import {
  isFeatureEnabled,
  type PlanFeatureKey,
  type PlanFeatures,
} from '@/features/dashboard/plans/lib/planFeatures';
import {
  buildPlanTiers,
  PLAN_FEATURE_ROWS,
  PLAN_TIER_CARD_GAINS,
  planCapabilityCount,
  planFeatureGains,
  planFeatureLosses,
  resolveUpgradeCelebrationGains,
} from '@/features/dashboard/plans/lib/planPresentation';
import {
  GOLDEN_BUSINESS,
  GOLDEN_FREE,
  GOLDEN_MANAGED,
  GOLDEN_MINIMUM_TIER,
  GOLDEN_PRO,
  GOLDEN_RETIRED_PLANS,
  GOLDEN_SOLD_PLANS,
  GOLDEN_STARTER,
  goldenPlanDto,
  goldenPlanId,
  goldenSoldPlanDtos,
} from '@/features/dashboard/plans/lib/planTierGolden';

type BulletRule = {
  label: string | RegExp;
  /** Feature rows this bullet advertises (used for the completeness check). */
  keys: PlanFeatureKey[];
  holds: (features: PlanFeatures, label: string) => boolean;
};

const flag =
  (key: PlanFeatureKey) =>
  (f: PlanFeatures): boolean =>
    isFeatureEnabled(f, key);

/** Every card bullet must match exactly one rule. Numbers in labels are checked against the tier. */
const BULLET_RULES: BulletRule[] = [
  {
    label: 'Automated booking emails',
    keys: ['automatedBookingFlow'],
    holds: flag('automatedBookingFlow'),
  },
  {
    label: 'Verified badge eligible',
    keys: ['verifiedBadgeEligible'],
    holds: flag('verifiedBadgeEligible'),
  },
  {
    label: 'Recommended badge eligible',
    keys: ['recommendedBadgeEligible'],
    holds: flag('recommendedBadgeEligible'),
  },
  {
    label: 'Telegram alerts',
    keys: ['telegramNotifications'],
    holds: flag('telegramNotifications'),
  },
  { label: 'Custom team roles', keys: ['customRoles'], holds: flag('customRoles') },
  {
    label: 'Advanced template management',
    keys: ['customTemplates'],
    holds: flag('customTemplates'),
  },
  {
    label: 'Finance reporting & export',
    keys: ['financeReporting'],
    holds: flag('financeReporting'),
  },
  {
    label: 'Maintenance reporting & export',
    keys: ['maintenanceReporting'],
    holds: flag('maintenanceReporting'),
  },
  { label: 'Inbox quick replies', keys: ['quickReplies'], holds: flag('quickReplies') },
  { label: 'AI booking import', keys: ['bookingImport'], holds: flag('bookingImport') },
  { label: 'Marketing Content Studio', keys: ['marketingStudio'], holds: flag('marketingStudio') },
  { label: 'AI receipt and ID validation', keys: ['aiValidations'], holds: flag('aiValidations') },
  {
    label: 'Public pages editor',
    keys: ['publicPagesAutosave'],
    holds: flag('publicPagesAutosave'),
  },
  {
    label: 'Property showcase & stay guide access',
    keys: ['propertyShowcase'],
    holds: flag('propertyShowcase'),
  },
  { label: 'Airbnb calendar sync', keys: ['calendarSync'], holds: flag('calendarSync') },
  { label: 'Smart AI Pricing', keys: ['smartPricing'], holds: flag('smartPricing') },
  {
    label: 'Copy property settings',
    keys: ['copyPropertySettings'],
    holds: flag('copyPropertySettings'),
  },
  {
    label: 'Analytics export and AI review',
    keys: ['analyticsInsights'],
    holds: flag('analyticsInsights'),
  },
  {
    label: 'AI image generation',
    keys: ['aiMarketingImageGeneration'],
    holds: flag('aiMarketingImageGeneration'),
  },
  {
    label: 'AI video generation',
    keys: ['aiMarketingVideoGeneration'],
    holds: flag('aiMarketingVideoGeneration'),
  },
  {
    label: 'AI content generation',
    keys: ['aiMarketingGeneration'],
    holds: flag('aiMarketingGeneration'),
  },
  {
    label: 'AI dashboard assistant',
    keys: ['aiDashboardAssistant'],
    holds: flag('aiDashboardAssistant'),
  },
  { label: 'AI receptionist', keys: ['aiReceptionist'], holds: flag('aiReceptionist') },
  { label: 'AI chat auto-reply', keys: ['aiChatAutoReply'], holds: flag('aiChatAutoReply') },
  {
    label: 'Meta (Facebook/Instagram) chat channel',
    keys: ['metaChatChannel'],
    holds: flag('metaChatChannel'),
  },
  {
    label: 'Publish in Meta platforms',
    keys: ['marketingPublishLimitPerGroup'],
    holds: (f) => f.marketingPublishLimitPerGroup === null,
  },
  {
    label: /^Up to (\d+) team members$/,
    keys: ['teamManagement'],
    holds: (f, label) =>
      f.teamManagement.enabled && f.teamManagement.maxMembers === Number(label.match(/(\d+)/)![1]),
  },
  {
    label: /^Top (\d+) search placement$/,
    keys: ['searchVisibilityTier'],
    holds: (f, label) => f.searchVisibilityTier === `top${label.match(/(\d+)/)![1]}`,
  },
  {
    label: /^([\d,]+) AI credits per month$/,
    keys: ['aiMonthlyCreditAllowance'],
    holds: (f, label) =>
      f.aiMonthlyCreditAllowance === Number(label.match(/([\d,]+)/)![1].replace(/,/g, '')),
  },
  {
    label: /^We'll manage everything/,
    keys: ['fullyManagedByPlatform'],
    holds: flag('fullyManagedByPlatform'),
  },
];

/** Static copy with no feature key behind it. Only allowed on the tier listed. */
const COPY_ONLY: Record<string, string[]> = {
  free: [
    'Dashboard overview',
    'Manual booking management',
    'Public guest form',
    'Manual document generation',
    'Standard template management',
    'Finance management',
    'Maintenance reminders',
    'Notifications',
  ],
  starter: ['Pricing management'],
  managed: [
    'Ideal for hosts with limited time',
    'Full transparency on bookings and finance',
    'Earn from your listing with minimal work & supervision',
    'Free social media boosts from our marketing team to help promote your listings across different groups',
    'Cleaning and maintenance staff available (separate fee)',
  ],
};

function ruleFor(label: string): BulletRule | undefined {
  const matches = BULLET_RULES.filter((rule) =>
    typeof rule.label === 'string' ? rule.label === label : rule.label.test(label)
  );
  expect(matches.length, `bullet "${label}" matched ${matches.length} rules`).toBeLessThanOrEqual(
    1
  );
  return matches[0];
}

/**
 * Gained rows a card deliberately does not list. Each needs a reason.
 * - free: the 1-seat cap is shown in the Compare table, not as a Free bullet.
 * - managed: GAP. Seats go from 10 (Business) to unlimited, but the Managed card has no
 *   "Unlimited team members" bullet. Compare shows it. Decide whether to add the bullet.
 */
const CARD_OMISSIONS: Record<string, string[]> = {
  free: ['teamManagement'],
  managed: ['teamManagement'],
};

const LADDER = GOLDEN_SOLD_PLANS;

describe('tier card bullets tell the truth', () => {
  for (const [index, plan] of LADDER.entries()) {
    const previous = index > 0 ? LADDER[index - 1] : null;
    const bullets = PLAN_TIER_CARD_GAINS[plan.code] ?? [];

    it(`${plan.code} has bullets`, () => {
      expect(bullets.length).toBeGreaterThan(0);
    });

    for (const bullet of bullets) {
      it(`${plan.code}: "${bullet.slice(0, 60)}" is real`, () => {
        if (COPY_ONLY[plan.code]?.includes(bullet)) return;
        const rule = ruleFor(bullet);
        expect(
          rule,
          `no rule for "${bullet}" on ${plan.code}; add a BULLET_RULE or COPY_ONLY entry`
        ).toBeDefined();
        expect(rule!.holds(plan.features, bullet), 'tier must have it').toBe(true);
        if (previous) {
          expect(rule!.holds(previous.features, bullet), `${previous.code} already had it`).toBe(
            false
          );
        }
      });
    }

    it(`${plan.code} lists every capability gained over ${previous?.code ?? 'nothing'}`, () => {
      const advertised = new Set(
        bullets.flatMap((b) => {
          const rule = BULLET_RULES.find((r) =>
            typeof r.label === 'string' ? r.label === b : r.label.test(b)
          );
          return rule?.keys ?? [];
        })
      );
      const gained = planFeatureGains(previous?.features ?? null, plan.features).map((g) => g.key);
      const allowedOmissions = CARD_OMISSIONS[plan.code] ?? [];
      const missing = gained.filter(
        (key) => !advertised.has(key as PlanFeatureKey) && !allowedOmissions.includes(key)
      );
      expect(missing, `${plan.code} card omits gained rows`).toEqual([]);
    });
  }

  it('no bullet label repeats across tiers', () => {
    const all = LADDER.flatMap((plan) => PLAN_TIER_CARD_GAINS[plan.code] ?? []);
    expect(new Set(all).size).toBe(all.length);
  });

  it('only sold tiers have bullets (retired and commission stay hidden)', () => {
    expect(Object.keys(PLAN_TIER_CARD_GAINS).sort()).toEqual(LADDER.map((p) => p.code).sort());
  });
});

describe('buildPlanTiers', () => {
  const plans = goldenSoldPlanDtos();

  it('orders by sortOrder even when input is shuffled', () => {
    const tiers = buildPlanTiers([...plans].reverse(), undefined);
    expect(tiers.map((t) => t.plan.code)).toEqual(LADDER.map((p) => p.code));
  });

  it.each(LADDER.map((p) => p.code))('marks direction relative to %s', (code) => {
    const currentIndex = LADDER.findIndex((p) => p.code === code);
    const tiers = buildPlanTiers(plans, goldenPlanId(code));
    tiers.forEach((tier, index) => {
      const expected =
        index === currentIndex ? 'current' : index < currentIndex ? 'downgrade' : 'upgrade';
      expect(tier.direction, `${tier.plan.code} vs ${code}`).toBe(expected);
      expect(tier.isCurrent).toBe(index === currentIndex);
    });
  });

  it('highlights Business as the recommended next step unless already on it', () => {
    const fromStarter = buildPlanTiers(plans, goldenPlanId('starter'));
    expect(fromStarter.filter((t) => t.isNextStep).map((t) => t.plan.code)).toEqual(['pro']);
    const onBusiness = buildPlanTiers(plans, goldenPlanId('pro'));
    expect(onBusiness.some((t) => t.isNextStep)).toBe(false);
    const fromManaged = buildPlanTiers(plans, goldenPlanId('managed'));
    expect(fromManaged.some((t) => t.isNextStep)).toBe(false);
  });

  it('shows the "everything in" anchor for every paid tier and not for Free', () => {
    const tiers = buildPlanTiers(plans, undefined);
    expect(tiers.map((t) => t.inheritsFrom)).toEqual([null, 'Free', 'Starter', 'Pro', 'Business']);
  });

  it('uses the curated card bullets as gains', () => {
    const tiers = buildPlanTiers(plans, undefined);
    for (const tier of tiers) {
      expect(tier.gains.map((g) => g.label)).toEqual(PLAN_TIER_CARD_GAINS[tier.plan.code]);
    }
  });

  it('keeps unknown current plan ids from marking any tier current', () => {
    const tiers = buildPlanTiers(plans, 'plan-missing');
    expect(tiers.some((t) => t.isCurrent)).toBe(false);
    expect(tiers.every((t) => t.direction === 'upgrade')).toBe(true);
  });

  it('a retired tier passed in still falls back to derived gains instead of crashing', () => {
    const retired = goldenPlanDto(GOLDEN_RETIRED_PLANS[0]);
    const tiers = buildPlanTiers([...plans, retired], undefined);
    const retiredTier = tiers.find((t) => t.plan.code === 'business_plus')!;
    expect(retiredTier).toBeDefined();
    expect(Array.isArray(retiredTier.gains)).toBe(true);
  });
});

/** Independent oracle: rows gained = minimum tier inside (from, to] plus numeric bumps. */
const NUMERIC_BUMPS: Record<string, PlanFeatureKey[]> = {
  'free>starter': ['teamManagement'],
  'starter>growth': ['teamManagement'],
  'growth>pro': ['teamManagement', 'searchVisibilityTier', 'aiMonthlyCreditAllowance'],
  'pro>managed': ['teamManagement', 'aiMonthlyCreditAllowance'],
};

describe('planFeatureGains / planFeatureLosses', () => {
  const rowKeys = new Set(PLAN_FEATURE_ROWS.map((r) => r.key));

  it.each(LADDER.slice(1).map((plan, i) => [LADDER[i], plan] as const))(
    '%s -> next tier gains exactly the documented rows',
    (from, to) => {
      const fromIdx = LADDER.indexOf(from);
      const toIdx = LADDER.indexOf(to);
      const byMinimum = (Object.keys(GOLDEN_MINIMUM_TIER) as PlanFeatureKey[]).filter((key) => {
        const minIdx = LADDER.findIndex((p) => p.code === GOLDEN_MINIMUM_TIER[key]);
        return minIdx > fromIdx && minIdx <= toIdx && rowKeys.has(key);
      });
      const expected = new Set([...byMinimum, ...(NUMERIC_BUMPS[`${from.code}>${to.code}`] ?? [])]);
      const gained = planFeatureGains(from.features, to.features).map((g) => g.key);
      expect(new Set(gained)).toEqual(expected);
    }
  );

  it('gains and losses are mirror images for every pair of tiers', () => {
    for (const a of LADDER) {
      for (const b of LADDER) {
        const gains = planFeatureGains(a.features, b.features)
          .map((g) => g.key)
          .sort();
        const losses = planFeatureLosses(b.features, a.features)
          .map((g) => g.key)
          .sort();
        expect(losses, `${a.code}->${b.code}`).toEqual(gains);
      }
    }
  });

  it('gaining from equal features is empty, and null "from" lists everything the tier has', () => {
    for (const plan of LADDER) {
      expect(planFeatureGains(plan.features, plan.features)).toEqual([]);
      expect(planFeatureLosses(plan.features, plan.features)).toEqual([]);
    }
    expect(planFeatureGains(null, GOLDEN_FREE.features).map((g) => g.key)).toEqual([
      'teamManagement',
    ]);
  });

  it('Business -> Starter loses AI and Meta but keeps Starter tools', () => {
    const lost = planFeatureLosses(GOLDEN_BUSINESS.features, GOLDEN_STARTER.features).map(
      (l) => l.key
    );
    expect(lost).toEqual(
      expect.arrayContaining([
        'aiMarketingVideoGeneration',
        'metaChatChannel',
        'aiChatAutoReply',
        'calendarSync',
      ])
    );
    expect(lost).not.toContain('financeReporting');
    expect(lost).not.toContain('quickReplies');
  });

  it('Managed -> Free loses fullyManagedByPlatform', () => {
    const lost = planFeatureLosses(GOLDEN_MANAGED.features, GOLDEN_FREE.features).map((l) => l.key);
    expect(lost).toContain('fullyManagedByPlatform');
  });

  it('describe() wording carries the tier value', () => {
    const gains = planFeatureGains(GOLDEN_STARTER.features, GOLDEN_PRO.features);
    const labels = Object.fromEntries(gains.map((g) => [g.key, g.label]));
    expect(labels.teamManagement).toBe('Up to 5 team members');
    expect(labels.aiMonthlyCreditAllowance).toBe('5,000 AI credits per month');
    expect(labels.searchVisibilityTier).toBe('Top 30 search placement');
  });

  it('capability count strictly grows up the ladder and Free is one (team seats)', () => {
    const counts = LADDER.map((p) => planCapabilityCount(p.features));
    for (let i = 1; i < counts.length; i += 1) expect(counts[i]).toBeGreaterThan(counts[i - 1]);
    expect(counts[0]).toBe(1);
  });
});

describe('resolveUpgradeCelebrationGains', () => {
  const [free, starter, pro, business] = goldenSoldPlanDtos();

  it('shows the delta from the previous plan, capped at 8', () => {
    const gains = resolveUpgradeCelebrationGains(starter, pro);
    expect(gains.length).toBeLessThanOrEqual(8);
    expect(gains.map((g) => g.key)).toEqual(
      planFeatureGains(starter.features, pro.features)
        .slice(0, 8)
        .map((g) => g.key)
    );
  });

  it('falls back to the target card bullets when there is no previous plan', () => {
    const gains = resolveUpgradeCelebrationGains(null, starter);
    expect(gains.map((g) => g.label)).toEqual(PLAN_TIER_CARD_GAINS.starter.slice(0, 8));
  });

  it('falls back to card bullets when the same plan is re-selected', () => {
    const gains = resolveUpgradeCelebrationGains(business, business);
    expect(gains.map((g) => g.label)).toEqual(PLAN_TIER_CARD_GAINS.pro.slice(0, 8));
  });

  it('Free -> Starter celebration mentions Starter tools', () => {
    const labels = resolveUpgradeCelebrationGains(free, starter).map((g) => g.label);
    expect(labels).toContain('Automated booking emails');
    expect(labels).toContain('Up to 3 team members');
  });
});
