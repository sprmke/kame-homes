/**
 * UI mirror of `supabase/functions/_shared/dashboardAssistantRoutes.ts` (route keys + section
 * labels for `open_page` handoffs). The server builds and permission-checks every href; the UI
 * only needs the key → section label map. `assistantRoutes.test.ts` fails on drift.
 */

export const ASSISTANT_ROUTE_LABELS = {
  'org.dashboard': 'Dashboard',
  'org.bookings': 'Bookings',
  'org.properties': 'Properties',
  'org.parkings': 'Parking',
  'org.analytics': 'Analytics',
  'org.team': 'Team',
  'org.plans': 'Plans',
  'org.announcements': 'Announcements',
  'org.settings': 'Settings',
  'org.help-support': 'Help & Support',
  'property.dashboard': 'Dashboard',
  'property.bookings': 'Bookings',
  'property.booking': 'Booking',
  'property.finance': 'Finance',
  'property.maintenance': 'Maintenance',
  'property.pricing': 'Pricing',
  'property.analytics': 'Analytics',
  'property.team': 'Team',
  'property.marketing': 'Marketing',
  'property.inbox': 'Inbox',
  'property.notifications': 'Notifications',
  'property.templates': 'Templates',
  'property.public-pages': 'Public pages',
  'property.settings': 'Settings',
  'property.help-support': 'Help & Support',
  'parking.dashboard': 'Dashboard',
  'parking.bookings': 'Bookings',
  'parking.booking': 'Booking',
  'parking.finance': 'Finance',
  'parking.pricing': 'Pricing',
  'parking.team': 'Team',
  'parking.inbox': 'Inbox',
  'parking.notifications': 'Notifications',
  'parking.settings': 'Settings',
  'parking.help-support': 'Help & Support',
} as const;

export type AssistantRouteKey = keyof typeof ASSISTANT_ROUTE_LABELS;

export function assistantRouteSectionLabel(routeKey: string): string | null {
  return Object.prototype.hasOwnProperty.call(ASSISTANT_ROUTE_LABELS, routeKey)
    ? ASSISTANT_ROUTE_LABELS[routeKey as AssistantRouteKey]
    : null;
}

/** Only in-app dashboard paths may be opened from a chat block. */
export function isOpenableAssistantHref(href: string): boolean {
  return /^\/org\/[^/?#\s]+(?:[/?#][^\s\\]*)?$/.test(href) && !href.startsWith('//');
}
