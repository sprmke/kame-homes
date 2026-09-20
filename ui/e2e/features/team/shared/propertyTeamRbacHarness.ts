/**
 * Mocked property-team RBAC harness — nav visibility + route guards.
 * Mirrors seeded Full Access / Operations / Read Only grants (Phase 7 catalog).
 */

import { expect, type Page, type Route } from '@playwright/test';

import { mockPublicPropertyBody } from '../../../shared/mockFixtures';
import { PLAN_PRO, PLANS_E2E_CATALOG } from '../../plans/shared/orgPlanHarnessShared';

const ORG_ID = 'org-team-e2e-001';
export const TEAM_E2E_PROPERTY_ID = 'property-team-e2e-001';
export const TEAM_E2E_PROPERTY_ID_2 = 'property-team-e2e-002';
export const TEAM_E2E_ORG_SLUG = 'kame-homes-ph';
export const TEAM_E2E_PROPERTY_SLUG = 'solea-mactan';
export const TEAM_E2E_PROPERTY_SLUG_2 = 'solea-cebu';
export const TEAM_E2E_PROPERTY_NAME_2 = 'Solea Cebu';

export type PropertyTeamRbacMockOpts = {
  freePlan?: boolean;
  assistantEnabled?: boolean;
  /** Two properties in org inventory (copy settings wizard). */
  multiProperty?: boolean;
  /** Org hub pages: owner org-access + org-settings PATCH. */
  orgHub?: boolean;
  /** Generate tab: seed the gallery with one completed AI image job. */
  marketingGenerationSeeded?: boolean;
  /** Force the video plan gate independently of freePlan (default: !freePlan). Lets a test
   *  simulate a Pro-tier org that has images but not video, without a new template. */
  videoPlanAllowed?: boolean;
  /** Templates page: seed one custom template + one booking (Send to guest flow). */
  customTemplateSeeded?: boolean;
  /** Inbox cross-property switcher: seed a booking on the second property (needs multiProperty) matching the mock "Maria Santos" Facebook thread. */
  crossPropertyBookingSeeded?: boolean;
};

const SUPABASE_AUTH_STORAGE_KEY = 'sb-127-auth-token';

type AssistantChatBlock = {
  type: string;
  [key: string]: unknown;
};

let assistantChatBlocks: AssistantChatBlock[] = [];

/** Set mocked assistant turn blocks for the next dashboard-assistant-chat POST. */
export function queueAssistantChatBlocksForMocks(blocks: AssistantChatBlock[]) {
  assistantChatBlocks = blocks;
}

/** Full Access — all leaf ids (subset representative of catalog modules for nav). */
export const FULL_ACCESS_PERMISSIONS = [
  'bookings:view',
  'bookings.create:add',
  'bookings.import:add',
  'bookings.detail.stay:edit',
  'bookings.detail.guests:edit',
  'bookings.detail.parking:edit',
  'bookings.detail.pets:edit',
  'bookings.detail.pricing:edit',
  'bookings.detail.workflow:edit',
  'finance:view',
  'finance.transactions:add',
  'finance.transactions:edit',
  'finance.transactions:delete',
  'finance.export:view',
  'pricing:view',
  'pricing.rates:edit',
  'pricing.blocks:add',
  'pricing.blocks:delete',
  'maintenance:view',
  'maintenance.reminders:add',
  'maintenance.reminders:edit',
  'maintenance.reminders:delete',
  'maintenance.export:view',
  'marketing:view',
  'marketing.content:add',
  'marketing.content:edit',
  'marketing.templates:add',
  'marketing.templates:edit',
  'marketing.templates:delete',
  'marketing.generate:add',
  'marketing.generate.video:add',
  'marketing.publish:add',
  'notifications:view',
  'notifications.chat:edit',
  'notifications.marketing:edit',
  'notifications.staff:edit',
  'notifications.operations:edit',
  'notifications.finance:edit',
  'notifications.maintenance:edit',
  'templates:view',
  'templates.standard:edit',
  'templates.email:edit',
  'templates.custom:add',
  'templates.custom:edit',
  'templates.custom:delete',
  'publicPages:view',
  'publicPages.property:edit',
  'publicPages.stayGuide:edit',
  'publicPages.showcase:edit',
  'settings:view',
  'settings.basicInfo:edit',
  'team:view',
  'team.invitations:add',
  'team.members:edit',
  'inbox:view',
  'inbox.messages:edit',
  'inbox.channels:add',
] as const;

/** Operations seeded template (ex-Staff) — includes Marketing; excludes Finance/Settings/Team manage. */
export const OPERATIONS_PERMISSIONS = [
  'bookings:view',
  'bookings.create:add',
  'bookings.detail.stay:edit',
  'bookings.detail.guests:edit',
  'bookings.detail.parking:edit',
  'bookings.detail.pets:edit',
  'bookings.detail.pricing:edit',
  'bookings.detail.workflow:edit',
  'maintenance:view',
  'maintenance.reminders:add',
  'maintenance.reminders:edit',
  'maintenance.reminders:delete',
  'maintenance.export:view',
  'notifications:view',
  'templates:view',
  'publicPages:view',
  'pricing:view',
  'inbox:view',
  'inbox.messages:edit',
  'marketing:view',
  'marketing.content:add',
  'marketing.content:edit',
  'marketing.templates:add',
  'marketing.templates:edit',
  'marketing.templates:delete',
  'marketing.generate:add',
  'marketing.generate.video:add',
  'marketing.publish:add',
] as const;

/** Read Only seeded template — no Marketing, Finance, Settings. */
export const READ_ONLY_PERMISSIONS = [
  'bookings:view',
  'maintenance:view',
  'notifications:view',
  'templates:view',
  'publicPages:view',
  'pricing:view',
  'team:view',
  'inbox:view',
] as const;

export type TeamRbacTemplate = 'full_access' | 'operations' | 'read_only';

export const teamRbacPaths = {
  /** Property dashboard index (KPI widgets — prefer `bookings` for shell/nav smoke). */
  dashboard: `/org/${TEAM_E2E_ORG_SLUG}/property/${TEAM_E2E_PROPERTY_SLUG}`,
  bookings: `/org/${TEAM_E2E_ORG_SLUG}/property/${TEAM_E2E_PROPERTY_SLUG}/bookings`,
  finance: `/org/${TEAM_E2E_ORG_SLUG}/property/${TEAM_E2E_PROPERTY_SLUG}/finance`,
  marketing: `/org/${TEAM_E2E_ORG_SLUG}/property/${TEAM_E2E_PROPERTY_SLUG}/marketing`,
  settings: `/org/${TEAM_E2E_ORG_SLUG}/property/${TEAM_E2E_PROPERTY_SLUG}/settings`,
  team: `/org/${TEAM_E2E_ORG_SLUG}/property/${TEAM_E2E_PROPERTY_SLUG}/team`,
  publicPages: `/org/${TEAM_E2E_ORG_SLUG}/property/${TEAM_E2E_PROPERTY_SLUG}/public-pages`,
  activity: `/org/${TEAM_E2E_ORG_SLUG}/property/${TEAM_E2E_PROPERTY_SLUG}/activity`,
} as const;

export const orgHubPaths = {
  dashboard: `/org/${TEAM_E2E_ORG_SLUG}/dashboard`,
  bookings: `/org/${TEAM_E2E_ORG_SLUG}/bookings`,
  properties: `/org/${TEAM_E2E_ORG_SLUG}/properties`,
  team: `/org/${TEAM_E2E_ORG_SLUG}/team`,
} as const;

function permissionsForTemplate(template: TeamRbacTemplate): readonly string[] {
  if (template === 'full_access') return FULL_ACCESS_PERMISSIONS;
  if (template === 'operations') return OPERATIONS_PERMISSIONS;
  return READ_ONLY_PERMISSIONS;
}

function e2eSupabaseAuthSession() {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return {
    access_token: 'playwright-team-token',
    refresh_token: 'playwright-team-refresh',
    expires_in: 60 * 60,
    expires_at: nowSeconds + 60 * 60,
    token_type: 'bearer',
    user: {
      id: 'user-team-e2e-001',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'team-member@example.com',
      email_confirmed_at: new Date().toISOString(),
      app_metadata: { provider: 'google', providers: ['google'] },
      user_metadata: { full_name: 'Team Member' },
      identities: [],
      created_at: new Date(0).toISOString(),
      updated_at: new Date().toISOString(),
    },
  };
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

function organizationList() {
  return {
    organizations: [
      {
        id: ORG_ID,
        name: 'Kame Homes PH',
        slug: TEAM_E2E_ORG_SLUG,
        description: null,
        logoUrl: null,
        settings: {},
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
  };
}

function propertyList(multiProperty = false) {
  const primary = {
    id: TEAM_E2E_PROPERTY_ID,
    organizationId: ORG_ID,
    name: 'Solea Mactan',
    slug: TEAM_E2E_PROPERTY_SLUG,
    type: 'condo',
    status: 'ACTIVE',
    address: 'Mactan',
    towerAndUnit: null,
    tower: 'Tower A',
    unitNumber: '1204',
    residenceName: 'Solea Mactan',
    maxGuests: 4,
    settings: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  if (!multiProperty) {
    return { properties: [primary] };
  }
  return {
    properties: [
      primary,
      {
        id: TEAM_E2E_PROPERTY_ID_2,
        organizationId: ORG_ID,
        name: TEAM_E2E_PROPERTY_NAME_2,
        slug: TEAM_E2E_PROPERTY_SLUG_2,
        type: 'condo',
        status: 'ACTIVE',
        address: 'Cebu City',
        towerAndUnit: null,
        tower: 'Tower B',
        unitNumber: '804',
        residenceName: 'Solea Cebu',
        maxGuests: 4,
        settings: {},
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
  };
}

function propertyAccessPayload(permissions: readonly string[]) {
  return {
    accessKind: 'member' as const,
    permissions: [...permissions],
    memberId: 'member-team-e2e-001',
    propertyId: TEAM_E2E_PROPERTY_ID,
    orgSlug: TEAM_E2E_ORG_SLUG,
    orgName: 'Kame Homes PH',
    propertySlug: TEAM_E2E_PROPERTY_SLUG,
    propertyName: 'Solea Mactan',
    planLimited: false,
  };
}

const emptyTelegramCredentials = {
  tokenConfigured: false,
  chatIdConfigured: false,
  tokenSource: 'none' as const,
  chatIdSource: 'none' as const,
  secretsEncryptionConfigured: false,
};

function telegramMarketingSettingsPayload() {
  return {
    enabled: false,
    notifyOnNewBooking: true,
    notifyOnCancellation: true,
    notifyOnDailyDefault: true,
    notifyOnDailyUrgency: true,
    urgencyDaysThreshold: 5,
    newBookingDatesLimit: 8,
    dailyReminderTimesManila: [{ hour: 10, minute: 0 }],
    dailyReminderUtcCronPreview: ['0 2 * * *'],
    dailyDefaultTemplate: 'Daily default',
    dailyUrgencyTemplate: 'Daily urgency',
    newBookingTemplate: 'New booking',
    cancellationTemplate: 'Cancellation',
    placeholdersReference: [] as string[],
    credentials: emptyTelegramCredentials,
  };
}

function telegramAdminSettingsPayload() {
  return {
    enabled: false,
    notifyOnNewBooking: true,
    notifyOnSdFormSubmitted: true,
    notifyOnBalanceReceiptUploaded: true,
    notifyPendingDocsHourly: true,
    notifyBalanceReceiptHourly: true,
    notifySdRefundPendingHourly: true,
    newBookingTemplate: 'New booking',
    pendingDocsTemplate: 'Pending docs',
    balanceReceiptTemplate: 'Balance receipt',
    balanceReceiptUploadedTemplate: 'Receipt uploaded',
    sdFormSubmittedTemplate: 'SD form',
    sdRefundPendingTemplate: 'SD refund',
    hourlyUtcCronPreview: '0 * * * *',
    placeholdersReference: [] as string[],
    scenarios: [] as Array<{ id: string; label: string; trigger: string; type: string }>,
    credentials: emptyTelegramCredentials,
  };
}

function telegramStaffSettingsPayload() {
  return {
    enabled: false,
    notifyOnSameDayCheckin: true,
    notifyOnDailySummary: true,
    notifyOnDailySummaryNoBookings: true,
    dailySummaryTemplate: 'Summary',
    dailySummaryNoBookingsTemplate: 'No bookings',
    sameDayCheckinTemplate: 'Same day',
    dailySummaryTimeManila: { hour: 8, minute: 0 },
    dailySummaryUtcCronPreview: '0 0 * * *',
    placeholdersReference: [] as string[],
    scenarios: [] as Array<{ id: string; label: string; trigger: string; type: string }>,
    credentials: emptyTelegramCredentials,
  };
}

function telegramChatSettingsPayload() {
  return {
    enabled: false,
    notifyOnNewMessage: true,
    newMessageTemplate: 'New message',
    placeholdersReference: [] as string[],
    credentials: emptyTelegramCredentials,
  };
}

function telegramFinanceSettingsPayload() {
  return {
    enabled: false,
    defaultReminderTemplate: 'Finance reminder',
    dailyCheckTimeManila: { hour: 9, minute: 0 },
    dailyCheckUtcCronPreview: '0 1 * * *',
    placeholdersReference: [] as string[],
    credentials: emptyTelegramCredentials,
  };
}

function telegramMaintenanceSettingsPayload() {
  return {
    enabled: false,
    defaultReminderTemplate: 'Maintenance reminder',
    dailyCheckTimeManila: { hour: 9, minute: 0 },
    dailyCheckUtcCronPreview: '0 1 * * *',
    placeholdersReference: [] as string[],
    credentials: emptyTelegramCredentials,
  };
}

function telegramGlobalSettingsPayload() {
  return {
    tokenConfigured: false,
    botToken: null,
    secretsEncryptionConfigured: false,
  };
}

function orgPlanPayload(multiProperty = false, freePlan = false) {
  const businessPlan =
    PLANS_E2E_CATALOG.find((plan) => plan.id === PLAN_PRO) ?? PLANS_E2E_CATALOG[3]!;
  const planProperties = [
    {
      id: TEAM_E2E_PROPERTY_ID,
      name: 'Solea Mactan',
      slug: TEAM_E2E_PROPERTY_SLUG,
      status: 'ACTIVE',
    },
  ];
  if (multiProperty) {
    planProperties.push({
      id: TEAM_E2E_PROPERTY_ID_2,
      name: TEAM_E2E_PROPERTY_NAME_2,
      slug: TEAM_E2E_PROPERTY_SLUG_2,
      status: 'ACTIVE',
    });
  }
  return {
    plans: PLANS_E2E_CATALOG,
    properties: planProperties,
    // No active paid subscription on Free — TierBadge/useOrgPlan fall back to the catalog's default (Free) plan.
    subscription: freePlan
      ? null
      : {
          id: 'sub-team-e2e-001',
          planId: businessPlan.id,
          planCode: businessPlan.code,
          planName: businessPlan.name,
          pricingModel: 'subscription',
          status: 'active',
          pricePhpSnapshot: businessPlan.pricePhp,
          currentPeriodStart: '2026-08-01T00:00:00.000Z',
          currentPeriodEnd: '2026-09-01T00:00:00.000Z',
          gracePeriodEndsAt: null,
        },
    assignedPropertyIds: multiProperty
      ? [TEAM_E2E_PROPERTY_ID, TEAM_E2E_PROPERTY_ID_2]
      : [TEAM_E2E_PROPERTY_ID],
    pendingCheckoutUrl: null,
    pendingCheckoutPlanId: null,
    transactions: [],
  };
}

function entitlementsPayload(
  freePlan = false,
  assistantEnabled = false,
  videoPlanAllowed = !freePlan
) {
  return {
    automatedBookingFlow: !freePlan,
    verifiedBadgeEligible: false,
    recommendedBadgeEligible: false,
    telegramNotifications: true,
    teamManagement: { enabled: true, maxMembers: null },
    searchVisibilityTier: 'none' as const,
    marketingPublishLimitPerGroup: 10,
    aiValidations: false,
    aiMonthlyCreditAllowance: 0,
    marketingStudio: true,
    aiMarketingImageGeneration: !freePlan,
    aiMarketingVideoGeneration: videoPlanAllowed,
    customPages: true,
    aiDashboardAssistant: assistantEnabled,
    aiReceptionist: false,
    aiMarketingGeneration: true,
    aiChatAutoReply: false,
    fullyManagedByPlatform: false,
    financeReporting: true,
    maintenanceReporting: true,
    metaChatChannel: true,
    quickReplies: true,
    customTemplates: true,
    publicPagesAutosave: !freePlan,
    bookingImport: true,
    customRoles: true,
    calendarSync: true,
    smartPricing: true,
    planId: PLAN_PRO,
    planCode: 'pro',
    planName: 'Business',
    pricingModel: 'monthly',
    status: 'active',
    propertySubscriptionId: 'sub-team-e2e-001',
  };
}

function dashboardStatsPayload() {
  return {
    manilaDate: '2026-08-28',
    attention: [],
    pipeline: [],
    trendWindow: { from: '2026-08-01', to: '2026-08-31', label: 'Aug 2026' },
    upcoming: [],
    finance: {
      monthNet: 0,
      monthStays: 0,
      outstandingBalance: 0,
      pipelineEstimate: 0,
    },
    totals: {
      activeBookings: 0,
      totalBookings: 0,
      periodDays: 31,
      checkInsToday: 0,
      checkOutsToday: 0,
      checkInsInPeriod: 0,
    },
    kpis: {
      netProfit: { value: 0, changePercent: 0 },
      totalBookings: { value: 0, changePercent: 0 },
      checkInsInPeriod: { value: 0, changePercent: 0 },
      occupancyRate: { value: 0, changePoints: 0 },
      avgNightlyRate: { value: 0, changePercent: 0 },
      nightsBooked: { value: 0, periodDays: 31 },
    },
    propertyCount: 1,
    parkingCount: 0,
    trendSeries: [],
    recentBookings: [],
    propertyPerformance: [],
    parkingPerformance: [],
    statusBreakdown: [],
  };
}

/** Flat `AppSettingsDto` — HostVerification / settings-completion call `appSettingsToFormValues`. */
function appSettingsPayload() {
  const fieldDefault = 'default' as const;
  const emptyTelegramCreds = {
    tokenConfigured: false,
    chatIdConfigured: false,
    tokenSource: fieldDefault,
    chatIdSource: fieldDefault,
    secretsEncryptionConfigured: false,
  };
  return {
    emailTo: 'host@example.com',
    emailReplyTo: '',
    parkingOwnerEmails: [] as string[],
    sdRefundCronEmailLeadMinutes: 60,
    sdRefundCronMaxCheckoutAgeDays: 14,
    publicGuestAppOrigin: 'http://127.0.0.1:4173',
    facebookReviewsUrl: '',
    emailLogoUrl: '',
    brandColorStored: '',
    inheritedBrandColor: '#0f766e',
    resolvedBrandColor: '#0f766e',
    facebookPageUrl: '',
    airbnbUrl: '',
    instagramUrl: '',
    tiktokUrl: '',
    defaultParkingRateGuest: 0,
    gcashName: '',
    gcashNumber: '',
    gcashQrImageUrl: '',
    paymentProvider: 'gcash',
    paymentMethods: [] as unknown[],
    gafUnitOwner: '',
    gafTowerAndUnitNumber: '',
    gafGuestsOnsiteContactPerson: '',
    gafOwnerContactNumber: '',
    gafUnitOwnerSignatureUrl: '',
    automationToggles: {
      emailNewBookingRequest: true,
      emailGafRequest: true,
      emailBookingAcknowledgement: true,
      emailPetRequest: true,
      emailParkingBroadcast: true,
      emailReadyForCheckin: true,
      emailSdRefundCheckout: true,
    },
    updatedAt: null,
    fieldSources: {
      emailTo: fieldDefault,
      emailReplyTo: fieldDefault,
      parkingOwnerEmails: fieldDefault,
      sdRefundCronEmailLeadMinutes: fieldDefault,
      sdRefundCronMaxCheckoutAgeDays: fieldDefault,
      publicGuestAppOrigin: fieldDefault,
      facebookReviewsUrl: fieldDefault,
      emailLogoUrl: fieldDefault,
      brandColorStored: fieldDefault,
      facebookPageUrl: fieldDefault,
      airbnbUrl: fieldDefault,
      instagramUrl: fieldDefault,
      tiktokUrl: fieldDefault,
      defaultParkingRateGuest: fieldDefault,
      gcashName: fieldDefault,
      gcashNumber: fieldDefault,
      gcashQrImageUrl: fieldDefault,
      paymentProvider: fieldDefault,
      gafUnitOwner: fieldDefault,
      gafTowerAndUnitNumber: fieldDefault,
      gafGuestsOnsiteContactPerson: fieldDefault,
      gafOwnerContactNumber: fieldDefault,
      gafUnitOwnerSignatureUrl: fieldDefault,
    },
    propertyIntegrations: {
      telegram: {
        marketing: emptyTelegramCreds,
        staff: emptyTelegramCreds,
        admin: emptyTelegramCreds,
        finance: emptyTelegramCreds,
        maintenance: emptyTelegramCreds,
        chat: emptyTelegramCreds,
      },
    },
    platformSecrets: {
      resendApiKeyConfigured: false,
      secretsEncryptionKeyConfigured: false,
      geminiApiKeyConfigured: false,
      groqApiKeyConfigured: false,
    },
    externalReviews: [],
    vouchersEnabled: true,
    voucherPrizes: [],
    voucherRevealStyle: 'reel',
    documentRequirementsOverride: null,
    resolvedDocumentRequirements: [],
    residenceDefaultDocumentRequirements: [],
  };
}

function orgSettingsPayload() {
  const fieldDefault = 'default' as const;
  return {
    facebookPageUrl: '',
    airbnbUrl: '',
    instagramUrl: '',
    tiktokUrl: '',
    emailLogoUrl: '',
    updatedAt: null,
    fieldSources: {
      facebookPageUrl: fieldDefault,
      airbnbUrl: fieldDefault,
      instagramUrl: fieldDefault,
      tiktokUrl: fieldDefault,
      emailLogoUrl: fieldDefault,
    },
  };
}

function assistantOrgSettingsPayload() {
  return {
    organizationId: ORG_ID,
    enabled: true,
    disabledPropertyIds: [] as string[],
    dailyMessageLimit: 50,
    monthlyMessageLimit: 500,
    dailyWriteActionLimit: 20,
    updatedBy: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
    platformEnabled: true,
    usage: null,
  };
}

function orgAccessPayload(orgHub = false) {
  if (!orgHub) {
    return {
      accessKind: 'member' as const,
      permissions: ['org:properties:view', 'org:bookings:view'] as string[],
      orgId: ORG_ID,
      orgSlug: TEAM_E2E_ORG_SLUG,
      orgName: 'Kame Homes PH',
    };
  }
  return {
    accessKind: 'owner' as const,
    permissions: [
      'org.dashboard:view',
      'org.bookings:view',
      'org.properties:view',
      'org.properties:create',
      'org.properties:manage',
      'org.parkings:view',
      'org.team:view',
      'org.settings:view',
      'org.settings.basic:edit',
      'org.settings.socials:edit',
      'org.settings.aiPlatform:edit',
      'org.settings.aiAssistant:edit',
      'org.plans:view',
    ],
    memberId: null,
    canListAllProperties: true,
    orgId: ORG_ID,
    orgSlug: TEAM_E2E_ORG_SLUG,
    orgName: 'Kame Homes PH',
    canManageTeam: true,
    canInviteTeam: true,
    canCreateProperties: true,
    canManageProperties: true,
    canCreateParkings: true,
    canManageParkings: true,
    canEditBasicSettings: true,
    canEditSocials: true,
    canEditAiPlatform: true,
    canEditAiAssistant: true,
    canEditSettings: true,
    planLimited: false,
  };
}

function aiPlatformSettingsPayload() {
  return {
    organizationId: ORG_ID,
    enabled: true,
    dailyCallLimit: 100,
    monthlyCallLimit: 1000,
    dailyCostUsdLimit: 10,
    planTier: 'pro',
    updatedAt: null,
  };
}

function aiPlatformUsagePayload() {
  return {
    todayCallCount: 0,
    monthCallCount: 0,
    todayCostUsd: 0,
    monthCostUsd: 0,
    todayCreditsConsumed: 0,
    monthCreditsConsumed: 0,
    dailyCallLimit: 100,
    monthlyCallLimit: 1000,
    dailyCostUsdLimit: 10,
    dailyCreditLimit: 100,
    monthlyCreditLimit: 1000,
    walletBalanceCredits: 0,
    dailyRemaining: 100,
    monthlyRemaining: 1000,
    dailyCostRemaining: 10,
    planTier: 'pro',
    quotaExceeded: false,
    featureBreakdown: [] as Array<{ feature: string; calls: number; estimatedCostUsd: number }>,
    propertyBreakdown: [] as Array<{
      propertyId: string;
      todayCallCount: number;
      todayCostUsd: number;
      monthCallCount: number;
      monthCostUsd: number;
    }>,
  };
}

function propertyTemplatesSettingsPayload(customTemplateSeeded = false) {
  const template = (
    templateKey: string,
    name: string,
    category: 'standard' | 'email' | 'custom'
  ) => ({
    templateKey,
    name,
    category,
    content: `Default ${name} content`,
    defaultContent: `Default ${name} content`,
    isDefault: true,
    description: null,
    previewTemplateSlug: null,
    sectionImageUrl: null,
    updatedAt: null,
  });
  return {
    templates: [
      template('house-rules', 'House Rules', 'standard'),
      template('check-in-instructions', 'Check-in Instructions', 'standard'),
      template('check-out-instructions', 'Check-out Instructions', 'standard'),
      template('parking-reminders', 'Parking Reminders', 'standard'),
      template('email-gaf-request', 'GAF Request', 'email'),
      template('email-pet-request', 'Pet Request', 'email'),
      template('email-parking-request', 'Parking Request', 'email'),
      template('email-new-booking-request', 'New Booking Request', 'email'),
      template('email-booking-acknowledgement', 'Booking Acknowledgement', 'email'),
      template('email-ready-for-checkin', 'Ready for Check-in', 'email'),
      template('email-sd-refund-form-request', 'SD Refund Form Request', 'email'),
      ...(customTemplateSeeded ? [template('custom-e2e-001', 'Welcome Note', 'custom')] : []),
    ],
    placeholdersReference: ['{{guestName}}'],
  };
}

/**
 * Minimal Public Pages config row — Page Editor stores only require `sections`
 * to be an array (their own normalizers fill in the canonical section list).
 */
function publicPageConfigPayload(pageType: string | null) {
  const base = { updatedAt: '2026-01-01T00:00:00.000Z' };
  if (pageType === 'property_showcase') {
    return { ...base, pageType, config: { version: 1, published: true, sections: [] } };
  }
  if (pageType === 'stay_guide') {
    return { ...base, pageType, config: { version: 2, published: true, sections: [] } };
  }
  return { ...base, pageType: 'property_landing', config: { version: 1, sections: [] } };
}

/** Minimal booking row for the Templates "Send to guest" picker. */
function seededBookingRow() {
  return {
    id: 'booking-team-e2e-001',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: null,
    property_id: TEAM_E2E_PROPERTY_ID,
    property_name: 'Solea Mactan',
    property_slug: TEAM_E2E_PROPERTY_SLUG,
    guest_facebook_name: 'Jane Guest',
    primary_guest_name: 'Jane Guest',
    guest_email: 'jane.guest@example.com',
    guest_phone_number: '+639171234567',
    guest_address: null,
    nationality: null,
    primary_guest_age: null,
    guest2_name: null,
    guest2_age: null,
    guest3_name: null,
    guest3_age: null,
    guest4_name: null,
    guest4_age: null,
    guest5_name: null,
    guest5_age: null,
    guest2_valid_id_url: null,
    guest3_valid_id_url: null,
    guest4_valid_id_url: null,
    guest5_valid_id_url: null,
    check_in_date: '01-15-2026',
    check_out_date: '01-18-2026',
    check_in_time: null,
    check_out_time: null,
    number_of_adults: 2,
    number_of_children: 0,
    number_of_nights: 3,
    need_parking: false,
    car_plate_number: null,
    car_brand_model: null,
    car_color: null,
    parking_endorsement_url: null,
    status: 'READY_FOR_CHECKIN',
  };
}

/** Booking on the second property, guest name matches the mock "Maria Santos" Facebook thread. */
function seededCrossPropertyBookingRow() {
  return {
    id: 'booking-team-e2e-002',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: null,
    property_id: TEAM_E2E_PROPERTY_ID_2,
    property_name: TEAM_E2E_PROPERTY_NAME_2,
    property_slug: TEAM_E2E_PROPERTY_SLUG_2,
    guest_facebook_name: 'Maria Santos',
    primary_guest_name: 'Maria Santos',
    guest_email: 'maria.santos@example.com',
    guest_phone_number: '+639171234568',
    guest_address: null,
    nationality: null,
    primary_guest_age: null,
    guest2_name: null,
    guest2_age: null,
    guest3_name: null,
    guest3_age: null,
    guest4_name: null,
    guest4_age: null,
    guest5_name: null,
    guest5_age: null,
    guest2_valid_id_url: null,
    guest3_valid_id_url: null,
    guest4_valid_id_url: null,
    guest5_valid_id_url: null,
    check_in_date: '03-15-2026',
    check_out_date: '03-17-2026',
    check_in_time: null,
    check_out_time: null,
    number_of_adults: 2,
    number_of_children: 0,
    number_of_nights: 2,
    need_parking: false,
    car_plate_number: null,
    car_brand_model: null,
    car_color: null,
    parking_endorsement_url: null,
    status: 'READY_FOR_CHECKIN',
  };
}

function orgSuperhostProgressPayload() {
  const row = (value: number, required: number, sampleSize = 8) => ({
    value,
    required,
    met: value >= required,
    sampleSize,
  });
  return {
    earned: false,
    earnedAt: null,
    lastAssessmentAt: null,
    nextAssessmentAt: '2026-10-01T00:00:00.000Z',
    assessmentKey: '2026-09',
    allCriteriaMet: false,
    criteria: {
      rating: row(4.85, 4.8),
      responseRate: row(0.95, 0.9),
      cancellationRate: { value: 0.02, required: 0.05, met: true, sampleSize: 8 },
      activity: row(12, 10),
    },
  };
}

function orgTeamMembersPayload() {
  return {
    members: [] as Array<Record<string, unknown>>,
    access: { canManage: true, accessKind: 'owner' as const },
    teamInviteCapacity: { used: 1, max: null },
  };
}

function listActivityLogPayload() {
  return { events: [] as Array<Record<string, unknown>>, nextCursor: null };
}

function copyPropertySettingsResponse(body: { dryRun?: boolean; targetPropertyIds?: string[] }) {
  const targetIds = body.targetPropertyIds ?? [];
  const dryRun = Boolean(body.dryRun);
  return {
    dryRun,
    results: targetIds.map((targetPropertyId) => ({
      targetPropertyId,
      applied: ['contact', 'guestForm'],
      skipped: [],
      failed: [],
      alreadyCustomized: [],
    })),
    ...(dryRun ? {} : { logId: 'log-e2e-copy-001' }),
  };
}

function teamMemberSessionStoragePayload() {
  return {
    authKey: 'kame:e2e-admin-session',
    supabaseAuthKey: SUPABASE_AUTH_STORAGE_KEY,
    supabaseAuthSession: e2eSupabaseAuthSession(),
    session: {
      accessToken: 'playwright-team-token',
      refreshToken: 'playwright-team-refresh',
      userId: 'user-team-e2e-001',
      email: 'team-member@example.com',
      name: 'Team Member',
    },
    orgSlug: TEAM_E2E_ORG_SLUG,
    propertySlug: TEAM_E2E_PROPERTY_SLUG,
  };
}

/** Apply host team-member auth on an already-loaded page (e.g. after a guest flow in the same spec). */
export async function applyTeamMemberSessionStorage(page: Page) {
  await page.evaluate((payload) => {
    window.localStorage.setItem(payload.authKey, JSON.stringify(payload.session));
    window.localStorage.setItem(
      payload.supabaseAuthKey,
      JSON.stringify(payload.supabaseAuthSession)
    );
    window.localStorage.setItem('kame-last-org-slug', payload.orgSlug);
    window.localStorage.setItem('kame-last-property-slug', payload.propertySlug);
    window.localStorage.setItem('kame-last-tenant-kind', 'property');
  }, teamMemberSessionStoragePayload());
}

export async function installTeamMemberSession(page: Page) {
  await page.addInitScript((payload) => {
    window.localStorage.setItem(payload.authKey, JSON.stringify(payload.session));
    window.localStorage.setItem(
      payload.supabaseAuthKey,
      JSON.stringify(payload.supabaseAuthSession)
    );
    window.localStorage.setItem('kame-last-org-slug', payload.orgSlug);
    window.localStorage.setItem('kame-last-property-slug', payload.propertySlug);
    window.localStorage.setItem('kame-last-tenant-kind', 'property');
  }, teamMemberSessionStoragePayload());
}

function marketingGenerationReferenceFixture() {
  return {
    id: 'ref-e2e-001',
    organization_id: 'org-team-e2e-001',
    property_id: TEAM_E2E_PROPERTY_ID,
    media_type: 'image',
    storage_path: `marketing-ai-refs/${TEAM_E2E_PROPERTY_ID}/ref-e2e-001.jpg`,
    public_url:
      'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
    mime_type: 'image/jpeg',
    file_name: 'balcony.jpg',
    byte_size: 204_800,
    width: 1200,
    height: 1200,
    duration_seconds: null,
    last_used_at: null,
    created_at: '2026-09-12T08:00:00.000Z',
  };
}

function marketingGenerationJobFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mgj-e2e-001',
    organizationId: 'org-team-e2e-001',
    propertyId: TEAM_E2E_PROPERTY_ID,
    mediaType: 'image',
    jobStatus: 'completed',
    prompt: 'E2E fixture: sunset shot of the rooftop pool deck',
    negativePrompt: null,
    model: 'gemini-3.1-flash-image',
    qualityTier: 'standard',
    aspectRatio: '1:1',
    imageSize: '1K',
    resolution: null,
    durationSeconds: null,
    referenceUrls: [],
    referencePaths: [],
    // 1x1 transparent PNG data URI — avoids a real network fetch for the gallery's
    // <img src>, keeping this a fully mocked (offline) test.
    outputUrl:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    outputMimeType: 'image/png',
    outputBytes: 512_000,
    outputWidth: 1024,
    outputHeight: 1024,
    estimatedCredits: 45,
    creditsConsumed: 45,
    errorCode: null,
    errorMessage: null,
    expiresAt: null,
    completedAt: '2026-09-12T08:00:00.000Z',
    createdAt: '2026-09-12T08:00:00.000Z',
    updatedAt: '2026-09-12T08:00:00.000Z',
    ...overrides,
  };
}

export async function installPropertyTeamRbacMocks(
  page: Page,
  template: TeamRbacTemplate,
  opts?: PropertyTeamRbacMockOpts
) {
  const permissions = permissionsForTemplate(template);
  const freePlan = Boolean(opts?.freePlan);
  const assistantEnabled = Boolean(opts?.assistantEnabled);
  const videoPlanAllowed = opts?.videoPlanAllowed ?? !freePlan;
  const multiProperty = Boolean(opts?.multiProperty);
  const orgHub = Boolean(opts?.orgHub);
  const customTemplateSeeded = Boolean(opts?.customTemplateSeeded);
  const crossPropertyBookingSeeded = Boolean(opts?.crossPropertyBookingSeeded);
  let orgSettingsState = orgSettingsPayload();
  let marketingGenerationJobs = opts?.marketingGenerationSeeded
    ? [marketingGenerationJobFixture()]
    : [];
  let marketingGenerationReferences = opts?.marketingGenerationSeeded
    ? [marketingGenerationReferenceFixture()]
    : [];
  await installTeamMemberSession(page);

  await page.route('**/functions/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const endpoint = url.pathname.split('/').pop();

    switch (endpoint) {
      case 'list-organizations':
        await fulfillJson(route, { success: true, data: organizationList() });
        return;
      case 'list-properties':
        await fulfillJson(route, { success: true, data: propertyList(multiProperty) });
        return;
      case 'list-parkings':
        await fulfillJson(route, { success: true, data: { parkings: [] } });
        return;
      case 'property-access':
        await fulfillJson(route, { success: true, data: propertyAccessPayload(permissions) });
        return;
      case 'property-entitlements':
        await fulfillJson(route, {
          success: true,
          data: entitlementsPayload(freePlan, assistantEnabled, videoPlanAllowed),
        });
        return;
      case 'dashboard-stats':
        await fulfillJson(route, { success: true, data: dashboardStatsPayload() });
        return;
      case 'app-settings':
        await fulfillJson(route, { success: true, data: appSettingsPayload() });
        return;
      case 'org-settings':
        if (route.request().method() === 'PATCH') {
          const body = (route.request().postDataJSON() ?? {}) as Record<string, string>;
          orgSettingsState = {
            ...orgSettingsState,
            ...body,
            updatedAt: '2026-09-10T12:00:00.000Z',
          };
          await fulfillJson(route, { success: true, data: orgSettingsState });
          return;
        }
        await fulfillJson(route, { success: true, data: orgSettingsState });
        return;
      case 'org-access':
        await fulfillJson(route, { success: true, data: orgAccessPayload(orgHub) });
        return;
      case 'org-plan':
        await fulfillJson(route, { success: true, data: orgPlanPayload(multiProperty, freePlan) });
        return;
      case 'ai-platform-settings':
        await fulfillJson(route, { success: true, data: aiPlatformSettingsPayload() });
        return;
      case 'ai-platform-usage':
        await fulfillJson(route, { success: true, data: aiPlatformUsagePayload() });
        return;
      case 'property-templates-settings':
        await fulfillJson(route, {
          success: true,
          data: propertyTemplatesSettingsPayload(customTemplateSeeded),
        });
        return;
      case 'send-property-custom-template-email':
        await fulfillJson(route, {
          success: true,
          bookingId: 'booking-team-e2e-001',
          templateKey: 'custom-e2e-001',
        });
        return;
      case 'public-page-configs':
        await fulfillJson(route, {
          success: true,
          data: publicPageConfigPayload(url.searchParams.get('page_type')),
        });
        return;
      case 'get-public-property':
        await fulfillJson(route, mockPublicPropertyBody);
        return;
      case 'copy-property-settings': {
        const body = (route.request().postDataJSON() ?? {}) as Record<string, unknown>;
        if (body.action === 'listLogs') {
          await fulfillJson(route, { success: true, data: { logs: [] } });
          return;
        }
        await fulfillJson(route, {
          success: true,
          data: copyPropertySettingsResponse({
            dryRun: Boolean(body.dryRun),
            targetPropertyIds: body.targetPropertyIds as string[] | undefined,
          }),
        });
        return;
      }
      case 'list-bookings': {
        const rows = [
          ...(customTemplateSeeded ? [seededBookingRow()] : []),
          ...(crossPropertyBookingSeeded ? [seededCrossPropertyBookingRow()] : []),
        ];
        await fulfillJson(route, { success: true, data: rows, total: rows.length });
        return;
      }
      case 'notifications-list':
        await fulfillJson(route, {
          success: true,
          data: { notifications: [], nextCursor: null, unreadCount: 0 },
        });
        return;
      case 'notifications-mark-read':
        await fulfillJson(route, { success: true, data: { updated: true } });
        return;
      case 'list-host-announcements':
        await fulfillJson(route, { success: true, data: { announcements: [] } });
        return;
      case 'dashboard-assistant-settings':
        await fulfillJson(route, {
          success: true,
          data:
            orgHub || assistantEnabled
              ? assistantOrgSettingsPayload()
              : { enabled: false, disabledPropertyIds: [] },
        });
        return;
      case 'get-org-superhost-progress':
        await fulfillJson(route, { success: true, data: orgSuperhostProgressPayload() });
        return;
      case 'check-organization-name':
        await fulfillJson(route, {
          success: true,
          data: { available: true, message: null },
        });
        return;
      case 'dashboard-assistant-conversations':
        if (route.request().method() === 'GET') {
          await fulfillJson(route, { success: true, data: { conversations: [] } });
          return;
        }
        await fulfillJson(route, { success: true, data: {} });
        return;
      case 'dashboard-assistant-chat':
        if (route.request().method() === 'POST') {
          await fulfillJson(route, {
            success: true,
            data: {
              conversationId: 'conv-e2e-assistant-001',
              blocks: assistantChatBlocks,
            },
          });
          return;
        }
        await fulfillJson(route, { success: true, data: {} });
        return;
      case 'dashboard-assistant-confirm': {
        const body = route.request().postDataJSON() as {
          actionId?: string;
          confirm?: boolean;
        };
        await fulfillJson(route, {
          success: true,
          data: {
            actionId: body.actionId ?? 'action-e2e-001',
            status: body.confirm ? 'executed' : 'denied',
            blocks: assistantChatBlocks.map((block) =>
              block.type === 'action_confirmation' && block.actionId === body.actionId
                ? { ...block, status: body.confirm ? 'executed' : 'denied' }
                : block
            ),
          },
        });
        return;
      }
      case 'get-booking-ai-review':
        await fulfillJson(route, { success: true, data: { review: null } });
        return;
      case 'get-booking-ai-assistant-audit':
        await fulfillJson(route, { success: true, data: { entries: [] } });
        return;
      case 'finance-summary':
        await fulfillJson(route, {
          success: true,
          data: {
            period: { basis: 'check_in', from: null, to: null },
            stays: {
              count: 0,
              completedCount: 0,
              bookingRate: 0,
              otherFees: 0,
              parkingMargin: 0,
              sdExpenses: 0,
              hostNetCompleted: 0,
              projectedNetPipeline: 0,
              outstandingGuestBalance: 0,
            },
            operating: { income: 0, expenses: 0, net: 0 },
            grandNet: 0,
          },
        });
        return;
      case 'finance-bookings':
        await fulfillJson(route, { success: true, data: [], total: 0, page: 1, limit: 100 });
        return;
      case 'maintenance-summary':
        await fulfillJson(route, {
          success: true,
          data: {
            period: { basis: 'due_date', from: null, to: null },
            totals: { open: 0, overdue: 0, completed: 0, upcoming: 0 },
          },
        });
        return;
      case 'finance-line-items':
        await fulfillJson(route, { success: true, data: [] });
        return;
      case 'maintenance-items':
        await fulfillJson(route, { success: true, data: [] });
        return;
      case 'property-pricing':
        await fulfillJson(route, {
          success: true,
          data: {
            weekdayNightlyRate: 3500,
            weekendNightlyRate: 4000,
            downPayment: 1000,
            securityDeposit: 3000,
            petFee: 300,
            parkingRateGuest: 400,
            guestAdditionalFee: 0,
            dateOverrides: {},
            bookedDateKeys: [],
            blockedDateKeys: [],
            importedBlockedDateKeys: [],
            holidayRules: [],
            calendarBookings: [],
            smartRecommendations: {},
            smartPricingEnabled: false,
          },
        });
        return;
      case 'marketing-templates':
        await fulfillJson(route, { success: true, data: { templates: [] } });
        return;
      case 'org-team-members':
        await fulfillJson(route, { success: true, data: orgTeamMembersPayload() });
        return;
      case 'org-team-invitations':
        await fulfillJson(route, { success: true, data: { invitations: [] } });
        return;
      case 'org-team-custom-roles':
        await fulfillJson(route, { success: true, data: { customRoles: [] } });
        return;
      case 'list-activity-log':
        await fulfillJson(route, { success: true, data: listActivityLogPayload() });
        return;
      case 'property-team-members':
        await fulfillJson(route, {
          success: true,
          data: { members: [], teamInviteCapacity: { used: 1, max: null } },
        });
        return;
      case 'property-team-custom-roles':
        await fulfillJson(route, { success: true, data: { customRoles: [] } });
        return;
      case 'property-team-invitations':
        await fulfillJson(route, { success: true, data: { invitations: [] } });
        return;
      case 'telegram-global-settings':
        await fulfillJson(route, { success: true, data: telegramGlobalSettingsPayload() });
        return;
      case 'telegram-marketing-settings':
        await fulfillJson(route, { success: true, data: telegramMarketingSettingsPayload() });
        return;
      case 'telegram-admin-settings':
        await fulfillJson(route, { success: true, data: telegramAdminSettingsPayload() });
        return;
      case 'telegram-staff-settings':
        await fulfillJson(route, { success: true, data: telegramStaffSettingsPayload() });
        return;
      case 'telegram-chat-settings':
        await fulfillJson(route, { success: true, data: telegramChatSettingsPayload() });
        return;
      case 'telegram-finance-settings':
        await fulfillJson(route, { success: true, data: telegramFinanceSettingsPayload() });
        return;
      case 'telegram-maintenance-settings':
        await fulfillJson(route, { success: true, data: telegramMaintenanceSettingsPayload() });
        return;
      case 'marketing-generations':
        if (route.request().method() === 'DELETE') {
          const body = (route.request().postDataJSON() ?? {}) as { jobId?: string };
          marketingGenerationJobs = marketingGenerationJobs.filter((job) => job.id !== body.jobId);
          await fulfillJson(route, { success: true, data: { jobId: body.jobId } });
          return;
        }
        await fulfillJson(route, {
          success: true,
          data: {
            jobs: marketingGenerationJobs,
            nextCursor: null,
            allowPremiumImage: false,
            allowPremiumVideo: false,
          },
        });
        return;
      case 'generate-marketing-media': {
        const job = marketingGenerationJobFixture({
          id: `mgj-e2e-${marketingGenerationJobs.length + 1}`,
        });
        marketingGenerationJobs = [job, ...marketingGenerationJobs];
        await fulfillJson(route, { success: true, data: { job } });
        return;
      }
      case 'get-marketing-generation-job': {
        const jobId = url.searchParams.get('jobId');
        const job =
          marketingGenerationJobs.find((item) => item.id === jobId) ??
          marketingGenerationJobFixture();
        await fulfillJson(route, { success: true, data: { job } });
        return;
      }
      case 'upload-marketing-generation-reference':
        if (route.request().method() === 'DELETE') {
          await fulfillJson(route, { success: true, data: { referenceId: 'ref-e2e-001' } });
          return;
        }
        if (route.request().method() === 'GET') {
          await fulfillJson(route, {
            success: true,
            data: { references: marketingGenerationReferences },
          });
          return;
        }
        {
          const reference = marketingGenerationReferenceFixture();
          marketingGenerationReferences = [
            reference,
            ...marketingGenerationReferences.filter((row) => row.id !== reference.id),
          ];
          await fulfillJson(route, { success: true, data: { reference } });
        }
        return;
      default:
        await fulfillJson(route, { success: true, data: {} });
    }
  });

  await page.route('**/rest/v1/**', async (route) => {
    await fulfillJson(route, []);
  });
}

const ADMIN_DESKTOP_NAV_MIN_WIDTH = 1024;

function usesCompactAdminNav(page: Page): boolean {
  const width = page.viewportSize()?.width ?? ADMIN_DESKTOP_NAV_MIN_WIDTH;
  return width < ADMIN_DESKTOP_NAV_MIN_WIDTH;
}

export function adminNav(page: Page) {
  if (usesCompactAdminNav(page)) {
    return page.getByRole('navigation', { name: 'Admin' });
  }
  // Desktop sidebar list lives in <nav aria-label="Main menu"> (aside label is complementary).
  return page.getByRole('navigation', { name: 'Main menu' });
}

function moreNav(page: Page) {
  return page.getByRole('navigation', { name: 'More' });
}

function adminNavEntry(root: ReturnType<typeof adminNav>, label: string) {
  return root.getByRole('link', { name: label }).or(root.getByRole('listitem', { name: label }));
}

async function openAdminMoreSheet(page: Page) {
  if (await moreNav(page).isVisible()) return;
  await dismissInstallPromptIfPresent(page);
  await adminNav(page)
    .getByRole('listitem', { name: /^More\b/ })
    .click();
  await expect(moreNav(page)).toBeVisible({ timeout: 10_000 });
}

async function dismissInstallPromptIfPresent(page: Page) {
  const dismiss = page.getByRole('button', { name: 'Dismiss' });
  if (await dismiss.isVisible().catch(() => false)) {
    await dismiss.click();
  }
}

export async function openPropertyDashboard(page: Page) {
  // Bookings shell — same sidebar as dashboard, fewer page-specific mocks.
  await page.goto(teamRbacPaths.bookings);
  await dismissInstallPromptIfPresent(page);
  await expect(adminNav(page)).toBeVisible({ timeout: 20_000 });
  await expectNavLinkVisible(page, 'Bookings');
}

export async function expectOnAllowedPropertySection(page: Page) {
  await expect(page).toHaveURL(
    new RegExp(`/org/${TEAM_E2E_ORG_SLUG}/property/${TEAM_E2E_PROPERTY_SLUG}(/bookings)?(\\?|$)`),
    { timeout: 20_000 }
  );
  await expect(adminNav(page)).toBeVisible({ timeout: 20_000 });
}

export async function expectNavLinkVisible(page: Page, label: string) {
  const root = adminNav(page);
  if (!usesCompactAdminNav(page)) {
    await expect(root.getByRole('link', { name: label })).toBeVisible();
    return;
  }

  const bottomTab = adminNavEntry(root, label);
  if ((await bottomTab.count()) > 0) {
    await expect(bottomTab.first()).toBeVisible();
    return;
  }

  await openAdminMoreSheet(page);
  await expect(moreNav(page).getByRole('link', { name: label })).toBeVisible();
}

export async function expectNavLinkHidden(page: Page, label: string) {
  const root = adminNav(page);
  if (!usesCompactAdminNav(page)) {
    await expect(root.getByRole('link', { name: label })).toHaveCount(0);
    return;
  }

  await expect(adminNavEntry(root, label)).toHaveCount(0);

  await openAdminMoreSheet(page);
  await expect(moreNav(page).getByRole('link', { name: label })).toHaveCount(0);
}
