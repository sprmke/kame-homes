import {
  HOST_VERIFICATION_REJECTED_PATH,
  resolveOrgLandingPath,
} from '@/features/dashboard/org/lib/orgLanding';
import { isHostVerificationHardRejected } from '@/features/dashboard/org/lib/orgVerificationTiers';
import {
  bookingDetailPath,
  getLastOrgSlug,
  getLastParkingSlug,
  getLastPropertySlug,
  getLastTenantKind,
  orgDashboardPath,
  orgParkingsPath,
  orgPropertiesPath,
  parkingSectionPath,
  propertyNotificationsPath,
  propertySectionPath,
  setLastParkingContext,
  setLastTenantContext,
} from '@/features/dashboard/org/lib/tenantPaths';

const LEGACY_SECTIONS = [
  'dashboard',
  'bookings',
  'finance',
  'maintenance',
  'notifications',
  'templates',
  'team',
  'settings',
] as const;

const LEGACY_NOTIFICATION_MODULES = ['marketing', 'staff', 'operations'] as const;

type LegacySection = (typeof LEGACY_SECTIONS)[number];
type LegacyNotificationModule = (typeof LEGACY_NOTIFICATION_MODULES)[number];

function isLegacySection(value: string): value is LegacySection {
  return (LEGACY_SECTIONS as readonly string[]).includes(value);
}

/** Map flat admin paths to nested org/property routes. */
export function mapLegacyAdminPath(path: string, orgSlug: string, propertySlug: string): string {
  if (path.startsWith('/org/')) return path;

  if (path === '/dashboard' || path === '/') {
    return propertySectionPath(orgSlug, propertySlug, 'dashboard');
  }

  const bookingMatch = path.match(/^\/bookings\/([^/]+)$/);
  if (bookingMatch) {
    return bookingDetailPath(orgSlug, propertySlug, bookingMatch[1]!);
  }

  for (const section of LEGACY_SECTIONS) {
    if (path === `/${section}`) {
      return propertySectionPath(orgSlug, propertySlug, section);
    }
  }

  for (const module of LEGACY_NOTIFICATION_MODULES) {
    if (path === `/${module}`) {
      return propertyNotificationsPath(orgSlug, propertySlug, module);
    }
  }

  const segment = path.replace(/^\//, '').split('/')[0] ?? '';
  if (isLegacySection(segment)) {
    return propertySectionPath(orgSlug, propertySlug, segment);
  }

  if ((LEGACY_NOTIFICATION_MODULES as readonly string[]).includes(segment)) {
    return propertyNotificationsPath(orgSlug, propertySlug, segment as LegacyNotificationModule);
  }

  return propertySectionPath(orgSlug, propertySlug, 'dashboard');
}

export async function resolvePostSignInPath(redirectPath: string): Promise<string> {
  const { callEdgeFunction } = await import('@/features/dashboard/org/lib/edgeClient');

  if (redirectPath === '/org') {
    // Resolve via list-organizations below (hub → dashboard or onboarding).
  } else if (redirectPath.startsWith('/org/') || redirectPath.startsWith('/accept-invite')) {
    return redirectPath;
  }

  const { organizations } = await callEdgeFunction<{
    organizations: Array<{
      slug: string;
      accessKind?: string;
      hostModes?: string[];
      settings?: Record<string, unknown>;
    }>;
  }>('list-organizations');

  if (organizations.length === 0) {
    return '/onboarding';
  }

  if (
    redirectPath === '/org' ||
    redirectPath === '/onboarding' ||
    redirectPath === HOST_VERIFICATION_REJECTED_PATH
  ) {
    return resolveOrgLandingPath(organizations);
  }

  const accessible = organizations.filter(
    (o) => !o.settings || !isHostVerificationHardRejected(o.settings)
  );
  if (accessible.length === 0) {
    return HOST_VERIFICATION_REJECTED_PATH;
  }

  const org = accessible.find((o) => o.slug === getLastOrgSlug()) ?? accessible[0]!;

  const [{ properties }, parkings] = await Promise.all([
    callEdgeFunction<{ properties: Array<{ slug: string }> }>(
      `list-properties?orgSlug=${encodeURIComponent(org.slug)}`
    ),
    callEdgeFunction<{ parkings: Array<{ slug: string }> }>(
      `list-parkings?orgSlug=${encodeURIComponent(org.slug)}`
    )
      .then((data) => data.parkings)
      .catch(() => [] as Array<{ slug: string }>),
  ]);

  if (properties.length === 0 && parkings.length === 0) {
    if (org.accessKind === 'property_member') {
      return resolveOrgLandingPath(organizations);
    }
    const hostModes = org.hostModes ?? [];
    if (hostModes.includes('parking') && !hostModes.includes('property')) {
      return orgParkingsPath(org.slug);
    }
    return org.hostModes?.includes('property')
      ? orgPropertiesPath(org.slug)
      : orgDashboardPath(org.slug);
  }

  const lastKind = getLastTenantKind();
  const lastParkingSlug = getLastParkingSlug();
  const lastPropertySlug = getLastPropertySlug();

  if (lastKind === 'parking' && parkings.length > 0) {
    const parking = parkings.find((p) => p.slug === lastParkingSlug) ?? parkings[0]!;
    setLastParkingContext(org.slug, parking.slug);
    if (redirectPath === '/dashboard' || redirectPath === '/') {
      return parkingSectionPath(org.slug, parking.slug, 'dashboard');
    }
    return parkingSectionPath(org.slug, parking.slug, 'dashboard');
  }

  if (properties.length > 0) {
    const property = properties.find((p) => p.slug === lastPropertySlug) ?? properties[0]!;
    setLastTenantContext(org.slug, property.slug);
    return mapLegacyAdminPath(redirectPath, org.slug, property.slug);
  }

  const parking = parkings.find((p) => p.slug === lastParkingSlug) ?? parkings[0]!;
  setLastParkingContext(org.slug, parking.slug);
  return parkingSectionPath(org.slug, parking.slug, 'dashboard');
}
