/**
 * Presentation layer for pricing tiers.
 *
 * Tiers are cumulative, so cards show only what a tier *adds* over the one below it
 * and the matrix carries the full picture. Every value here is derived from the plan
 * row — nothing is illustrative.
 *
 * **Public marketing sync:** `/for-hosts/pricing` reuses `buildPlanTiers`,
 * `PLAN_TIER_CARD_GAINS`, and this module via `list-public-pricing-plans`. When you
 * change tier copy, feature bullets, or display names here — or seed/update
 * `pricing_plans` — verify the public pricing page still matches the in-app Plans UI.
 * Canonical matrix: `docs/architecture/plans-feature-matrix.md`.
 */

import type {
  OrgBundlePlanDto,
  OrgSubscriptionDto,
} from '@/features/dashboard/plans/lib/orgPlanApi';
import {
  isFeatureEnabled,
  type PlanFeatureKey,
  type PlanFeatures,
} from '@/features/dashboard/plans/lib/planFeatures';
import {
  discountedPlanPricePhp,
  normalizePlanDiscountPercent,
} from '@/features/dashboard/plans/lib/planPricing';

import { formatManilaLongDate } from '@/utils/format/dates';

/** Matrix section = product page / module hosts already know from the sidebar. */
export type PlanFeatureGroup =
  | 'dashboard'
  | 'bookings'
  | 'finance'
  | 'maintenance'
  | 'pricing'
  | 'analytics'
  | 'team'
  | 'marketing'
  | 'inbox'
  | 'notifications'
  | 'templates'
  | 'publicPages'
  | 'visibility'
  | 'ai'
  | 'managed';

export const PLAN_FEATURE_GROUP_LABELS: Record<PlanFeatureGroup, string> = {
  dashboard: 'Dashboard',
  bookings: 'Bookings',
  finance: 'Finance',
  maintenance: 'Maintenance',
  pricing: 'Pricing',
  analytics: 'Analytics',
  team: 'Team',
  marketing: 'Marketing',
  inbox: 'Inbox',
  notifications: 'Notifications',
  templates: 'Templates',
  publicPages: 'Public pages',
  visibility: 'Visibility',
  ai: 'AI',
  managed: 'Managed hosting',
};

/** `off` renders as a dash; `on` as a check; `text` as the measured value. */
export type PlanFeatureValue = { kind: 'on' } | { kind: 'off' } | { kind: 'text'; text: string };

export type PlanFeatureRow = {
  key: PlanFeatureKey;
  /** Matrix row label — stable across tiers. */
  label: string;
  group: PlanFeatureGroup;
  value: (features: PlanFeatures) => PlanFeatureValue;
  /** Higher means more capability. Drives added/removed detection between tiers. */
  rank: (features: PlanFeatures) => number;
  /** Card bullet + change-list wording for the tier that has it. */
  describe: (features: PlanFeatures) => string;
};

function boolRow(
  key: PlanFeatureKey,
  label: string,
  group: PlanFeatureGroup,
  describeAs = label
): PlanFeatureRow {
  return {
    key,
    label,
    group,
    value: (features) => ({ kind: features[key] === true ? 'on' : 'off' }),
    rank: (features) => (features[key] === true ? 1 : 0),
    describe: () => describeAs,
  };
}

const SEARCH_TIER_LABEL: Record<PlanFeatures['searchVisibilityTier'], string> = {
  none: 'Standard',
  top30: 'Top 30',
  top15: 'Top 15',
  top20: 'Top 30',
  top10: 'Top 15',
};

const SEARCH_TIER_RANK: Record<PlanFeatures['searchVisibilityTier'], number> = {
  none: 0,
  top30: 1,
  top15: 2,
  top20: 1,
  top10: 2,
};

/** Included on every tier — folded into the matching module section in Compare. */
export const PLAN_BASELINE_MATRIX_ROWS: {
  key: string;
  label: string;
  group: PlanFeatureGroup;
}[] = [
  { key: 'baseline-dashboard', label: 'Dashboard overview', group: 'dashboard' },
  { key: 'baseline-bookings', label: 'Manual booking management', group: 'bookings' },
  { key: 'baseline-guest-form', label: 'Public guest form', group: 'bookings' },
  { key: 'baseline-manual-docs', label: 'Manual document generation', group: 'bookings' },
  { key: 'baseline-finance', label: 'Finance management', group: 'finance' },
  { key: 'baseline-maintenance', label: 'Maintenance reminders', group: 'maintenance' },
  { key: 'baseline-notifications', label: 'In-app notifications', group: 'notifications' },
];

/** Unlocked from Starter — not on Free; sits in the Pricing module section. */
export const PLAN_STARTER_MATRIX_ROWS: {
  key: string;
  label: string;
  group: PlanFeatureGroup;
  minSortOrder: number;
}[] = [{ key: 'starter-pricing', label: 'Pricing management', group: 'pricing', minSortOrder: 2 }];

/** Managed-only rows — marketing copy on the Managed card, not entitlement keys. */
export const PLAN_MANAGED_MATRIX_ROWS: { key: string; label: string; managedOnly: true }[] = [
  { key: 'managed-limited-time', label: 'Ideal for hosts with limited time', managedOnly: true },
  {
    key: 'managed-transparency',
    label: 'Full transparency on bookings and finance',
    managedOnly: true,
  },
  {
    key: 'managed-passive-income',
    label: 'Earn from your listing with minimal work & supervision',
    managedOnly: true,
  },
  {
    key: 'managed-social-boosts',
    label: 'Free social media boosts across listing groups',
    managedOnly: true,
  },
  {
    key: 'managed-cleaning',
    label: 'Cleaning and maintenance staff available (separate fee)',
    managedOnly: true,
  },
];

/** Incremental bullets per tier card — host-facing copy, not entitlement keys. */
export const PLAN_TIER_CARD_GAINS: Record<string, string[]> = {
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
  starter: [
    'Pricing management',
    'Automated booking emails',
    'Verified badge eligible',
    'Up to 3 team members',
    'Custom team roles',
    'Advanced template management',
    'Telegram alerts',
    'Finance reporting & export',
    'Maintenance reporting & export',
    'Inbox quick replies',
    'AI booking import',
  ],
  growth: [
    'Up to 5 team members',
    'Marketing Content Studio',
    'Top 30 search placement',
    'AI receipt and ID validation',
    'Recommended badge eligible',
    'Public pages editor',
    'Property showcase & stay guide access',
    'Airbnb calendar sync',
    'Smart AI Pricing',
    'Copy property settings',
    'Analytics export and AI review',
    'AI image generation',
    '5,000 AI credits per month',
  ],
  pro: [
    'Up to 10 team members',
    'Publish in Meta platforms',
    'Top 15 search placement',
    'AI content generation',
    'AI dashboard assistant',
    'AI receptionist',
    'AI chat auto-reply',
    'Meta (Facebook/Instagram) chat channel',
    'AI video generation',
    '25,000 AI credits per month',
  ],
  managed: [
    '60,000 AI credits per month',
    "We'll manage everything, from bookings to operations, marketing, chat, reminders, etc",
    'Ideal for hosts with limited time',
    'Full transparency on bookings and finance',
    'Earn from your listing with minimal work & supervision',
    'Free social media boosts from our marketing team to help promote your listings across different groups',
    'Cleaning and maintenance staff available (separate fee)',
  ],
};

function normalizeGainLabel(label: string): string {
  return label.trim().toLowerCase();
}

/**
 * Curated incremental bullets per tier card. Pro and Business lists are authoritative
 * (old middle/top tier features + new seat/publish/search adjustments).
 */
function resolveTierCardGains(
  plan: OrgBundlePlanDto,
  previous: OrgBundlePlanDto | null
): PlanFeatureChange[] {
  if (
    plan.code === 'free' ||
    plan.code === 'starter' ||
    plan.code === 'growth' ||
    plan.code === 'pro' ||
    plan.code === 'managed'
  ) {
    return planTierCardGains(plan.code);
  }

  const staticLabels = PLAN_TIER_CARD_GAINS[plan.code] ?? [];
  const seen = new Set(staticLabels.map(normalizeGainLabel));

  const merged: PlanFeatureChange[] = staticLabels.map((label, index) => ({
    key: `card-${plan.code}-static-${index}`,
    label,
  }));

  if (previous) {
    for (const gain of planFeatureGains(previous.features, plan.features)) {
      const normalized = normalizeGainLabel(gain.label);
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      merged.push(gain);
    }
  }

  return merged;
}

function planTierCardGains(planCode: string): PlanFeatureChange[] {
  const labels = PLAN_TIER_CARD_GAINS[planCode];
  if (!labels?.length) return [];
  return labels.map((label, index) => ({
    key: `card-${planCode}-${index}`,
    label,
  }));
}

/**
 * Matrix row order within each module — also drives derived tier-card bullets.
 * Group sequence matches `buildPropertyNavSections` (plus Visibility / AI / Managed,
 * which are not sidebar items).
 */
export const PLAN_FEATURE_ROWS: PlanFeatureRow[] = [
  boolRow('automatedBookingFlow', 'Automated booking emails', 'bookings'),
  boolRow('bookingImport', 'AI booking import', 'bookings'),
  boolRow('aiValidations', 'AI receipt and ID validation', 'bookings'),
  boolRow('copyPropertySettings', 'Copy property settings', 'dashboard'),

  boolRow('financeReporting', 'Finance reporting & export', 'finance'),
  boolRow('maintenanceReporting', 'Maintenance reporting & export', 'maintenance'),

  boolRow('calendarSync', 'Airbnb calendar sync', 'pricing'),
  boolRow('smartPricing', 'Smart AI Pricing', 'pricing'),

  boolRow('analyticsInsights', 'Analytics export and AI review', 'analytics'),

  {
    key: 'teamManagement',
    label: 'Team members',
    group: 'team',
    value: (features) => {
      if (!features.teamManagement.enabled) return { kind: 'off' };
      const max = features.teamManagement.maxMembers;
      return { kind: 'text', text: max === null ? 'Unlimited' : `Up to ${max}` };
    },
    rank: (features) => {
      if (!features.teamManagement.enabled) return 0;
      return features.teamManagement.maxMembers ?? Number.POSITIVE_INFINITY;
    },
    describe: (features) => {
      const max = features.teamManagement.maxMembers;
      return max === null ? 'Unlimited team members' : `Up to ${max} team members`;
    },
  },
  boolRow('customRoles', 'Custom team roles', 'team'),

  boolRow('marketingStudio', 'Content Studio', 'marketing'),
  boolRow('aiMarketingGeneration', 'AI content generation', 'marketing'),
  boolRow('aiMarketingImageGeneration', 'AI image generation', 'marketing'),
  boolRow('aiMarketingVideoGeneration', 'AI video generation', 'marketing'),
  {
    key: 'marketingPublishLimitPerGroup',
    label: 'Publish in Meta platforms',
    group: 'marketing',
    value: (features) => {
      const limit = features.marketingPublishLimitPerGroup;
      if (limit === null) return { kind: 'text', text: 'Unlimited' };
      if (limit <= 0) return { kind: 'off' };
      return { kind: 'text', text: `${limit} / channel` };
    },
    rank: (features) => {
      const limit = features.marketingPublishLimitPerGroup;
      if (limit === null) return Number.POSITIVE_INFINITY;
      return limit;
    },
    describe: (features) =>
      features.marketingPublishLimitPerGroup === null
        ? 'Unlimited Meta publishing'
        : `${features.marketingPublishLimitPerGroup} Meta publishes per channel`,
  },

  boolRow('quickReplies', 'Inbox quick replies', 'inbox'),
  boolRow('metaChatChannel', 'Meta (Facebook/Instagram) chat channel', 'inbox'),
  boolRow('aiChatAutoReply', 'AI chat auto-reply', 'inbox'),

  boolRow('telegramNotifications', 'Telegram alerts', 'notifications'),

  boolRow('customTemplates', 'Advanced template management', 'templates'),

  boolRow('publicPagesAutosave', 'Public pages editor', 'publicPages'),
  boolRow('propertyShowcase', 'Property showcase & stay guide access', 'publicPages'),

  boolRow('verifiedBadgeEligible', 'Verified badge eligible', 'visibility'),
  boolRow('recommendedBadgeEligible', 'Recommended badge eligible', 'visibility'),
  {
    key: 'searchVisibilityTier',
    label: 'Search placement',
    group: 'visibility',
    value: (features) =>
      features.searchVisibilityTier === 'none'
        ? { kind: 'off' }
        : { kind: 'text', text: SEARCH_TIER_LABEL[features.searchVisibilityTier] },
    rank: (features) => SEARCH_TIER_RANK[features.searchVisibilityTier],
    describe: (features) => `${SEARCH_TIER_LABEL[features.searchVisibilityTier]} search placement`,
  },

  boolRow('aiDashboardAssistant', 'AI dashboard assistant', 'ai'),
  boolRow('aiReceptionist', 'AI receptionist', 'ai'),
  {
    key: 'aiMonthlyCreditAllowance',
    label: 'AI credits',
    group: 'ai',
    value: (features) =>
      features.aiMonthlyCreditAllowance > 0
        ? { kind: 'text', text: `${features.aiMonthlyCreditAllowance.toLocaleString()} / mo` }
        : { kind: 'off' },
    rank: (features) => features.aiMonthlyCreditAllowance,
    describe: (features) =>
      `${features.aiMonthlyCreditAllowance.toLocaleString()} AI credits per month`,
  },

  boolRow(
    'fullyManagedByPlatform',
    "We'll manage everything, from bookings to operations, marketing, chat, reminders, etc",
    'managed',
    "We'll manage everything, from bookings to operations, marketing, chat, reminders, etc"
  ),
];

/** Same sequence as property sidebar modules, then Visibility / AI / Managed. */
export const PLAN_FEATURE_GROUP_ORDER: PlanFeatureGroup[] = [
  'dashboard',
  'bookings',
  'finance',
  'maintenance',
  'pricing',
  'analytics',
  'team',
  'marketing',
  'inbox',
  'notifications',
  'templates',
  'publicPages',
  'visibility',
  'ai',
  'managed',
];

export type PlanFeatureMatrixGroup = {
  group: PlanFeatureGroup;
  label: string;
  rows: Array<
    | PlanFeatureRow
    | { key: string; label: string; group: PlanFeatureGroup; baseline: true }
    | { key: string; label: string; group: PlanFeatureGroup; minSortOrder: number }
    | { key: string; label: string; managedOnly: true }
  >;
};

/** Builds Compare sections by product module — baseline + paid rows share a header. */
export function planFeatureMatrixGroups(plans: OrgBundlePlanDto[]): PlanFeatureMatrixGroup[] {
  const meaningful = PLAN_FEATURE_ROWS.filter((row) =>
    plans.some((plan) => row.value(plan.features).kind !== 'off')
  );
  const hasManaged = plans.some((plan) => plan.code === MANAGED_PLAN_CODE);

  return PLAN_FEATURE_GROUP_ORDER.map((group) => {
    const baselineRows = PLAN_BASELINE_MATRIX_ROWS.filter((row) => row.group === group).map(
      (row) => ({ ...row, baseline: true as const })
    );
    const starterRows = PLAN_STARTER_MATRIX_ROWS.filter((row) => row.group === group);
    const featureRows = meaningful.filter((row) => row.group === group);
    const managedExtra = group === 'managed' && hasManaged ? PLAN_MANAGED_MATRIX_ROWS : [];

    const rows = [...baselineRows, ...starterRows, ...featureRows, ...managedExtra];
    return {
      group,
      label: PLAN_FEATURE_GROUP_LABELS[group],
      rows,
    };
  }).filter((entry) => entry.rows.length > 0);
}

export type PlanFeatureChange = {
  key: string;
  label: string;
};

/** Capabilities `to` has that `from` does not, in matrix order. */
export function planFeatureGains(from: PlanFeatures | null, to: PlanFeatures): PlanFeatureChange[] {
  return PLAN_FEATURE_ROWS.filter((row) => {
    const target = row.rank(to);
    if (target <= 0) return false;
    return from === null || target > row.rank(from);
  }).map((row) => ({ key: row.key, label: row.describe(to) }));
}

const CELEBRATION_GAIN_LIMIT = 8;

/** Highlights for the post-checkout success modal — upgrade deltas first, then tier card bullets. */
export function resolveUpgradeCelebrationGains(
  previous: OrgBundlePlanDto | null,
  target: OrgBundlePlanDto
): PlanFeatureChange[] {
  const deltas =
    previous && previous.id !== target.id
      ? planFeatureGains(previous.features, target.features)
      : [];
  if (deltas.length > 0) return deltas.slice(0, CELEBRATION_GAIN_LIMIT);

  const labels = PLAN_TIER_CARD_GAINS[target.code] ?? [];
  return labels.slice(0, CELEBRATION_GAIN_LIMIT).map((label, index) => ({
    key: `celebration-${target.code}-${index}`,
    label,
  }));
}

/** Capabilities `from` has that `to` drops — the honest half of a downgrade. */
export function planFeatureLosses(from: PlanFeatures, to: PlanFeatures): PlanFeatureChange[] {
  return PLAN_FEATURE_ROWS.filter((row) => {
    const current = row.rank(from);
    if (current <= 0) return false;
    return row.rank(to) < current;
  }).map((row) => ({ key: row.key, label: row.describe(from) }));
}

/** How many capabilities a tier actually turns on — Free is legitimately zero. */
export function planCapabilityCount(features: PlanFeatures): number {
  return PLAN_FEATURE_ROWS.filter((row) => row.rank(features) > 0).length;
}

export type PlanTier = {
  plan: OrgBundlePlanDto;
  /** Tier immediately below — the card's "everything in …" anchor. */
  previous: OrgBundlePlanDto | null;
  isCurrent: boolean;
  /** Highlighted as the catalog's recommended upgrade tier (not necessarily the next rung). */
  isNextStep: boolean;
  direction: PlanChangeDirection;
  /** Capabilities this tier adds over `previous`. */
  gains: PlanFeatureChange[];
  /** False when the tier below adds nothing, so the card skips the "everything in …" line. */
  inheritsFrom: string | null;
};

export type PlanChangeDirection = 'current' | 'upgrade' | 'downgrade';

/** True when moving to Free or a lower ladder tier — self-serve, no PayMongo. */
export function isPlanDowngrade(
  currentPlan: OrgBundlePlanDto | null | undefined,
  targetPlan: OrgBundlePlanDto
): boolean {
  if (!currentPlan || currentPlan.id === targetPlan.id) return false;
  if (targetPlan.isDefault) return !currentPlan.isDefault;
  if (currentPlan.isDefault) return false;
  return targetPlan.sortOrder < currentPlan.sortOrder;
}

/** Internal plan code for the tier we recommend hosts upgrade to (`pro` = Business). */
export const RECOMMENDED_PLAN_CODE = 'pro';

/** Managed tier — sales-assisted; no self-serve checkout. */
export const MANAGED_PLAN_CODE = 'managed';

/** Prefilled support ticket subject when a host asks about Managed. */
export const MANAGED_PLAN_INQUIRY_SUBJECT = 'Managed plan inquiry';

export function isManagedSalesPlan(code: string): boolean {
  return code === MANAGED_PLAN_CODE;
}

/** UI gate for self-serve downgrade confirm — mirrors server `validateOrgPlanDowngradeRequest`. */
export function resolveDowngradeBlockedReason(input: {
  subscriptionStatus?: string | null;
  currentPlanCode?: string | null;
  targetPlan: OrgBundlePlanDto;
}): string | null {
  if (input.currentPlanCode === MANAGED_PLAN_CODE) {
    return 'Contact support to change your Managed plan.';
  }
  if (input.subscriptionStatus === 'past_due') {
    return 'Pay the overdue balance from Billing before downgrading.';
  }
  if (input.subscriptionStatus === 'suspended' && !input.targetPlan.isDefault) {
    return 'Pay to restore access before switching to a different paid plan.';
  }
  return null;
}

/** Free tier row — every org is on this plan when there is no live org subscription. */
export function resolveDefaultPlan(plans: OrgBundlePlanDto[]): OrgBundlePlanDto | null {
  return plans.find((plan) => plan.isDefault) ?? plans.find((plan) => plan.code === 'free') ?? null;
}

/** Plan id for tier highlighting — paid subscription when present, otherwise Free (mirrors server entitlements). */
export function resolveEffectiveCurrentPlanId(
  plans: OrgBundlePlanDto[],
  subscriptionPlanId: string | undefined | null
): string | undefined {
  if (subscriptionPlanId && plans.some((plan) => plan.id === subscriptionPlanId)) {
    return subscriptionPlanId;
  }
  return resolveDefaultPlan(plans)?.id;
}

export function resolveEffectiveCurrentPlan(
  plans: OrgBundlePlanDto[],
  subscriptionPlanId: string | undefined | null
): OrgBundlePlanDto | null {
  const planId = resolveEffectiveCurrentPlanId(plans, subscriptionPlanId);
  if (!planId) return null;
  return plans.find((plan) => plan.id === planId) ?? null;
}

/** Sorted ladder with each tier's position relative to the active subscription. */
export function buildPlanTiers(
  plans: OrgBundlePlanDto[],
  currentPlanId: string | undefined
): PlanTier[] {
  const ordered = [...plans].sort((a, b) => a.sortOrder - b.sortOrder);
  const currentIndex = ordered.findIndex((plan) => plan.id === currentPlanId);

  return ordered.map((plan, index) => {
    const previous = index > 0 ? ordered[index - 1] : null;
    const isCurrent = currentIndex >= 0 && index === currentIndex;

    let direction: PlanChangeDirection = 'upgrade';
    if (isCurrent) direction = 'current';
    else if (currentIndex >= 0 && index < currentIndex) direction = 'downgrade';

    const cardGains = resolveTierCardGains(plan, previous);

    return {
      plan,
      previous,
      isCurrent,
      isNextStep: plan.code === RECOMMENDED_PLAN_CODE && !isCurrent && direction === 'upgrade',
      direction,
      gains: cardGains,
      inheritsFrom: previous && plan.code !== 'free' ? planDisplayName(previous) : null,
    };
  });
}

/** Min height (px) for the feature list block so every tier card aligns in the rail. */
export const PLAN_TIER_GAIN_ROW_MIN_HEIGHT = 28;
export const PLAN_TIER_GAIN_ROW_GAP = 8;
const PLAN_TIER_INHERITS_BLOCK_MIN_HEIGHT = 32;

export function planTierFeatureAreaMinHeight(tiers: PlanTier[]): number {
  const maxGains = Math.max(0, ...tiers.map((tier) => tier.gains.length));
  const rows = Math.max(maxGains, 1);
  const listHeight = rows * PLAN_TIER_GAIN_ROW_MIN_HEIGHT + (rows - 1) * PLAN_TIER_GAIN_ROW_GAP;
  return PLAN_TIER_INHERITS_BLOCK_MIN_HEIGHT + listHeight;
}

/** Next tier above the active plan on the sorted ladder — null when already on the highest tier. */
export function nextUpgradePlan(
  plans: OrgBundlePlanDto[],
  currentPlanId: string | undefined
): OrgBundlePlanDto | null {
  const ordered = [...plans].sort((a, b) => a.sortOrder - b.sortOrder);
  const currentIndex = ordered.findIndex((plan) => plan.id === currentPlanId);
  if (currentIndex < 0) return ordered[0] ?? null;
  return ordered[currentIndex + 1] ?? null;
}

/** Lowest-`sortOrder` plan that has `feature` enabled — the specific tier a gated action needs. */
export function resolveMinimumPlanForFeature(
  plans: OrgBundlePlanDto[],
  feature: PlanFeatureKey
): OrgBundlePlanDto | null {
  const candidates = plans
    .filter((plan) => isFeatureEnabled(plan.features, feature))
    .sort((a, b) => a.sortOrder - b.sortOrder);
  return candidates[0] ?? null;
}

/**
 * Plan to offer when a feature gate fires — next tier when the org already has the feature
 * (e.g. Free with team seats at cap needs Starter, not another Free review).
 *
 * Pass `propertyHasFeature: false` when the property is below the org tier (unenrolled /
 * Free fallback) so we re-offer the **current** plan (update billing / cover properties)
 * instead of jumping to the next ladder step (Pro → Business).
 */
export function resolveUpgradePlanForFeature(
  plans: OrgBundlePlanDto[],
  feature: PlanFeatureKey,
  currentPlanId: string | undefined | null,
  propertyHasFeature?: boolean | null
): OrgBundlePlanDto | null {
  const minimum = resolveMinimumPlanForFeature(plans, feature);
  if (!minimum) return null;

  const current =
    currentPlanId != null ? (plans.find((plan) => plan.id === currentPlanId) ?? null) : null;

  if (current && isFeatureEnabled(current.features, feature)) {
    // Org plan already includes the feature, but this property does not → enroll / update billing.
    if (propertyHasFeature === false) return current;
    return nextUpgradePlan(plans, current.id);
  }

  return minimum;
}

/**
 * Badge label plan when a property-scoped gate is closed — prefer the org's current tier when
 * it already includes `feature` (unenrolled property), otherwise the minimum tier that unlocks it.
 */
export function resolveGateBadgePlan(
  plans: OrgBundlePlanDto[],
  feature: PlanFeatureKey,
  currentPlanId: string | undefined | null
): OrgBundlePlanDto | null {
  const current =
    currentPlanId != null ? (plans.find((plan) => plan.id === currentPlanId) ?? null) : null;
  if (current && isFeatureEnabled(current.features, feature)) return current;
  return resolveMinimumPlanForFeature(plans, feature);
}

/** Primary CTA on the current-plan banner when a higher tier exists. */
export function upgradeBannerActionLabel(plan: OrgBundlePlanDto): string {
  if (isManagedSalesPlan(plan.code)) return 'Contact sales';
  return `Upgrade to ${planDisplayName(plan)}`;
}

export function planActionLabel(
  direction: PlanChangeDirection,
  hasCurrent: boolean,
  planCode?: string
): string {
  if (direction === 'current') return 'Current plan';
  if (planCode && isManagedSalesPlan(planCode)) return 'Contact sales';
  if (!hasCurrent) return 'Choose plan';
  return direction === 'downgrade' ? 'Downgrade' : 'Upgrade';
}

export type PlanPrice = {
  amount: string;
  /** Empty for free tiers so the card does not render a dangling `/month`. */
  suffix: string;
  /** Strikethrough list price when a discount is active. */
  compareAtAmount?: string;
  discountPercent?: number;
};

/** Host-facing discount label copy — whole percent only. */
export function planDiscountLabel(discountPercent: number): string {
  const percent = Math.floor(discountPercent);
  if (percent <= 0) return '';
  return `${percent}% off`;
}

export const PESO_WHOLE = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

export function planPrice(
  plan: Pick<
    OrgBundlePlanDto,
    'isDefault' | 'pricePhp' | 'pricingModel' | 'code' | 'discountPercent'
  > & {
    /** Locked-in subscription amount — skips list/discount math. */
    chargedPricePhp?: number | null;
  }
): PlanPrice {
  if (plan.pricingModel === 'commission') {
    return { amount: '8% fee', suffix: 'per booking' };
  }

  if (plan.chargedPricePhp != null && Number.isFinite(plan.chargedPricePhp)) {
    const charged = Math.max(0, Math.floor(plan.chargedPricePhp));
    if (plan.isDefault || charged <= 0) return { amount: PESO_WHOLE.format(0), suffix: '/month' };
    return { amount: PESO_WHOLE.format(charged), suffix: '/month' };
  }

  const listPhp = Math.max(0, Math.floor(plan.pricePhp ?? 0));
  // No locked-in subscription total — show the tier's promo per-property rate (billing scales
  // with enrolled count; suffix matches whole-org totals as `/month`).
  if (plan.isDefault || listPhp <= 0) {
    return { amount: PESO_WHOLE.format(0), suffix: '/month' };
  }

  const discountPercent = normalizePlanDiscountPercent(plan.discountPercent);
  const effectivePhp = discountedPlanPricePhp(listPhp, discountPercent);

  const result: PlanPrice = {
    amount: PESO_WHOLE.format(effectivePhp),
    suffix: '/month',
  };

  if (discountPercent > 0 && effectivePhp < listPhp) {
    result.compareAtAmount = PESO_WHOLE.format(listPhp);
    result.discountPercent = discountPercent;
  }

  return result;
}

/** One-line host-facing pitch — shown on tier cards below the plan name. */
const PLAN_HOST_PITCH: Record<string, string> = {
  free: 'Essential tools to manage your properties at no cost.',
  starter: 'Automate everyday operations and manage your team with ease.',
  growth: 'Reach more guests with greater publishing and search visibility.',
  pro: '    Simplify your management with AI-powered features.',
  managed: 'Let us handle your operations while you focus on growing your business.',
  commission: 'Pay only when you earn from a completed booking. No monthly fee.',
};

const WEAK_TAGLINES = new Set([
  'free',
  'starter',
  'growth',
  'pro',
  'managed',
  'level 1',
  'level 2',
  'level 3',
  'level 4',
  'level 5',
]);

/** Host-facing titles — stable catalog names, not internal "Level N" DB labels. */
export const PLAN_CODE_DISPLAY_NAME: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  growth: 'Pro',
  pro: 'Business',
  managed: 'Managed',
  commission: 'Commission',
};

/** Marketing pill on the card edge — not the same as the current-plan state. */
export const PLAN_PROMO_BADGE: Record<string, string> = {
  starter: 'Best value',
  growth: 'Most popular',
  pro: 'Recommended',
  managed: 'Hands-off hosting',
};

export function planPromoBadge(code: string): string | null {
  return PLAN_PROMO_BADGE[code] ?? null;
}

/** Plan title for hosts — prefers catalog name by `code`, not `pricing_plans.name`. */
export function planDisplayName(plan: Pick<OrgBundlePlanDto, 'code' | 'name' | 'tagline'>): string {
  const fromCode = PLAN_CODE_DISPLAY_NAME[plan.code];
  if (fromCode) return fromCode;

  const tagline = plan.tagline?.trim();
  if (tagline && !WEAK_TAGLINES.has(tagline.toLowerCase())) return tagline;

  return plan.name.trim() || 'Plan';
}

/** Resolve a stored subscription label when the full plan row is unavailable. */
export function planDisplayNameFromSubscription(
  subscription: Pick<OrgSubscriptionDto, 'planCode' | 'planName'> | null
): string {
  if (!subscription) return '';
  const fromCode = PLAN_CODE_DISPLAY_NAME[subscription.planCode];
  if (fromCode) return fromCode;
  return subscription.planName?.trim() || 'Plan';
}

/** Primary for upgrades; outline for current plan and downgrades; primary outline for Managed (Contact sales). */
export function planSelectButtonVariant(
  isCurrent: boolean,
  direction: PlanChangeDirection,
  planCode?: string
): 'default' | 'outline' | 'outline-primary' {
  if (isCurrent || direction === 'downgrade') return 'outline';
  if (planCode && isManagedSalesPlan(planCode)) return 'outline-primary';
  return 'default';
}

/** Card subtitle — prefers a host pitch over catalog taglines like "Starter". */
export function planTierPitch(plan: OrgBundlePlanDto): string | null {
  const pitch = PLAN_HOST_PITCH[plan.code];
  if (pitch) return pitch;

  const tagline = plan.tagline?.trim();
  if (!tagline) return null;
  if (WEAK_TAGLINES.has(tagline.toLowerCase())) return null;
  if (tagline === plan.name) return null;

  const price = planPrice(plan);
  if (tagline === price.amount) return null;

  return tagline;
}

export const PLANS_PAGE_SUBTITLE =
  'Manage your organization’s subscription. One plan covers every property you enroll.';

export type PlanFaqItem = {
  question: string;
  answer: string;
};

/** Host-facing billing FAQs — aligned with org-level PayMongo subscriptions. */
export const PLAN_FAQ_ITEMS: PlanFaqItem[] = [
  {
    question: 'Can I change my plan at any time?',
    answer:
      'Yes. Organization owners can switch tiers or add/remove properties from Plans & Billing at any time. Paid changes open PayMongo checkout and take effect once payment clears. Moving to Free applies immediately.',
  },
  {
    question: 'Is pricing per property or per organization?',
    answer:
      'Billing is per organization, priced per enrolled property. Your total is the tier’s per-property rate times how many properties you enroll, with the rate dropping at volume breakpoints. A property left out of your subscription stays on Free.',
  },
  {
    question: 'How does monthly billing work?',
    answer:
      'Paid plans renew every month. Before each renewal you’ll get a payment link by email and on the Billing tab. Pay with QRPH, Maya, or online banking through PayMongo. We never store card or bank details on our platform.',
  },
  {
    question: 'What happens if I miss a renewal payment?',
    answer:
      'Your organization becomes past due. You keep full dashboard access during the grace period. If payment is still missing after grace ends, access across your properties is limited to Plans & Billing and Help & Support until you pay. Guest forms and bookings keep working.',
  },
  {
    question: 'What happens when I downgrade or remove a property?',
    answer:
      'Downgrades take effect immediately while your subscription is active or in trial, not while past due (pay from Billing first). If suspended, you can move to Free to cancel; other downgrades require paying to restore access first. Features above your new tier turn off org-wide. Removing a property credits its remaining value toward your next bill; unused time on a downgrade is not refunded as cash.',
  },
  {
    question: 'How do AI credits work?',
    answer:
      'Higher tiers include a monthly AI credit allowance for tools like receipt validation, the dashboard assistant, and marketing generation. Your allowance updates when you change plans. Free and Starter do not include AI credits.',
  },
  {
    question: 'How do I get the Managed plan?',
    answer:
      'Managed is sales-assisted. Choose Contact sales on the Managed card to open a Help & Support ticket. Our team will walk you through onboarding and pricing for hands-off hosting.',
  },
];

/** Shared section heading for Plans / Compare / Billing tab bodies. */
export const planTabSectionTitleClass =
  'text-foreground text-base font-semibold tracking-tight sm:text-lg';

type SubscriptionStatusMeta = {
  label: string;
  tone: 'success' | 'secondary' | 'destructive';
};

const SUBSCRIPTION_STATUS_META: Record<string, SubscriptionStatusMeta> = {
  active: { label: 'Active', tone: 'success' },
  trialing: { label: 'Trial', tone: 'secondary' },
  past_due: { label: 'Past due', tone: 'destructive' },
  suspended: { label: 'Suspended', tone: 'destructive' },
  canceled: { label: 'Cancelled', tone: 'secondary' },
};

export function subscriptionStatusMeta(status: string): SubscriptionStatusMeta {
  return SUBSCRIPTION_STATUS_META[status] ?? { label: status, tone: 'secondary' };
}

/** Deadline before a past-due subscription loses dashboard access. */
export function subscriptionGraceLabel(subscription: OrgSubscriptionDto | null): string | null {
  if (!subscription?.gracePeriodEndsAt) return null;
  const formatted = formatManilaLongDate(subscription.gracePeriodEndsAt);
  if (!formatted || formatted === '-') return null;
  return formatted;
}

/** Renewal line for the current-plan panel — omitted entirely when the period is unset. */
export function subscriptionRenewalLabel(subscription: OrgSubscriptionDto | null): string | null {
  if (!subscription?.currentPeriodEnd) return null;
  const formatted = formatManilaLongDate(subscription.currentPeriodEnd);
  if (!formatted || formatted === '-') return null;
  return formatted;
}

const QUICK_FACT_KEYS = [
  'teamManagement',
  'aiMonthlyCreditAllowance',
  'searchVisibilityTier',
] as const;

/**
 * Measured allowances on the active plan. Rows the plan does not include are dropped
 * rather than stacked up as "Not included" — the tier ladder below tells that story.
 */
export function planQuickFacts(features: PlanFeatures): { label: string; value: string }[] {
  return QUICK_FACT_KEYS.flatMap((key) => {
    const row = PLAN_FEATURE_ROWS.find((entry) => entry.key === key)!;
    const value = row.value(features);
    if (value.kind === 'off') return [];
    return [{ label: row.label, value: value.kind === 'text' ? value.text : 'Included' }];
  });
}
