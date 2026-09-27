import type { PlanFeatureKey } from '@/features/dashboard/plans/lib/planFeatures';

/**
 * Where each plan feature shows up in Team permissions.
 * `leaves`: property permission ids whose action needs that plan feature (drives the plan pill in
 * the Team role editor). `na`: no member-level leaf, with the reason.
 * Every `PlanFeatureKey` must appear here; `planFeaturePermissions.test.ts` enforces it.
 */
export type PlanFeaturePermissionCoverage = { leaves: readonly string[] } | { na: string };

export const PLAN_FEATURE_PERMISSION_COVERAGE: Record<
  PlanFeatureKey,
  PlanFeaturePermissionCoverage
> = {
  automatedBookingFlow: { na: 'Workflow automation runs on transitions, not a member action.' },
  verifiedBadgeEligible: { na: 'Owner-only submission (verifyListingOwner), not delegated.' },
  recommendedBadgeEligible: { na: 'Owner-only submission (verifyListingOwner), not delegated.' },
  telegramNotifications: {
    leaves: [
      'notifications.chat:edit',
      'notifications.marketing:edit',
      'notifications.staff:edit',
      'notifications.operations:edit',
      'notifications.finance:edit',
      'notifications.maintenance:edit',
    ],
  },
  teamManagement: { leaves: ['team.invitations:add'] },
  searchVisibilityTier: { na: 'Ranking tier, not an action.' },
  marketingPublishLimitPerGroup: { leaves: ['marketing.publish:add'] },
  aiValidations: {
    na: 'Runs inside bookings.detail.stay:edit and bookings.detail.pricing:edit, both edit-level.',
  },
  aiMonthlyCreditAllowance: { leaves: ['settings.aiOverrides:edit'] },
  marketingStudio: {
    leaves: ['marketing:view', 'marketing.content:add', 'marketing.content:edit'],
  },
  customPages: { na: 'Explore-open on every plan; saving is gated by publicPagesAutosave.' },
  propertyShowcase: { leaves: ['publicPages.showcase:edit'] },
  aiDashboardAssistant: { leaves: ['assistant:view'] },
  aiReceptionist: { leaves: ['settings.voiceReceptionist:edit'] },
  aiMarketingGeneration: { leaves: ['marketing.generate:add'] },
  aiMarketingImageGeneration: { leaves: ['marketing.generate.image:add'] },
  aiMarketingVideoGeneration: { leaves: ['marketing.generate.video:add'] },
  aiChatAutoReply: { leaves: ['inbox.automation:edit'] },
  fullyManagedByPlatform: { na: 'Platform-side hosting flag, no host action.' },
  financeReporting: { leaves: ['finance.export:view'] },
  maintenanceReporting: { leaves: ['maintenance.export:view'] },
  metaChatChannel: { leaves: ['inbox.channels:add', 'inbox.channels:delete'] },
  quickReplies: { leaves: ['inbox.quickReplies:add', 'inbox.quickReplies:edit'] },
  customTemplates: {
    leaves: [
      'templates.custom:add',
      'templates.email:edit',
      'marketing.templates:add',
      'marketing.templates:edit',
    ],
  },
  publicPagesAutosave: {
    leaves: ['publicPages.property:edit', 'publicPages.stayGuide:edit'],
  },
  bookingImport: { leaves: ['bookings.import:add'] },
  calendarSync: { leaves: ['pricing.channels:view', 'pricing.channels:edit'] },
  smartPricing: { leaves: ['pricing.smartPricing:edit'] },
  customRoles: {
    leaves: ['team.customRoles:add', 'team.customRoles:edit', 'team.customRoles:delete'],
  },
  copyPropertySettings: {
    na: 'Per-group edit leaves apply inside the clone run (verifyPropertyAccess); no separate leaf.',
  },
  analyticsInsights: { leaves: ['analytics:export', 'analytics.aiReview:add'] },
  activityLogExport: { na: 'Owner and org-admin only at the auth layer.' },
};

/** Leaf id → plan feature, derived from the coverage table above. */
export function planFeatureByPermissionLeaf(): Record<string, PlanFeatureKey> {
  const out: Record<string, PlanFeatureKey> = {};
  for (const [feature, coverage] of Object.entries(PLAN_FEATURE_PERMISSION_COVERAGE)) {
    if (!('leaves' in coverage)) continue;
    for (const leaf of coverage.leaves) out[leaf] = feature as PlanFeatureKey;
  }
  return out;
}
