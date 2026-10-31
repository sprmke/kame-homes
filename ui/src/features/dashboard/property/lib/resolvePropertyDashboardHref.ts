import { propertySectionPath } from '@/features/dashboard/org/lib/tenantPaths';
import type { PropertySection } from '@/features/dashboard/team/lib/propertyPermissions';

/**
 * Server `dashboard-stats` attention hrefs are legacy flat paths (`/bookings?…`,
 * `/finance?…`). Rewrite them to the current property (or keep absolute/org paths).
 */
export function resolvePropertyDashboardHref(
  href: string,
  orgSlug: string,
  propertySlug: string
): string {
  if (!href.startsWith('/')) return href;
  if (href.startsWith('/org/')) return href;

  const qIndex = href.indexOf('?');
  const path = qIndex >= 0 ? href.slice(0, qIndex) : href;
  const query = qIndex >= 0 ? href.slice(qIndex) : '';

  const sectionByPath: Record<string, PropertySection> = {
    '/bookings': 'bookings',
    '/finance': 'finance',
    '/maintenance': 'maintenance',
    '/pricing': 'pricing',
    '/settings': 'settings',
  };

  const section = sectionByPath[path];
  if (!section) return href;
  return `${propertySectionPath(orgSlug, propertySlug, section)}${query}`;
}
