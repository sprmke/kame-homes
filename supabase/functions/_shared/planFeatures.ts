/**
 * Typed catalog for pricing_plans.features JSONB.
 * Mirror on UI: ui/src/features/dashboard/plans/lib/planFeatures.ts (when added).
 */

export type SearchVisibilityTier = 'none' | 'top30' | 'top15' | 'top20' | 'top10';

export type PlanTeamManagement = {
  enabled: boolean;
  maxMembers: number | null;
};

export type PlanFeatures = {
  automatedBookingFlow: boolean;
  verifiedBadgeEligible: boolean;
  recommendedBadgeEligible: boolean;
  telegramNotifications: boolean;
  teamManagement: PlanTeamManagement;
  searchVisibilityTier: SearchVisibilityTier;
  marketingPublishLimitPerGroup: number | null;
  aiValidations: boolean;
  aiMonthlyCreditAllowance: number;
  marketingStudio: boolean;
  customPages: boolean;
  propertyShowcase: boolean;
  aiDashboardAssistant: boolean;
  aiReceptionist: boolean;
  aiMarketingGeneration: boolean;
  /** Prompt + reference photos in, a finished AI image out (Marketing Studio Generate tab). */
  aiMarketingImageGeneration: boolean;
  /** Prompt + reference photos in, a finished AI video out (Marketing Studio Generate tab, Phase 2). */
  aiMarketingVideoGeneration: boolean;
  aiChatAutoReply: boolean;
  fullyManagedByPlatform: boolean;
  financeReporting: boolean;
  maintenanceReporting: boolean;
  metaChatChannel: boolean;
  quickReplies: boolean;
  customTemplates: boolean;
  publicPagesAutosave: boolean;
  bookingImport: boolean;
  /** Connect external OTA calendars (Airbnb / Booking.com / VRBO) for two-way iCal sync. */
  calendarSync: boolean;
  /** AI-assisted dynamic nightly rates (Smart Pricing) on the Pricing page. */
  smartPricing: boolean;
  customRoles: boolean;
  /** Bulk-copy property settings groups to other properties in the same org. */
  copyPropertySettings: boolean;
  /** Property & org performance analytics — KPIs, forward-looking view, AI review, playbook. */
  analyticsInsights: boolean;
  /** CSV export of the org Activity & Audit Log. In-app viewing stays ungated. */
  activityLogExport: boolean;
};

export const DEFAULT_PLAN_FEATURES: PlanFeatures = {
  automatedBookingFlow: false,
  verifiedBadgeEligible: false,
  recommendedBadgeEligible: false,
  telegramNotifications: false,
  teamManagement: { enabled: false, maxMembers: null },
  searchVisibilityTier: 'none',
  marketingPublishLimitPerGroup: 0,
  aiValidations: false,
  aiMonthlyCreditAllowance: 0,
  marketingStudio: false,
  customPages: false,
  propertyShowcase: false,
  aiDashboardAssistant: false,
  aiReceptionist: false,
  aiMarketingGeneration: false,
  aiMarketingImageGeneration: false,
  aiMarketingVideoGeneration: false,
  aiChatAutoReply: false,
  fullyManagedByPlatform: false,
  financeReporting: false,
  maintenanceReporting: false,
  metaChatChannel: false,
  quickReplies: false,
  customTemplates: false,
  publicPagesAutosave: false,
  bookingImport: false,
  calendarSync: false,
  smartPricing: false,
  customRoles: false,
  copyPropertySettings: false,
  analyticsInsights: false,
  activityLogExport: false,
};

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asNumberOrNull(value: unknown, fallback: number | null): number | null {
  if (value === null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return fallback;
}

function asSearchTier(value: unknown, fallback: SearchVisibilityTier): SearchVisibilityTier {
  if (value === 'none' || value === 'top30' || value === 'top15') return value;
  if (value === 'top20') return 'top30';
  if (value === 'top10') return 'top15';
  return fallback;
}

export function parsePlanFeatures(raw: unknown): PlanFeatures {
  const base = DEFAULT_PLAN_FEATURES;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...base };

  const obj = raw as Record<string, unknown>;
  const teamRaw =
    obj.teamManagement &&
    typeof obj.teamManagement === 'object' &&
    !Array.isArray(obj.teamManagement)
      ? (obj.teamManagement as Record<string, unknown>)
      : {};

  const marketingStudio = asBool(obj.marketingStudio, base.marketingStudio);
  const aiMarketingGeneration = asBool(obj.aiMarketingGeneration, base.aiMarketingGeneration);

  return {
    automatedBookingFlow: asBool(obj.automatedBookingFlow, base.automatedBookingFlow),
    verifiedBadgeEligible: asBool(obj.verifiedBadgeEligible, base.verifiedBadgeEligible),
    recommendedBadgeEligible: asBool(obj.recommendedBadgeEligible, base.recommendedBadgeEligible),
    telegramNotifications: asBool(obj.telegramNotifications, base.telegramNotifications),
    teamManagement: {
      enabled: asBool(teamRaw.enabled, base.teamManagement.enabled),
      maxMembers: asNumberOrNull(teamRaw.maxMembers, base.teamManagement.maxMembers),
    },
    searchVisibilityTier: asSearchTier(obj.searchVisibilityTier, base.searchVisibilityTier),
    marketingPublishLimitPerGroup: asNumberOrNull(
      obj.marketingPublishLimitPerGroup,
      base.marketingPublishLimitPerGroup
    ),
    aiValidations: asBool(obj.aiValidations, base.aiValidations),
    aiMonthlyCreditAllowance:
      typeof obj.aiMonthlyCreditAllowance === 'number' &&
      Number.isFinite(obj.aiMonthlyCreditAllowance)
        ? obj.aiMonthlyCreditAllowance
        : base.aiMonthlyCreditAllowance,
    marketingStudio,
    customPages: asBool(obj.customPages, base.customPages),
    propertyShowcase: asBool(obj.propertyShowcase, base.propertyShowcase),
    aiDashboardAssistant: asBool(obj.aiDashboardAssistant, base.aiDashboardAssistant),
    aiReceptionist: asBool(obj.aiReceptionist, base.aiReceptionist),
    aiMarketingGeneration,
    // Pre-20261316120400 plans only had `marketingStudio` at the same tier (growth+).
    aiMarketingImageGeneration: asBool(
      obj.aiMarketingImageGeneration,
      obj.aiMarketingImageGeneration === undefined
        ? marketingStudio
        : base.aiMarketingImageGeneration
    ),
    // Pre-20261316120500 plans only had `aiMarketingGeneration` at the same tier (pro+).
    aiMarketingVideoGeneration: asBool(
      obj.aiMarketingVideoGeneration,
      obj.aiMarketingVideoGeneration === undefined
        ? aiMarketingGeneration
        : base.aiMarketingVideoGeneration
    ),
    aiChatAutoReply: asBool(obj.aiChatAutoReply, base.aiChatAutoReply),
    fullyManagedByPlatform: asBool(obj.fullyManagedByPlatform, base.fullyManagedByPlatform),
    financeReporting: asBool(obj.financeReporting, base.financeReporting),
    maintenanceReporting: asBool(obj.maintenanceReporting, base.maintenanceReporting),
    metaChatChannel: asBool(obj.metaChatChannel, base.metaChatChannel),
    quickReplies: asBool(obj.quickReplies, base.quickReplies),
    customTemplates: asBool(obj.customTemplates, base.customTemplates),
    publicPagesAutosave: asBool(obj.publicPagesAutosave, base.publicPagesAutosave),
    bookingImport: asBool(obj.bookingImport, base.bookingImport),
    calendarSync: asBool(obj.calendarSync, base.calendarSync),
    smartPricing: asBool(obj.smartPricing, base.smartPricing),
    customRoles: asBool(obj.customRoles, base.customRoles),
    copyPropertySettings: asBool(obj.copyPropertySettings, base.copyPropertySettings),
    analyticsInsights: asBool(obj.analyticsInsights, base.analyticsInsights),
    activityLogExport: asBool(obj.activityLogExport, base.activityLogExport),
  };
}

export function mergePlanFeatures(
  planFeatures: PlanFeatures,
  overrides: Record<string, unknown> | null | undefined
): PlanFeatures {
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
    return planFeatures;
  }
  return parsePlanFeatures({ ...planFeatures, ...overrides });
}

export type PlanFeatureKey = keyof PlanFeatures;

export function isFeatureEnabled(features: PlanFeatures, key: PlanFeatureKey): boolean {
  const value = features[key];
  if (typeof value === 'boolean') return value;
  if (key === 'teamManagement') return features.teamManagement.enabled;
  if (key === 'searchVisibilityTier') return features.searchVisibilityTier !== 'none';
  if (key === 'marketingPublishLimitPerGroup') {
    return (
      features.marketingPublishLimitPerGroup === null || features.marketingPublishLimitPerGroup > 0
    );
  }
  if (key === 'aiMonthlyCreditAllowance') return features.aiMonthlyCreditAllowance > 0;
  return false;
}
