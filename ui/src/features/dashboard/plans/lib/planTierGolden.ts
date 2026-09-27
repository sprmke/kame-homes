/**
 * Golden plan tier catalog for tests. NOT imported by app code.
 *
 * Values are the final state of the `pricing_plans` seed migrations
 * (verified against a local `db:reset` catalog, see `bun run check:plan-catalog`)
 * and match docs/architecture/plans-feature-matrix.md.
 *
 * Changing a tier on purpose? Update this file, the seed migration, and the docs in the
 * same change. Tests in this folder fail when any of the three drift apart.
 */

import type { OrgBundlePlanDto } from '@/features/dashboard/plans/lib/orgPlanApi';
import type { PlanFeatures } from '@/features/dashboard/plans/lib/planFeatures';

export type GoldenVolumeTier = { minProperties: number; discountPercent: number };

export type GoldenPlan = {
  /** Internal code. `growth` displays as Pro and `pro` as Business. */
  code: string;
  displayName: string;
  sortOrder: number;
  /** Per-property monthly rate in PHP before discounts. */
  pricePhp: number;
  discountPercent: number;
  volumeDiscountTiers: GoldenVolumeTier[];
  isActive: boolean;
  isDefault: boolean;
  features: PlanFeatures;
};

export const GOLDEN_FREE: GoldenPlan = {
  code: 'free',
  displayName: 'Free',
  sortOrder: 1,
  pricePhp: 0,
  discountPercent: 0,
  volumeDiscountTiers: [],
  isActive: true,
  isDefault: true,
  features: {
    activityLogExport: false,
    aiChatAutoReply: false,
    aiDashboardAssistant: false,
    aiMarketingGeneration: false,
    aiMarketingImageGeneration: false,
    aiMarketingVideoGeneration: false,
    aiMonthlyCreditAllowance: 0,
    aiReceptionist: false,
    aiValidations: false,
    analyticsInsights: false,
    automatedBookingFlow: false,
    bookingImport: false,
    calendarSync: false,
    copyPropertySettings: false,
    customPages: true,
    customRoles: false,
    customTemplates: false,
    financeReporting: false,
    fullyManagedByPlatform: false,
    maintenanceReporting: false,
    marketingPublishLimitPerGroup: 0,
    marketingStudio: false,
    metaChatChannel: false,
    propertyShowcase: false,
    publicPagesAutosave: false,
    quickReplies: false,
    recommendedBadgeEligible: false,
    searchVisibilityTier: 'none',
    smartPricing: false,
    teamManagement: {
      enabled: true,
      maxMembers: 1,
    },
    telegramNotifications: false,
    verifiedBadgeEligible: false,
  } as PlanFeatures,
};

export const GOLDEN_STARTER: GoldenPlan = {
  code: 'starter',
  displayName: 'Starter',
  sortOrder: 2,
  pricePhp: 499,
  discountPercent: 20,
  volumeDiscountTiers: [
    { minProperties: 10, discountPercent: 0 },
    { minProperties: 20, discountPercent: 8 },
    { minProperties: 50, discountPercent: 20 },
    { minProperties: 100, discountPercent: 35 },
    { minProperties: 200, discountPercent: 50 },
    { minProperties: 300, discountPercent: 60 },
  ],
  isActive: true,
  isDefault: false,
  features: {
    activityLogExport: true,
    aiChatAutoReply: false,
    aiDashboardAssistant: false,
    aiMarketingGeneration: false,
    aiMarketingImageGeneration: false,
    aiMarketingVideoGeneration: false,
    aiMonthlyCreditAllowance: 0,
    aiReceptionist: false,
    aiValidations: false,
    analyticsInsights: false,
    automatedBookingFlow: true,
    bookingImport: true,
    calendarSync: false,
    copyPropertySettings: false,
    customPages: true,
    customRoles: true,
    customTemplates: true,
    financeReporting: true,
    fullyManagedByPlatform: false,
    maintenanceReporting: true,
    marketingPublishLimitPerGroup: 0,
    marketingStudio: false,
    metaChatChannel: false,
    propertyShowcase: false,
    publicPagesAutosave: false,
    quickReplies: true,
    recommendedBadgeEligible: false,
    searchVisibilityTier: 'none',
    smartPricing: false,
    teamManagement: {
      enabled: true,
      maxMembers: 3,
    },
    telegramNotifications: true,
    verifiedBadgeEligible: true,
  } as PlanFeatures,
};

export const GOLDEN_PRO: GoldenPlan = {
  code: 'growth',
  displayName: 'Pro',
  sortOrder: 3,
  pricePhp: 999,
  discountPercent: 20,
  volumeDiscountTiers: [
    { minProperties: 10, discountPercent: 37 },
    { minProperties: 20, discountPercent: 45 },
    { minProperties: 50, discountPercent: 62 },
    { minProperties: 100, discountPercent: 78 },
    { minProperties: 200, discountPercent: 85 },
    { minProperties: 300, discountPercent: 88 },
  ],
  isActive: true,
  isDefault: false,
  features: {
    activityLogExport: true,
    aiChatAutoReply: false,
    aiDashboardAssistant: false,
    aiMarketingGeneration: false,
    aiMarketingImageGeneration: true,
    aiMarketingVideoGeneration: false,
    aiMonthlyCreditAllowance: 5000,
    aiReceptionist: false,
    aiValidations: true,
    analyticsInsights: true,
    automatedBookingFlow: true,
    bookingImport: true,
    calendarSync: true,
    copyPropertySettings: true,
    customPages: true,
    customRoles: true,
    customTemplates: true,
    financeReporting: true,
    fullyManagedByPlatform: false,
    maintenanceReporting: true,
    marketingPublishLimitPerGroup: 0,
    marketingStudio: true,
    metaChatChannel: false,
    propertyShowcase: true,
    publicPagesAutosave: true,
    quickReplies: true,
    recommendedBadgeEligible: true,
    searchVisibilityTier: 'top30',
    smartPricing: true,
    teamManagement: {
      enabled: true,
      maxMembers: 5,
    },
    telegramNotifications: true,
    verifiedBadgeEligible: true,
  } as PlanFeatures,
};

export const GOLDEN_BUSINESS: GoldenPlan = {
  code: 'pro',
  displayName: 'Business',
  sortOrder: 4,
  pricePhp: 1799,
  discountPercent: 20,
  volumeDiscountTiers: [
    { minProperties: 10, discountPercent: 65 },
    { minProperties: 20, discountPercent: 70 },
    { minProperties: 50, discountPercent: 78 },
    { minProperties: 100, discountPercent: 85 },
    { minProperties: 200, discountPercent: 90 },
    { minProperties: 300, discountPercent: 93 },
  ],
  isActive: true,
  isDefault: false,
  features: {
    activityLogExport: true,
    aiChatAutoReply: true,
    aiDashboardAssistant: true,
    aiMarketingGeneration: true,
    aiMarketingImageGeneration: true,
    aiMarketingVideoGeneration: true,
    aiMonthlyCreditAllowance: 25000,
    aiReceptionist: true,
    aiValidations: true,
    analyticsInsights: true,
    automatedBookingFlow: true,
    bookingImport: true,
    calendarSync: true,
    copyPropertySettings: true,
    customPages: true,
    customRoles: true,
    customTemplates: true,
    financeReporting: true,
    fullyManagedByPlatform: false,
    maintenanceReporting: true,
    marketingPublishLimitPerGroup: null,
    marketingStudio: true,
    metaChatChannel: true,
    propertyShowcase: true,
    publicPagesAutosave: true,
    quickReplies: true,
    recommendedBadgeEligible: true,
    searchVisibilityTier: 'top15',
    smartPricing: true,
    teamManagement: {
      enabled: true,
      maxMembers: 10,
    },
    telegramNotifications: true,
    verifiedBadgeEligible: true,
  } as PlanFeatures,
};

// Retired: keys missing in the DB row are filled with defaults.
export const GOLDEN_BUSINESS_PLUS: GoldenPlan = {
  code: 'business_plus',
  displayName: 'Business Plus',
  sortOrder: 5,
  pricePhp: 2999,
  discountPercent: 20,
  volumeDiscountTiers: [],
  isActive: false,
  isDefault: false,
  features: {
    activityLogExport: true,
    aiChatAutoReply: true,
    aiDashboardAssistant: true,
    aiMarketingGeneration: true,
    aiMarketingImageGeneration: true,
    aiMarketingVideoGeneration: true,
    aiMonthlyCreditAllowance: 50000,
    aiReceptionist: true,
    aiValidations: true,
    analyticsInsights: true,
    automatedBookingFlow: true,
    bookingImport: false,
    calendarSync: true,
    copyPropertySettings: true,
    customPages: true,
    customRoles: false,
    customTemplates: true,
    financeReporting: true,
    fullyManagedByPlatform: false,
    maintenanceReporting: true,
    marketingPublishLimitPerGroup: null,
    marketingStudio: true,
    metaChatChannel: true,
    propertyShowcase: false,
    publicPagesAutosave: true,
    quickReplies: true,
    recommendedBadgeEligible: true,
    searchVisibilityTier: 'top10',
    smartPricing: true,
    teamManagement: {
      enabled: true,
      maxMembers: 15,
    },
    telegramNotifications: true,
    verifiedBadgeEligible: true,
  } as PlanFeatures,
};

export const GOLDEN_MANAGED: GoldenPlan = {
  code: 'managed',
  displayName: 'Managed',
  sortOrder: 6,
  pricePhp: 4999,
  discountPercent: 20,
  volumeDiscountTiers: [
    { minProperties: 10, discountPercent: 87 },
    { minProperties: 20, discountPercent: 89 },
    { minProperties: 50, discountPercent: 92 },
    { minProperties: 100, discountPercent: 94 },
    { minProperties: 200, discountPercent: 96 },
    { minProperties: 300, discountPercent: 97 },
  ],
  isActive: true,
  isDefault: false,
  features: {
    activityLogExport: true,
    aiChatAutoReply: true,
    aiDashboardAssistant: true,
    aiMarketingGeneration: true,
    aiMarketingImageGeneration: true,
    aiMarketingVideoGeneration: true,
    aiMonthlyCreditAllowance: 60000,
    aiReceptionist: true,
    aiValidations: true,
    analyticsInsights: true,
    automatedBookingFlow: true,
    bookingImport: true,
    calendarSync: true,
    copyPropertySettings: true,
    customPages: true,
    customRoles: true,
    customTemplates: true,
    financeReporting: true,
    fullyManagedByPlatform: true,
    maintenanceReporting: true,
    marketingPublishLimitPerGroup: null,
    marketingStudio: true,
    metaChatChannel: true,
    propertyShowcase: true,
    publicPagesAutosave: true,
    quickReplies: true,
    recommendedBadgeEligible: true,
    searchVisibilityTier: 'top15',
    smartPricing: true,
    teamManagement: {
      enabled: true,
      maxMembers: null,
    },
    telegramNotifications: true,
    verifiedBadgeEligible: true,
  } as PlanFeatures,
};

/** Tiers sold today, ascending. */
export const GOLDEN_SOLD_PLANS: GoldenPlan[] = [
  GOLDEN_FREE,
  GOLDEN_STARTER,
  GOLDEN_PRO,
  GOLDEN_BUSINESS,
  GOLDEN_MANAGED,
];

/** Retired plans kept in the DB (inactive) and never shown to hosts. */
export const GOLDEN_RETIRED_PLANS: GoldenPlan[] = [GOLDEN_BUSINESS_PLUS];

export const GOLDEN_ALL_PLANS: GoldenPlan[] = [...GOLDEN_SOLD_PLANS, ...GOLDEN_RETIRED_PLANS];

/** Plan id used by every test/E2E fixture built from the golden catalog. */
export function goldenPlanId(code: string): string {
  return `plan-${code}`;
}

/** Golden plan in the shape the Plans UI and `org-plan` / public pricing endpoints return. */
export function goldenPlanDto(plan: GoldenPlan): OrgBundlePlanDto {
  return {
    id: goldenPlanId(plan.code),
    code: plan.code,
    name: plan.displayName,
    tagline: null,
    sortOrder: plan.sortOrder,
    pricingModel: 'subscription',
    pricePhp: plan.pricePhp,
    discountPercent: plan.discountPercent,
    volumeDiscountTiers: plan.volumeDiscountTiers,
    volumeRampFloorPhp: 500,
    volumeRampAtCount: 10,
    features: plan.features,
    isDefault: plan.isDefault,
  };
}

export function goldenSoldPlanDtos(): OrgBundlePlanDto[] {
  return GOLDEN_SOLD_PLANS.map(goldenPlanDto);
}

/** Lowest sold tier code that unlocks each feature (independent of `isFeatureEnabled`). */
export const GOLDEN_MINIMUM_TIER: Record<keyof PlanFeatures, string> = {
  automatedBookingFlow: 'starter',
  verifiedBadgeEligible: 'starter',
  recommendedBadgeEligible: 'growth',
  telegramNotifications: 'starter',
  teamManagement: 'free',
  searchVisibilityTier: 'growth',
  marketingPublishLimitPerGroup: 'pro',
  aiValidations: 'growth',
  aiMonthlyCreditAllowance: 'growth',
  marketingStudio: 'growth',
  customPages: 'free',
  propertyShowcase: 'growth',
  aiDashboardAssistant: 'pro',
  aiReceptionist: 'pro',
  aiMarketingGeneration: 'pro',
  aiMarketingImageGeneration: 'growth',
  aiMarketingVideoGeneration: 'pro',
  aiChatAutoReply: 'pro',
  fullyManagedByPlatform: 'managed',
  financeReporting: 'starter',
  maintenanceReporting: 'starter',
  metaChatChannel: 'pro',
  quickReplies: 'starter',
  customTemplates: 'starter',
  publicPagesAutosave: 'growth',
  bookingImport: 'starter',
  calendarSync: 'growth',
  smartPricing: 'growth',
  customRoles: 'starter',
  copyPropertySettings: 'growth',
  analyticsInsights: 'growth',
  activityLogExport: 'starter',
};
