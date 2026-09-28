import { expandLegacyPropertyPermissionIds } from '@/features/dashboard/team/lib/legacyPermissionExpansion';
import type { TeamPermission } from '@/features/dashboard/team/types/propertyTeam';

export type PropertyAccessKind = 'owner' | 'platform_admin' | 'org_admin' | 'member';

export type PropertyAccessPayload = {
  accessKind: PropertyAccessKind;
  permissions: string[];
  memberId: string | null;
  propertyId: string;
  orgSlug: string;
  orgName: string;
  propertySlug: string;
  propertyName: string;
  planLimited?: boolean;
};

export type TeamPermissionId = TeamPermission['id'];

export type PropertySection =
  | 'dashboard'
  | 'bookings'
  | 'finance'
  | 'pricing'
  | 'analytics'
  | 'maintenance'
  | 'marketing'
  | 'notifications'
  | 'templates'
  | 'public-pages'
  | 'plans'
  | 'team'
  | 'settings'
  | 'inbox'
  | 'activity'
  | 'announcements'
  | 'help-support';

export function hasPropertyPermission(
  permissions: readonly string[] | undefined,
  required: TeamPermissionId
): boolean {
  if (!permissions?.length) return false;
  return expandLegacyPropertyPermissionIds(permissions).includes(required);
}

/** Booking edit-form tab → leaf permission. Pricing edits live on Progress, not this form. */
export const BOOKING_EDIT_TAB_PERMISSION = {
  stay: 'bookings.detail.stay:edit',
  guest: 'bookings.detail.guests:edit',
  parking: 'bookings.detail.parking:edit',
  pets: 'bookings.detail.pets:edit',
} as const satisfies Record<string, TeamPermissionId>;

/** Property Settings section id → edit leaf (integrations is view-only). */
export const SETTINGS_SECTION_EDIT_PERMISSION = {
  basic: 'settings.basicInfo:edit',
  media: 'settings.media:edit',
  details: 'settings.propertyDetails:edit',
  amenities: 'settings.amenities:edit',
  'house-rules': 'settings.houseRules:edit',
  'guest-form': 'settings.guestForm:edit',
  cancellation: 'settings.cancellationPolicy:edit',
  location: 'settings.location:edit',
  branding: 'settings.socials:edit',
  'guest-rewards': 'settings.socials:edit',
  payment: 'settings.payment:edit',
  'building-forms': 'settings.buildingForms:edit',
  'email-automations': 'settings.emailAutomations:edit',
  integrations: null,
  danger: 'settings.dangerZone:edit',
} as const satisfies Record<
  import('@/features/dashboard/org/lib/propertySettingsCompletion').PropertySettingsSectionId,
  TeamPermissionId | null
>;

export type BookingEditTabPermissionId = keyof typeof BOOKING_EDIT_TAB_PERMISSION;

/** True if the member can edit any booking detail tab (including Progress pricing). */
export function hasAnyBookingDetailEditPermission(
  permissions: readonly string[] | undefined
): boolean {
  return (
    hasPropertyPermission(permissions, 'bookings.detail.stay:edit') ||
    hasPropertyPermission(permissions, 'bookings.detail.guests:edit') ||
    hasPropertyPermission(permissions, 'bookings.detail.parking:edit') ||
    hasPropertyPermission(permissions, 'bookings.detail.pets:edit') ||
    hasPropertyPermission(permissions, 'bookings.detail.pricing:edit')
  );
}

/** Ex-`team:manage` — members or custom-role mutations. */
export function hasPropertyTeamManageAccess(permissions: readonly string[] | undefined): boolean {
  return (
    hasPropertyPermission(permissions, 'team.members:edit') ||
    hasPropertyPermission(permissions, 'team.members:delete') ||
    hasPropertyPermission(permissions, 'team.customRoles:add') ||
    hasPropertyPermission(permissions, 'team.customRoles:edit') ||
    hasPropertyPermission(permissions, 'team.customRoles:delete')
  );
}

/** Q3 — shared Telegram bot token editable with any module edit. */
export function hasAnyNotificationModuleEditPermission(
  permissions: readonly string[] | undefined
): boolean {
  return (
    hasPropertyPermission(permissions, 'notifications.chat:edit') ||
    hasPropertyPermission(permissions, 'notifications.marketing:edit') ||
    hasPropertyPermission(permissions, 'notifications.staff:edit') ||
    hasPropertyPermission(permissions, 'notifications.operations:edit') ||
    hasPropertyPermission(permissions, 'notifications.finance:edit') ||
    hasPropertyPermission(permissions, 'notifications.maintenance:edit')
  );
}

export const NOTIFICATION_MODULE_EDIT_PERMISSION = {
  chat: 'notifications.chat:edit',
  marketing: 'notifications.marketing:edit',
  staff: 'notifications.staff:edit',
  operations: 'notifications.operations:edit',
  finance: 'notifications.finance:edit',
  maintenance: 'notifications.maintenance:edit',
} as const satisfies Record<string, TeamPermissionId>;

/** Ex-`inbox:manage` — any channels / quick replies / automation leaf. */
export function hasInboxManageAccess(permissions: readonly string[] | undefined): boolean {
  return (
    hasPropertyPermission(permissions, 'inbox.channels:add') ||
    hasPropertyPermission(permissions, 'inbox.channels:delete') ||
    hasPropertyPermission(permissions, 'inbox.quickReplies:add') ||
    hasPropertyPermission(permissions, 'inbox.quickReplies:edit') ||
    hasPropertyPermission(permissions, 'inbox.quickReplies:delete') ||
    hasPropertyPermission(permissions, 'inbox.automation:edit')
  );
}

/** Content Studio — create or edit calendar / design / video. */
export function hasMarketingContentEditAccess(permissions: readonly string[] | undefined): boolean {
  return (
    hasPropertyPermission(permissions, 'marketing.content:add') ||
    hasPropertyPermission(permissions, 'marketing.content:edit')
  );
}

export function hasMarketingTemplateManageAccess(
  permissions: readonly string[] | undefined
): boolean {
  return (
    hasPropertyPermission(permissions, 'marketing.templates:add') ||
    hasPropertyPermission(permissions, 'marketing.templates:edit') ||
    hasPropertyPermission(permissions, 'marketing.templates:delete')
  );
}

/** Edit-form tabs the member may open (Stay / Guests / Parking / Pets). */
export function bookingEditableTabs(
  permissions: readonly string[] | undefined
): BookingEditTabPermissionId[] {
  return (Object.keys(BOOKING_EDIT_TAB_PERMISSION) as BookingEditTabPermissionId[]).filter((tab) =>
    hasPropertyPermission(permissions, BOOKING_EDIT_TAB_PERMISSION[tab])
  );
}

/** Minimum view permission per property sidebar nav label. */
export const PROPERTY_NAV_VIEW_PERMISSION: Record<string, TeamPermissionId> = {
  Dashboard: 'bookings:view',
  Bookings: 'bookings:view',
  Finance: 'finance:view',
  Pricing: 'pricing:view',
  Analytics: 'analytics:view',
  Maintenance: 'maintenance:view',
  Marketing: 'marketing:view',
  Notifications: 'notifications:view',
  Templates: 'templates:view',
  'Public Pages': 'publicPages:view',
  'Plans & Billing': 'settings:view',
  Team: 'team:view',
  Settings: 'settings:view',
  Inbox: 'inbox:view',
  Activity: 'activity:view',
  Announcements: 'bookings:view',
};

/** Minimum view permission per property route section. */
export const PROPERTY_SECTION_VIEW_PERMISSION = {
  dashboard: 'bookings:view',
  bookings: 'bookings:view',
  finance: 'finance:view',
  pricing: 'pricing:view',
  analytics: 'analytics:view',
  maintenance: 'maintenance:view',
  marketing: 'marketing:view',
  notifications: 'notifications:view',
  templates: 'templates:view',
  'public-pages': 'publicPages:view',
  plans: 'settings:view',
  team: 'team:view',
  settings: 'settings:view',
  inbox: 'inbox:view',
  // Audit data (who changed what) has its own view leaf; backfilled to existing bookings viewers.
  activity: 'activity:view',
  // Help + Announcements stay baseline for any active property member (RequirePropertyPermission special-cases them).
  announcements: 'bookings:view',
  'help-support': 'bookings:view',
} as const satisfies Record<PropertySection, TeamPermissionId>;
