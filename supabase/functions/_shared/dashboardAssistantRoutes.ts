/**
 * Route allowlist for the assistant's `open_page` tool and Open handoffs.
 * Source of truth; mirrored in ui/src/features/dashboard/ai-assistant/lib/assistantRoutes.ts
 * (a Vitest drift test compares the key lists). Only screens listed here can be linked, and each
 * carries the view permission the tool re-checks before returning an href.
 * Docs: docs/workflow/in-progress/ai-chat-mode.md (Phase 5) + docs/architecture/ai-dashboard-assistant.md.
 */

export type AssistantRouteScope = 'org' | 'property' | 'parking';

export type AssistantRouteDef = {
  scope: AssistantRouteScope;
  /** Path under the scope root; `:bookingId` is filled from args. Empty = scope root. */
  path: string;
  label: string;
  /** View permission for the section (property / parking team leaf, or org leaf). */
  permission: string;
  /** Query keys the caller may pass through (values are validated as short plain strings). */
  query?: readonly string[];
};

export const ASSISTANT_ROUTES = {
  'org.dashboard': {
    scope: 'org',
    path: 'dashboard',
    label: 'Dashboard',
    permission: 'org.dashboard:view',
  },
  'org.bookings': {
    scope: 'org',
    path: 'bookings',
    label: 'Bookings',
    permission: 'org.bookings:view',
    query: ['status', 'from', 'to', 'q'],
  },
  'org.properties': {
    scope: 'org',
    path: 'properties',
    label: 'Properties',
    permission: 'org.properties:view',
  },
  'org.parkings': {
    scope: 'org',
    path: 'parkings',
    label: 'Parking',
    permission: 'org.parkings:view',
  },
  'org.analytics': {
    scope: 'org',
    path: 'analytics',
    label: 'Analytics',
    permission: 'org.analytics:view',
  },
  'org.team': { scope: 'org', path: 'team', label: 'Team', permission: 'org.team:view' },
  'org.plans': { scope: 'org', path: 'plans', label: 'Plans', permission: 'org.plans:view' },
  'org.announcements': {
    scope: 'org',
    path: 'announcements',
    label: 'Announcements',
    permission: 'org.dashboard:view',
  },
  'org.settings': {
    scope: 'org',
    path: 'settings',
    label: 'Settings',
    permission: 'org.settings:view',
    query: ['section'],
  },
  'org.help-support': {
    scope: 'org',
    path: 'help-support',
    label: 'Help & Support',
    permission: 'org.dashboard:view',
  },

  'property.dashboard': {
    scope: 'property',
    path: '',
    label: 'Dashboard',
    permission: 'bookings:view',
  },
  'property.bookings': {
    scope: 'property',
    path: 'bookings',
    label: 'Bookings',
    permission: 'bookings:view',
    query: ['status', 'from', 'to', 'q'],
  },
  'property.booking': {
    scope: 'property',
    path: 'bookings/:bookingId',
    label: 'Booking',
    permission: 'bookings:view',
    query: ['tab'],
  },
  'property.finance': {
    scope: 'property',
    path: 'finance',
    label: 'Finance',
    permission: 'finance:view',
    query: ['tab', 'from', 'to'],
  },
  'property.maintenance': {
    scope: 'property',
    path: 'maintenance',
    label: 'Maintenance',
    permission: 'maintenance:view',
  },
  'property.pricing': {
    scope: 'property',
    path: 'pricing',
    label: 'Pricing',
    permission: 'pricing:view',
  },
  'property.analytics': {
    scope: 'property',
    path: 'analytics',
    label: 'Analytics',
    permission: 'analytics:view',
  },
  'property.team': { scope: 'property', path: 'team', label: 'Team', permission: 'team:view' },
  'property.marketing': {
    scope: 'property',
    path: 'marketing',
    label: 'Marketing',
    permission: 'marketing:view',
  },
  'property.inbox': { scope: 'property', path: 'inbox', label: 'Inbox', permission: 'inbox:view' },
  'property.notifications': {
    scope: 'property',
    path: 'notifications',
    label: 'Notifications',
    permission: 'notifications:view',
    query: ['module'],
  },
  'property.templates': {
    scope: 'property',
    path: 'templates',
    label: 'Templates',
    permission: 'templates:view',
  },
  'property.public-pages': {
    scope: 'property',
    path: 'public-pages',
    label: 'Public pages',
    permission: 'publicPages:view',
  },
  'property.settings': {
    scope: 'property',
    path: 'settings',
    label: 'Settings',
    permission: 'settings:view',
    query: ['section'],
  },
  'property.help-support': {
    scope: 'property',
    path: 'help-support',
    label: 'Help & Support',
    permission: 'bookings:view',
  },

  'parking.dashboard': {
    scope: 'parking',
    path: '',
    label: 'Dashboard',
    permission: 'bookings:view',
  },
  'parking.bookings': {
    scope: 'parking',
    path: 'bookings',
    label: 'Bookings',
    permission: 'bookings:view',
    query: ['status', 'from', 'to', 'q'],
  },
  'parking.booking': {
    scope: 'parking',
    path: 'bookings/:bookingId',
    label: 'Booking',
    permission: 'bookings:view',
  },
  'parking.finance': {
    scope: 'parking',
    path: 'finance',
    label: 'Finance',
    permission: 'finance:view',
  },
  'parking.pricing': {
    scope: 'parking',
    path: 'pricing',
    label: 'Pricing',
    permission: 'pricing:view',
  },
  'parking.team': { scope: 'parking', path: 'team', label: 'Team', permission: 'team:view' },
  'parking.inbox': { scope: 'parking', path: 'inbox', label: 'Inbox', permission: 'inbox:view' },
  'parking.notifications': {
    scope: 'parking',
    path: 'notifications',
    label: 'Notifications',
    permission: 'notifications:view',
    query: ['module'],
  },
  'parking.settings': {
    scope: 'parking',
    path: 'settings',
    label: 'Settings',
    permission: 'settings:view',
    query: ['section'],
  },
  'parking.help-support': {
    scope: 'parking',
    path: 'help-support',
    label: 'Help & Support',
    permission: 'bookings:view',
  },
} as const satisfies Record<string, AssistantRouteDef>;

export type AssistantRouteKey = keyof typeof ASSISTANT_ROUTES;

export const ASSISTANT_ROUTE_KEYS = Object.keys(ASSISTANT_ROUTES) as AssistantRouteKey[];

export function isAssistantRouteKey(value: unknown): value is AssistantRouteKey {
  return typeof value === 'string' && Object.hasOwn(ASSISTANT_ROUTES, value);
}

const QUERY_VALUE_RE = /^[\w\-.,: ]{1,120}$/;
const BOOKING_ID_RE = /^[0-9a-f-]{8,64}$/i;

/**
 * Builds the in-app href for a route. Returns null when a required slug / id is missing or a
 * value fails validation, so the tool refuses instead of producing a broken link.
 */
export function buildAssistantRouteHref(
  key: AssistantRouteKey,
  input: {
    orgSlug: string;
    propertySlug?: string | null;
    parkingSlug?: string | null;
    bookingId?: string | null;
    query?: Record<string, unknown> | null;
  }
): string | null {
  const route: AssistantRouteDef = ASSISTANT_ROUTES[key];
  let root: string;
  if (route.scope === 'org') root = `/org/${input.orgSlug}`;
  else if (route.scope === 'property') {
    if (!input.propertySlug) return null;
    root = `/org/${input.orgSlug}/property/${input.propertySlug}`;
  } else {
    if (!input.parkingSlug) return null;
    root = `/org/${input.orgSlug}/parking/${input.parkingSlug}`;
  }

  let path = route.path;
  if (path.includes(':bookingId')) {
    if (!input.bookingId || !BOOKING_ID_RE.test(input.bookingId)) return null;
    path = path.replace(':bookingId', input.bookingId);
  }

  const params = new URLSearchParams();
  for (const key of route.query ?? []) {
    const value = input.query?.[key];
    if (typeof value === 'string' && QUERY_VALUE_RE.test(value)) params.set(key, value);
  }
  const qs = params.toString();
  return `${root}${path ? `/${path}` : ''}${qs ? `?${qs}` : ''}`;
}
