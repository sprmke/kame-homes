/**
 * AI assistant — Phase 5/6 guidance reads (notifications, Telegram, create booking, import).
 * Deep-link tools are Tier 0 only — no OTP bypass, no CSV auto-commit.
 */

import type { ActionRiskTier } from './dashboardAssistantRiskClassifier.ts';
import type { AttachedContextItem } from './dashboardAssistantAttachedContext.ts';
import { DatabaseService } from './databaseService.ts';
import {
  createServiceClient,
  verifyOrgAccess,
  verifyParkingTeamAccess,
  verifyPropertyAccess,
} from './orgAuth.ts';
import { resolveOrganizationIdForProperty, resolvePropertySlugById } from './propertyScope.ts';
import {
  getParkingTelegramGlobalBotAdminStatus,
  getPropertyTelegramGlobalBotAdminStatus,
} from './telegramGlobalBotToken.ts';
import { getPropertyTelegramCredentialsStatus } from './propertyTelegramCredentials.ts';
import { serializeChatSettings } from './telegramChat.ts';
import { serializeFinanceSettings } from './telegramFinance.ts';
import { serializeMaintenanceSettings } from './telegramMaintenance.ts';
import { serializeParkingTelegramSettings } from './telegramParking.ts';
import { serializeStaffSettings } from './telegramStaff.ts';
import { serializeAdminSettings } from './telegramAdmin.ts';
import { serializeTelegramSettings } from './telegramMarketing.ts';
import { telegramDbScope } from './telegramAssetScope.ts';
import type { TelegramChannel } from './propertyTelegramCredentials.ts';
import { featureAvailabilitySummaryForAssistant } from './featureAvailability.ts';
import type { FeatureAvailabilityKey } from './featureAvailabilityCatalog.ts';

const TELEGRAM_ASSISTANT_AVAILABILITY_KEYS = [
  'notifications.telegram',
  'notifications.telegram.settings',
  'notifications.telegram.delivery',
] as const satisfies readonly FeatureAvailabilityKey[];

export type GuidanceToolContext = {
  req: Request;
  organizationId: string;
  userId: string;
  userEmail: string;
  pageContext: { propertyId?: string | null; bookingId?: string | null; parkingId?: string | null };
  attachedContext: AttachedContextItem[];
  isBulk: boolean;
  conversationId?: string | null;
};

export type GuidanceToolResult = {
  ok: boolean;
  error?: string;
  data?: unknown;
  riskTier?: ActionRiskTier;
  proposed?: boolean;
  auditPropertyId?: string | null;
  auditBookingId?: string | null;
};

function str(args: Record<string, unknown>, key: string): string | null {
  const v = args[key];
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t || null;
}

/** Same gate as Notification Center — not Telegram `notifications:view`. */
async function assertNotificationCenterReadAccess(
  ctx: GuidanceToolContext,
  opts?: { propertyId?: string | null; parkingId?: string | null }
): Promise<void> {
  const propertyId = opts?.propertyId ?? ctx.pageContext.propertyId ?? null;
  const parkingId = opts?.parkingId ?? ctx.pageContext.parkingId ?? null;
  if (propertyId) {
    await assertPropertyInOrg(propertyId, ctx.organizationId);
    await verifyPropertyAccess(ctx.req, propertyId, 'bookings:view');
    return;
  }
  if (parkingId) {
    await verifyParkingTeamAccess(ctx.req, parkingId, 'bookings:view');
    return;
  }
  await verifyOrgAccess(ctx.req, { orgId: ctx.organizationId }, 'org.dashboard:view');
}

async function resolveOrgSlug(organizationId: string): Promise<string | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('organizations')
    .select('slug')
    .eq('id', organizationId)
    .maybeSingle();
  const slug = typeof data?.slug === 'string' ? data.slug.trim() : '';
  return slug || null;
}

async function resolveParkingSlug(
  parkingId: string,
  organizationId: string
): Promise<string | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('parkings')
    .select('slug')
    .eq('id', parkingId)
    .eq('organization_id', organizationId)
    .maybeSingle();
  const slug = typeof data?.slug === 'string' ? data.slug.trim() : '';
  return slug || null;
}

function moduleToTelegramChannel(module: string): TelegramChannel {
  if (module === 'operations') return 'admin';
  if (module === 'parking') return 'parking';
  return module as TelegramChannel;
}

async function assertPropertyInOrg(propertyId: string, organizationId: string): Promise<void> {
  const orgId = await resolveOrganizationIdForProperty(propertyId);
  if (orgId !== organizationId) throw new Error('Property is outside this organization');
}

type SafeTelegramCredentials = {
  tokenConfigured: boolean;
  chatIdConfigured: boolean;
  connected: boolean;
};

async function safeTelegramCredentials(
  channel: TelegramChannel,
  scope: { propertyId?: string; parkingId?: string }
): Promise<SafeTelegramCredentials> {
  const status = await getPropertyTelegramCredentialsStatus(channel, scope);
  return {
    tokenConfigured: status.tokenConfigured,
    chatIdConfigured: status.chatIdConfigured,
    connected: status.tokenConfigured && status.chatIdConfigured,
  };
}

async function loadPropertyTelegramModule(
  propertyId: string,
  module: string
): Promise<Record<string, unknown> | null> {
  switch (module) {
    case 'chat': {
      const row = await DatabaseService.getTelegramChatSettings(propertyId, undefined);
      return row ? { ...serializeChatSettings(row), module: 'chat', label: 'Guest chat' } : null;
    }
    case 'marketing': {
      const row = await DatabaseService.getTelegramMarketingSettings(propertyId, undefined);
      return row
        ? { ...serializeTelegramSettings(row), module: 'marketing', label: 'Marketing' }
        : null;
    }
    case 'staff': {
      const row = await DatabaseService.getTelegramStaffSettings(propertyId, undefined);
      return row ? { ...serializeStaffSettings(row), module: 'staff', label: 'Staff' } : null;
    }
    case 'operations': {
      const row = await DatabaseService.getTelegramAdminSettings(propertyId, undefined);
      return row
        ? { ...serializeAdminSettings(row), module: 'operations', label: 'Operations' }
        : null;
    }
    case 'finance': {
      const row = await DatabaseService.getTelegramFinanceSettings(propertyId, undefined);
      return row ? { ...serializeFinanceSettings(row), module: 'finance', label: 'Finance' } : null;
    }
    case 'maintenance': {
      const row = await DatabaseService.getTelegramMaintenanceSettings(propertyId, undefined);
      return row
        ? { ...serializeMaintenanceSettings(row), module: 'maintenance', label: 'Maintenance' }
        : null;
    }
    default:
      return null;
  }
}

const PROPERTY_TELEGRAM_MODULES = [
  'chat',
  'marketing',
  'staff',
  'operations',
  'finance',
  'maintenance',
] as const;

const PARKING_TELEGRAM_MODULES = ['chat', 'parking', 'finance'] as const;

const MODULE_QUERY_PARAM: Record<string, string> = {
  chat: 'chat',
  marketing: 'marketing',
  staff: 'staff',
  operations: 'operations',
  finance: 'finance',
  maintenance: 'maintenance',
  parking: 'parking',
};

export async function toolGetNotificationPreferences(
  ctx: GuidanceToolContext,
  _args: Record<string, unknown>
): Promise<GuidanceToolResult> {
  try {
    await assertNotificationCenterReadAccess(ctx);

    const sb = createServiceClient();
    let activeDeviceCount = 0;
    const { count, error } = await sb
      .from('push_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', ctx.userId)
      .is('disabled_at', null);
    if (error) {
      // Local stacks without PWA migrations may not have push_subscriptions yet.
      const missingTable =
        error.code === '42P01' ||
        /push_subscriptions/i.test(error.message) ||
        /does not exist/i.test(error.message);
      if (!missingTable) throw new Error(error.message);
    } else {
      activeDeviceCount = count ?? 0;
    }

    const orgSlug = await resolveOrgSlug(ctx.organizationId);
    const propertyId = ctx.pageContext.propertyId ?? null;
    const parkingId = ctx.pageContext.parkingId ?? null;
    let settingsPath: string | null = null;
    if (orgSlug && propertyId) {
      const propertySlug = await resolvePropertySlugById(propertyId);
      if (propertySlug) {
        settingsPath = `/org/${orgSlug}/property/${propertySlug}/notifications`;
      }
    } else if (orgSlug && parkingId) {
      const parkingSlug = await resolveParkingSlug(parkingId, ctx.organizationId);
      if (parkingSlug) {
        settingsPath = `/org/${orgSlug}/parking/${parkingSlug}/notifications`;
      }
    }

    return {
      ok: true,
      riskTier: 'tier0_read',
      data: {
        inAppNotifications: {
          description: 'Booking and inbox activity appears in the bell and Notifications page.',
          configurableViaChat: false,
        },
        webPush: {
          activeDeviceCount,
          optedIn: activeDeviceCount > 0,
          perEventTypeMatrix: false,
          note: 'Master per-device toggle only — no per-event-type preference API yet.',
        },
        telegramOutbound: {
          description:
            'Telegram module toggles and credentials are separate — use get_telegram_notification_settings.',
          configurableViaChat: false,
        },
        settingsPath,
        hostHint:
          'Open Notifications to manage Web Push on this device or configure Telegram modules. Chat cannot change push/Telegram credentials — finish in the UI.',
      },
    };
  } catch (err) {
    if (err instanceof Response) return { ok: false, error: 'Access restricted for this action.' };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function toolGuideNotificationSettings(
  ctx: GuidanceToolContext,
  args: Record<string, unknown>
): Promise<GuidanceToolResult> {
  try {
    const module = str(args, 'module') ?? undefined;
    const propertyId = str(args, 'propertyId') ?? ctx.pageContext.propertyId ?? null;
    const parkingId = str(args, 'parkingId') ?? ctx.pageContext.parkingId ?? null;
    await assertNotificationCenterReadAccess(ctx, { propertyId, parkingId });

    const orgSlug = await resolveOrgSlug(ctx.organizationId);

    let settingsPath: string | null = null;
    if (orgSlug && propertyId) {
      const propertySlug = await resolvePropertySlugById(propertyId);
      if (propertySlug) {
        const base = `/org/${orgSlug}/property/${propertySlug}/notifications`;
        settingsPath =
          module && MODULE_QUERY_PARAM[module]
            ? `${base}?module=${MODULE_QUERY_PARAM[module]}`
            : base;
      }
    } else if (orgSlug && parkingId) {
      const parkingSlug = await resolveParkingSlug(parkingId, ctx.organizationId);
      if (parkingSlug) {
        const base = `/org/${orgSlug}/parking/${parkingSlug}/notifications`;
        settingsPath =
          module && MODULE_QUERY_PARAM[module]
            ? `${base}?module=${MODULE_QUERY_PARAM[module]}`
            : base;
      }
    }

    return {
      ok: true,
      riskTier: 'tier0_read',
      auditPropertyId: propertyId,
      data: {
        settingsPath,
        steps: [
          'Open Notifications from the dashboard (or use settingsPath).',
          'Web Push: toggle push on this device under In-app notifications.',
          'Telegram: enable a module, connect bot token + chat ID, then verify — some payment changes still need email OTP in Settings.',
        ],
        notAvailableInChat: [
          'Per-event-type push matrix (not built yet).',
          'Telegram bot token / chat ID writes (use Notifications UI — same OTP rules as dashboard).',
        ],
      },
    };
  } catch (err) {
    if (err instanceof Response) return { ok: false, error: 'Access restricted for this action.' };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function toolGetTelegramNotificationSettings(
  ctx: GuidanceToolContext,
  args: Record<string, unknown>
): Promise<GuidanceToolResult> {
  try {
    const propertyId = str(args, 'propertyId') ?? ctx.pageContext.propertyId ?? null;
    const parkingId = str(args, 'parkingId') ?? ctx.pageContext.parkingId ?? null;
    if (!propertyId && !parkingId) {
      return { ok: false, error: 'propertyId or parkingId is required' };
    }
    if (propertyId && parkingId) {
      return { ok: false, error: 'Provide only one of propertyId or parkingId' };
    }

    const orgSlug = await resolveOrgSlug(ctx.organizationId);
    const availability = await featureAvailabilitySummaryForAssistant(
      TELEGRAM_ASSISTANT_AVAILABILITY_KEYS,
      { id: ctx.userId, email: ctx.userEmail }
    );
    let settingsPath: string | null = null;
    const modules: Array<Record<string, unknown>> = [];

    if (propertyId) {
      await assertPropertyInOrg(propertyId, ctx.organizationId);
      await verifyPropertyAccess(ctx.req, propertyId, 'notifications:view');
      const propertySlug = await resolvePropertySlugById(propertyId);
      if (orgSlug && propertySlug) {
        settingsPath = `/org/${orgSlug}/property/${propertySlug}/notifications`;
      }
      const scope = telegramDbScope({ kind: 'property', id: propertyId });
      for (const mod of PROPERTY_TELEGRAM_MODULES) {
        const serialized = await loadPropertyTelegramModule(propertyId, mod);
        if (!serialized) continue;
        const creds = await safeTelegramCredentials(moduleToTelegramChannel(mod), scope);
        modules.push({
          ...serialized,
          credentials: creds,
        });
      }
      const globalBot = await getPropertyTelegramGlobalBotAdminStatus(propertyId);
      return {
        ok: true,
        riskTier: 'tier0_read',
        auditPropertyId: propertyId,
        data: {
          scope: 'property',
          propertyId,
          settingsPath,
          sharedBotTokenConfigured: globalBot.tokenConfigured,
          modules,
          availability,
          writesRequireUi:
            'Enable toggles, bot token, chat ID, and templates must be edited in Notifications — chat never bypasses OTP-gated payment settings.',
        },
      };
    }

    await verifyOrgAccess(ctx.req, { orgId: ctx.organizationId }, 'org.parkings:view');
    const parkingSlug = await resolveParkingSlug(parkingId!, ctx.organizationId);
    if (orgSlug && parkingSlug) {
      settingsPath = `/org/${orgSlug}/parking/${parkingSlug}/notifications`;
    }
    const scope = telegramDbScope({ kind: 'parking', id: parkingId! });
    for (const mod of PARKING_TELEGRAM_MODULES) {
      let serialized: Record<string, unknown> | null = null;
      if (mod === 'chat') {
        const row = await DatabaseService.getTelegramChatSettings(undefined, parkingId!);
        serialized = row
          ? { ...serializeChatSettings(row), module: 'chat', label: 'Guest chat' }
          : null;
      } else if (mod === 'parking') {
        const row = await DatabaseService.getTelegramParkingSettings(parkingId!);
        serialized = row
          ? { ...serializeParkingTelegramSettings(row), module: 'parking', label: 'Parking' }
          : null;
      } else if (mod === 'finance') {
        const row = await DatabaseService.getTelegramFinanceSettings(undefined, parkingId!);
        serialized = row
          ? { ...serializeFinanceSettings(row), module: 'finance', label: 'Finance' }
          : null;
      }
      if (!serialized) continue;
      const channel: TelegramChannel =
        mod === 'parking' ? 'parking' : mod === 'finance' ? 'finance' : 'chat';
      const creds = await safeTelegramCredentials(channel, scope);
      modules.push({ ...serialized, credentials: creds });
    }
    const globalBot = await getParkingTelegramGlobalBotAdminStatus(parkingId!);
    return {
      ok: true,
      riskTier: 'tier0_read',
      data: {
        scope: 'parking',
        parkingId,
        settingsPath,
        sharedBotTokenConfigured: globalBot.tokenConfigured,
        modules,
        availability,
        writesRequireUi:
          'Telegram credential and enable changes require the Notifications UI — no assistant bypass.',
      },
    };
  } catch (err) {
    if (err instanceof Response) return { ok: false, error: 'Access restricted for this action.' };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function toolGuideTelegramSettings(
  ctx: GuidanceToolContext,
  args: Record<string, unknown>
): Promise<GuidanceToolResult> {
  const read = await toolGetTelegramNotificationSettings(ctx, args);
  if (!read.ok) return read;
  const data = read.data as Record<string, unknown>;
  const module = str(args, 'module');
  const basePath = typeof data.settingsPath === 'string' ? data.settingsPath : null;
  const modulePath =
    basePath && module && MODULE_QUERY_PARAM[module]
      ? `${basePath}?module=${MODULE_QUERY_PARAM[module]}`
      : basePath;

  const availability = data.availability as
    Record<string, { available: boolean; message: string | null }> | undefined;
  const deliveryOff = availability?.['notifications.telegram.delivery']?.available === false;
  const settingsOff = availability?.['notifications.telegram.settings']?.available === false;
  const steps = [
    'Open Notifications → choose the Telegram module.',
    ...(settingsOff
      ? [
          availability?.['notifications.telegram.settings']?.message ??
            'Telegram settings are temporarily unavailable in the dashboard.',
        ]
      : [
          'Turn Enable on (requires telegramNotifications plan on property modules).',
          'Set shared bot token if needed, then module chat ID — use Verify before saving.',
        ]),
    ...(deliveryOff
      ? [
          availability?.['notifications.telegram.delivery']?.message ??
            'Telegram delivery is paused; test sends and live alerts will not go out until it is back.',
        ]
      : []),
    'Payment-method commits that touch GCash still need email OTP in Payment settings.',
  ];

  return {
    ok: true,
    riskTier: 'tier0_read',
    auditPropertyId: read.auditPropertyId,
    data: {
      ...data,
      modulePath,
      steps,
      notAvailableInChat: [
        'Bot token / chat ID PATCH from chat',
        'Bypassing OTP on payment methods',
      ],
    },
  };
}

const CREATE_BOOKING_CHECKLIST = [
  'Primary guest name and Philippine mobile number',
  'Check-in and check-out dates (and times if your property requires them)',
  'Guest count (adults / children)',
  'Booking source (Facebook, Airbnb, etc.)',
  'Pricing: booking rate, down payment, security deposit (Airbnb may default DP/SD to ₱0)',
  'Parking and pet sections when applicable',
  'Payment receipt when required by source and property rules',
  'Guest valid IDs for guests aged 18+ when required',
];

export async function toolGuideCreateBooking(
  ctx: GuidanceToolContext,
  args: Record<string, unknown>
): Promise<GuidanceToolResult> {
  try {
    const propertyId = str(args, 'propertyId') ?? ctx.pageContext.propertyId ?? null;
    if (!propertyId) return { ok: false, error: 'propertyId is required' };
    await assertPropertyInOrg(propertyId, ctx.organizationId);
    await verifyPropertyAccess(ctx.req, propertyId, 'bookings.create:add');

    const orgSlug = await resolveOrgSlug(ctx.organizationId);
    const propertySlug = await resolvePropertySlugById(propertyId);
    const bookingsPath =
      orgSlug && propertySlug ? `/org/${orgSlug}/property/${propertySlug}/bookings` : null;

    return {
      ok: true,
      riskTier: 'tier0_read',
      auditPropertyId: propertyId,
      data: {
        bookingsPath,
        action: 'Click **New booking** on the Bookings page to open the guest form modal.',
        requiredFieldsChecklist: CREATE_BOOKING_CHECKLIST,
        bookingFieldEdits: {
          availableInChat: false,
          reason:
            'Admin booking edits use BookingEditForm with workflow-sensitive revert rules and direct guest_submissions PATCH — no shared safe assistant write path. Edit on the booking detail page.',
        },
      },
    };
  } catch (err) {
    if (err instanceof Response) return { ok: false, error: 'Access restricted for this action.' };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function toolGuideImportBookings(
  ctx: GuidanceToolContext,
  args: Record<string, unknown>
): Promise<GuidanceToolResult> {
  try {
    const propertyId = str(args, 'propertyId') ?? ctx.pageContext.propertyId ?? null;
    if (!propertyId) return { ok: false, error: 'propertyId is required' };
    await assertPropertyInOrg(propertyId, ctx.organizationId);
    await verifyPropertyAccess(ctx.req, propertyId, 'bookings.import:add');

    const orgSlug = await resolveOrgSlug(ctx.organizationId);
    const propertySlug = await resolvePropertySlugById(propertyId);
    const bookingsPath =
      orgSlug && propertySlug ? `/org/${orgSlug}/property/${propertySlug}/bookings` : null;

    return {
      ok: true,
      riskTier: 'tier0_read',
      auditPropertyId: propertyId,
      data: {
        bookingsPath,
        action: 'Click **Import** beside New booking to open the import wizard.',
        wizardSteps: [
          'Upload CSV or Excel (≤2,000 rows, ≤15 MB)',
          'Map columns (AI assist available)',
          'Preview — fix or exclude error rows',
          'Confirm commit — past check-ins become IMPORTED; today/future → Pending Review',
        ],
        notAvailableInChat: [
          'Auto-upload or auto-commit CSV without preview confirm',
          'Skipping import-preview / import-commit pipeline',
        ],
        hostHint: 'Chat can explain the flow but cannot import rows — finish in the Import modal.',
      },
    };
  } catch (err) {
    if (err instanceof Response) return { ok: false, error: 'Access restricted for this action.' };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export const GET_NOTIFICATION_PREFERENCES_TOOL_DECLARATION = {
  name: 'get_notification_preferences',
  description:
    'Read Web Push opt-in status for the signed-in user and where notification settings live. No per-event preference API exists yet.',
  parameters: { type: 'object', properties: {} },
};

export const GUIDE_NOTIFICATION_SETTINGS_TOOL_DECLARATION = {
  name: 'guide_notification_settings',
  description:
    'Deep-link and steps for Notifications / Web Push / Telegram — writes stay in the UI (OTP rules unchanged).',
  parameters: {
    type: 'object',
    properties: {
      propertyId: { type: 'string' },
      parkingId: { type: 'string' },
      module: {
        type: 'string',
        enum: ['chat', 'marketing', 'staff', 'operations', 'finance', 'maintenance', 'parking'],
      },
    },
  },
};

export const GET_TELEGRAM_NOTIFICATION_SETTINGS_TOOL_DECLARATION = {
  name: 'get_telegram_notification_settings',
  description:
    'Read Telegram module enable flags and connection status (no secrets). Property or parking scope.',
  parameters: {
    type: 'object',
    properties: {
      propertyId: { type: 'string' },
      parkingId: { type: 'string' },
    },
  },
};

export const GUIDE_TELEGRAM_SETTINGS_TOOL_DECLARATION = {
  name: 'guide_telegram_settings',
  description:
    'Deep-link to configure Telegram notifications — credential writes require the Notifications UI, never chat.',
  parameters: {
    type: 'object',
    properties: {
      propertyId: { type: 'string' },
      parkingId: { type: 'string' },
      module: {
        type: 'string',
        enum: ['chat', 'marketing', 'staff', 'operations', 'finance', 'maintenance', 'parking'],
      },
    },
  },
};

export const GUIDE_CREATE_BOOKING_TOOL_DECLARATION = {
  name: 'guide_create_booking',
  description:
    'Deep-link to New booking modal on Bookings + required guest form checklist. Does not create a booking.',
  parameters: {
    type: 'object',
    properties: { propertyId: { type: 'string' } },
  },
};

export const GUIDE_IMPORT_BOOKINGS_TOOL_DECLARATION = {
  name: 'guide_import_bookings',
  description:
    'Deep-link to the Import wizard on Bookings — parse/preview/commit stay in UI; chat cannot auto-commit CSV.',
  parameters: {
    type: 'object',
    properties: { propertyId: { type: 'string' } },
  },
};
