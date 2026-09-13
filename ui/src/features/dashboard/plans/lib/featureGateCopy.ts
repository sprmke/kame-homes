import type { PlanFeatureKey } from '@/features/dashboard/plans/lib/planFeatures';

export type FeatureGateCopy = {
  title: string;
  description: string;
  ctaLabel: string;
};

export const FEATURE_GATE_COPY: Record<PlanFeatureKey, FeatureGateCopy> = {
  marketingStudio: {
    title: 'Marketing Content Studio',
    description:
      'Watermark-free editing, downloads, and publishing are available on Pro and above.',
    ctaLabel: 'View plans',
  },
  marketingPublishLimitPerGroup: {
    title: 'Publish in Meta platforms',
    description: 'Publishing to Facebook and Instagram is available on Business and above.',
    ctaLabel: 'View plans',
  },
  aiMarketingGeneration: {
    title: 'AI content generation',
    description: 'Generating captions and design copy with AI is available on Business and above.',
    ctaLabel: 'View plans',
  },
  aiMarketingImageGeneration: {
    title: 'AI image generation',
    description:
      'Turning a prompt and your own photos into a finished image is available on Pro and above.',
    ctaLabel: 'View plans',
  },
  aiMarketingVideoGeneration: {
    title: 'AI video generation',
    description:
      'Turning a prompt and your own photos into a finished video is available on Business and above.',
    ctaLabel: 'View plans',
  },
  aiMonthlyCreditAllowance: {
    title: 'AI credits',
    description: 'Higher monthly AI allowance on paid plans. Upgrade for more credits.',
    ctaLabel: 'View plans',
  },
  aiDashboardAssistant: {
    title: 'AI dashboard assistant',
    description: 'Available on Business and above.',
    ctaLabel: 'View plans',
  },
  aiValidations: {
    title: 'AI receipt & ID validation',
    description: 'Automatic AI review of receipts and IDs is available on Pro and above.',
    ctaLabel: 'View plans',
  },
  aiChatAutoReply: {
    title: 'AI auto-reply',
    description:
      'Letting the AI send guest replies automatically is available on Business and above.',
    ctaLabel: 'View plans',
  },
  aiReceptionist: {
    title: 'AI Receptionist',
    description: 'Live AI call handling for guests is available on Business and above.',
    ctaLabel: 'View plans',
  },
  customPages: {
    title: 'Public pages',
    description:
      'The Public Pages gallery and Page Editor are available on every plan. Saving changes requires Pro and above.',
    ctaLabel: 'View plans',
  },
  telegramNotifications: {
    title: 'Telegram notifications',
    description: 'Sending booking alerts to Telegram is available on Starter and above.',
    ctaLabel: 'View plans',
  },
  teamManagement: {
    title: 'Team members',
    description: 'Invite more team members on a higher plan. Upgrade to add seats.',
    ctaLabel: 'View plans',
  },
  automatedBookingFlow: {
    title: 'Automated booking emails',
    description:
      'Automatic GAF/pet request, booking acknowledgement, ready-for-check-in, and check-out & SD refund emails are available on Starter and above. On Free you send these manually.',
    ctaLabel: 'View plans',
  },
  verifiedBadgeEligible: {
    title: 'Verified badge',
    description: 'Available on Starter and above.',
    ctaLabel: 'View plans',
  },
  recommendedBadgeEligible: {
    title: 'Recommended badge',
    description: 'Available on Pro and above.',
    ctaLabel: 'View plans',
  },
  searchVisibilityTier: {
    title: 'Search visibility',
    description: 'Better listing placement on paid plans. Upgrade for higher visibility.',
    ctaLabel: 'View plans',
  },
  fullyManagedByPlatform: {
    title: 'Full-service property management',
    description:
      'Contact us for hands-on operations, marketing, chat, and reminders, with full booking and finance visibility.',
    ctaLabel: 'View plans',
  },
  financeReporting: {
    title: 'Finance reporting',
    description: 'Available on Starter and above.',
    ctaLabel: 'View plans',
  },
  maintenanceReporting: {
    title: 'Maintenance reporting',
    description: 'Available on Starter and above.',
    ctaLabel: 'View plans',
  },
  metaChatChannel: {
    title: 'Meta chat channel',
    description: 'Available on Business and above.',
    ctaLabel: 'View plans',
  },
  quickReplies: {
    title: 'Quick replies',
    description: 'Available on Starter and above.',
    ctaLabel: 'View plans',
  },
  customTemplates: {
    title: 'Advanced template management',
    description:
      'Saving email templates and adding custom templates is available on Starter and above. Standard template management stays free.',
    ctaLabel: 'View plans',
  },
  publicPagesAutosave: {
    title: 'Save public pages',
    description:
      'Saving Public Pages changes (listing, Stay Guide, Showcase) is available on Pro and above. You can still open the editor on Free.',
    ctaLabel: 'View plans',
  },
  propertyShowcase: {
    title: 'Property showcase',
    description:
      'Publishing a live Showcase page for guests is available on Pro and above. You can still open the Showcase editor on Free.',
    ctaLabel: 'View plans',
  },
  bookingImport: {
    title: 'AI booking import',
    description: 'Importing bookings from CSV or Excel is available on Starter and above.',
    ctaLabel: 'View plans',
  },
  calendarSync: {
    title: 'Airbnb calendar sync',
    description:
      'Two-way Airbnb calendar sync (import their reservations and export your booked dates) is available on Pro and above.',
    ctaLabel: 'View plans',
  },
  smartPricing: {
    title: 'Smart Pricing',
    description:
      'AI-assisted dynamic nightly rates (analyse your calendar history and forward demand to price every future night) is available on Pro and above.',
    ctaLabel: 'View plans',
  },
  customRoles: {
    title: 'Custom team roles',
    description:
      'Creating and editing custom roles is available on Starter and above. Default roles stay available on every plan.',
    ctaLabel: 'View plans',
  },
  copyPropertySettings: {
    title: 'Copy property settings',
    description:
      'Copying settings from one property to others in your org is available on Pro and above.',
    ctaLabel: 'View plans',
  },
  analyticsInsights: {
    title: 'Analytics',
    description:
      'Property and portfolio analytics — occupancy, revenue, guest insights, and the AI performance review are available on Pro and above.',
    ctaLabel: 'View plans',
  },
  activityLogExport: {
    title: 'Activity log export',
    description:
      'Downloading the Activity & Audit Log as CSV is available on Starter and above. Viewing the log in the dashboard stays free on every plan.',
    ctaLabel: 'View plans',
  },
};

export function featureGateCopy(feature: PlanFeatureKey): FeatureGateCopy {
  return FEATURE_GATE_COPY[feature];
}
