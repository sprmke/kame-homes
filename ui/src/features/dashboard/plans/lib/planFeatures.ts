/** Hand-mirror of supabase/functions/_shared/planFeatures.ts — keep in sync. */

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
  /** Connect Airbnb calendar for two-way iCal sync. */
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

export type PlanFeatureKey = keyof PlanFeatures;

export type PropertyEntitlements = PlanFeatures & {
  planId: string;
  planCode: string;
  planName: string;
  pricingModel: string;
  status: string;
  propertySubscriptionId: string;
};

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

export function countPropertyTeamSlotsUsed(
  members: Array<{ status?: string }>,
  invitations: unknown[]
): number {
  const activeMembers = members.filter((member) => member.status !== 'inactive').length;
  const firstInvitation = invitations[0];
  const pendingInvitations =
    firstInvitation &&
    typeof firstInvitation === 'object' &&
    firstInvitation !== null &&
    'status' in firstInvitation
      ? invitations.filter(
          (invitation) =>
            typeof invitation === 'object' &&
            invitation !== null &&
            (invitation as { status?: string }).status === 'pending'
        ).length
      : 0;
  return activeMembers + pendingInvitations;
}

export function canInviteTeamMember(
  entitlements: PlanFeatures | undefined,
  slotsUsed: number
): boolean {
  if (!entitlements?.teamManagement.enabled) return false;
  const max = entitlements.teamManagement.maxMembers;
  if (max === null) return true;
  return slotsUsed < max;
}

export type TeamInviteCapacity = {
  slotsUsed: number;
  maxMembers: number | null;
  teamManagementEnabled: boolean;
  canInvite: boolean;
};

export const PLAN_FEATURE_LABELS: Record<keyof PlanFeatures, string> = {
  automatedBookingFlow: 'Automated booking emails',
  verifiedBadgeEligible: 'Verified badge eligible',
  recommendedBadgeEligible: 'Recommended badge eligible',
  telegramNotifications: 'Telegram alerts',
  teamManagement: 'Team members',
  searchVisibilityTier: 'Search placement',
  marketingPublishLimitPerGroup: 'Publish in Meta platforms',
  aiValidations: 'AI receipt and ID validation',
  aiMonthlyCreditAllowance: 'AI credits',
  marketingStudio: 'Content Studio',
  customPages: 'Public pages gallery & editor',
  propertyShowcase: 'Property showcase & stay guide access',
  aiDashboardAssistant: 'AI dashboard assistant',
  aiReceptionist: 'AI receptionist',
  aiMarketingGeneration: 'AI content generation',
  aiMarketingImageGeneration: 'AI image generation',
  aiMarketingVideoGeneration: 'AI video generation',
  aiChatAutoReply: 'AI chat auto-reply',
  fullyManagedByPlatform: 'Full-service property management',
  financeReporting: 'Finance reporting & export',
  maintenanceReporting: 'Maintenance reporting & export',
  metaChatChannel: 'Meta (Facebook/Instagram) chat channel',
  quickReplies: 'Inbox quick replies',
  customTemplates: 'Advanced template management',
  publicPagesAutosave: 'Public pages editor',
  bookingImport: 'AI booking import',
  calendarSync: 'Airbnb calendar sync',
  smartPricing: 'Smart Pricing',
  customRoles: 'Custom team roles',
  copyPropertySettings: 'Copy property settings',
  analyticsInsights: 'Analytics export and AI review',
  activityLogExport: 'Activity log CSV export',
};
