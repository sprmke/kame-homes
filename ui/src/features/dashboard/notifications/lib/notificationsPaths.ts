import { useNotificationsOrgScope } from '@/features/dashboard/notifications/lib/notificationsScope';
import { useOptionalOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { useOptionalParkingContext } from '@/features/dashboard/org/components/RequireParkingContext';
import {
  bookingDetailPath,
  getLastParkingSlug,
  getLastPropertySlug,
  getLastTenantKind,
  parkingBookingDetailPath,
  parkingInboxPath,
  parkingNotificationsPath,
  propertyInboxPath,
  propertyNotificationsPath,
} from '@/features/dashboard/org/lib/tenantPaths';

type NotificationLike = {
  booking_id: string | null;
  conversation_id: string | null;
  property_id: string | null;
  parking_id: string | null;
};

export type NotificationPathScope = {
  orgSlug: string | null;
  propertySlugById: Map<string, string>;
  parkingSlugById: Map<string, string>;
};

/** Click-through destination for a notification, or null when it can't be resolved yet. */
export function resolveNotificationPath(
  notification: NotificationLike,
  { orgSlug, propertySlugById, parkingSlugById }: NotificationPathScope
): string | null {
  if (!orgSlug) return null;

  if (notification.booking_id && notification.property_id) {
    const slug = propertySlugById.get(notification.property_id);
    if (slug) return bookingDetailPath(orgSlug, slug, notification.booking_id);
  }

  if (notification.booking_id && notification.parking_id) {
    const slug = parkingSlugById.get(notification.parking_id);
    if (slug) return parkingBookingDetailPath(orgSlug, slug, notification.booking_id);
  }

  if (notification.conversation_id && notification.property_id) {
    const slug = propertySlugById.get(notification.property_id);
    if (slug) return propertyInboxPath(orgSlug, slug);
  }

  if (notification.conversation_id && notification.parking_id) {
    const slug = parkingSlugById.get(notification.parking_id);
    if (slug) return parkingInboxPath(orgSlug, slug);
  }

  return null;
}

/** Legacy in-app activity anchor — still accepted on inbound links. */
export const IN_APP_NOTIFICATIONS_SECTION_ID = 'activity';

/** Sidebar / main-content group label for the in-app feed block. */
export const IN_APP_NOTIFICATIONS_NAV_GROUP_LABEL = 'In-app notifications';

export function notificationsHubActivityHash(): string {
  return `#section-${IN_APP_NOTIFICATIONS_SECTION_ID}`;
}

/** Top-level views on the Notifications hub page. */
export const NOTIFICATIONS_HUB_VIEWS = ['activity', 'telegram'] as const;

export type NotificationsHubView = (typeof NOTIFICATIONS_HUB_VIEWS)[number];

export const NOTIFICATIONS_HUB_VIEW_PARAM = 'view';

export function isNotificationsHubView(value: string | null): value is NotificationsHubView {
  return (NOTIFICATIONS_HUB_VIEWS as readonly string[]).includes(value ?? '');
}

/** `?view=telegram` suffix for links that must land on a specific hub view. */
export function notificationsHubViewQuery(view: NotificationsHubView): string {
  return `?${NOTIFICATIONS_HUB_VIEW_PARAM}=${view}`;
}

type NotificationsHubViewInput = {
  /** `?view=` value, if present. */
  view: string | null;
  /** Tenant-validated `?module=` value, if present. */
  module: string | null;
  /** Legacy `?section=` value, if present. */
  section: string | null;
  /** `location.hash`, for the legacy `#section-activity` deep link. */
  hash: string;
};

/**
 * Which hub view an inbound URL opens. An explicit `?view=` always wins; a
 * valid `?module=` means the host came to configure one Telegram bot; the
 * legacy activity anchors still open the feed. Everything else opens the feed,
 * because that is what the sidebar entry is for.
 */
export function resolveNotificationsHubView({
  view,
  module,
  section,
  hash,
}: NotificationsHubViewInput): NotificationsHubView {
  if (isNotificationsHubView(view)) return view;
  if (module) return 'telegram';
  if (section === IN_APP_NOTIFICATIONS_SECTION_ID) return 'activity';
  if (hash === notificationsHubActivityHash()) return 'activity';
  return 'activity';
}

/** Notifications settings + in-app activity feed for the current tenant scope. */
export function useNotificationsHubPath(): string | null {
  const tenant = useOptionalOrgContext();
  const parkingTenant = useOptionalParkingContext();
  const { orgSlug } = useNotificationsOrgScope();

  if (!orgSlug) return null;

  if (parkingTenant) {
    return parkingNotificationsPath(orgSlug, parkingTenant.parkingSlug);
  }

  if (tenant) {
    return propertyNotificationsPath(orgSlug, tenant.propertySlug);
  }

  const kind = getLastTenantKind();
  if (kind === 'parking') {
    const parkingSlug = getLastParkingSlug();
    if (parkingSlug) return parkingNotificationsPath(orgSlug, parkingSlug);
  }

  const propertySlug = getLastPropertySlug();
  if (propertySlug) return propertyNotificationsPath(orgSlug, propertySlug);

  return null;
}
