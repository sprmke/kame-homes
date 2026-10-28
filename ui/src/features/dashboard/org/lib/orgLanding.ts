import { isHostVerificationHardRejected } from '@/features/dashboard/org/lib/orgVerificationTiers';
import {
  getLastOrgSlug,
  getLastParkingSlug,
  getLastPropertySlug,
  getLastTenantKind,
  orgDashboardPath,
  parkingDashboardPath,
  propertyDashboardPath,
} from '@/features/dashboard/org/lib/tenantPaths';

export const HOST_VERIFICATION_REJECTED_PATH = '/verification-rejected';

type OrgLandingOrg = {
  slug: string;
  accessKind?: string;
  settings?: Record<string, unknown>;
  /** Seat paused by plan limits — listed for soft-allow gates, not a usable landing. */
  planLimited?: boolean;
};

function isHardRejectedOrg(org: OrgLandingOrg): boolean {
  return Boolean(org.settings && isHostVerificationHardRejected(org.settings));
}

function isAccessibleOrg(org: OrgLandingOrg): boolean {
  if (org.planLimited === true) return false;
  if (!org.settings) return true;
  return !isHostVerificationHardRejected(org.settings);
}

/**
 * Tenant-level landing from the stored "last visited listing" context.
 * Only applies when the stored last org matches `orgSlug` (stored listing slugs belong to that org).
 * When slug lists are provided, a stored listing slug that no longer exists falls back to
 * the org dashboard (destination guards handle slugs we could not validate).
 */
function resolveLastListingLandingPath(
  orgSlug: string,
  listings?: { propertySlugs?: readonly string[]; parkingSlugs?: readonly string[] }
): string | null {
  if (getLastOrgSlug() !== orgSlug) return null;

  const kind = getLastTenantKind();
  if (kind === 'parking') {
    const slug = getLastParkingSlug();
    if (!slug) return null;
    if (listings?.parkingSlugs && !listings.parkingSlugs.includes(slug)) return null;
    return parkingDashboardPath(orgSlug, slug);
  }

  if (kind === 'property') {
    const slug = getLastPropertySlug();
    if (!slug) return null;
    if (listings?.propertySlugs && !listings.propertySlugs.includes(slug)) return null;
    return propertyDashboardPath(orgSlug, slug);
  }

  return null;
}

/** The org the `/org` hub would resolve to (last accessible, else first accessible), or null on a terminal path. */
export function pickLandingOrgSlug(organizations: readonly OrgLandingOrg[]): string | null {
  const accessible = organizations.filter(isAccessibleOrg);
  if (accessible.length === 0) return null;
  const lastSlug = getLastOrgSlug();
  return (accessible.find((entry) => entry.slug === lastSlug) ?? accessible[0]!).slug;
}

/**
 * Resolve where `/org` and similar hubs should send the user.
 * Prefer last-used org (localStorage) when still accessible; otherwise first accessible org.
 * When the user last visited a listing (property/parking) in that org, land on that listing's
 * dashboard; otherwise the org dashboard. All orgs hard-rejected → rejection screen.
 * No usable orgs (none, or only plan-limited) → onboarding.
 */
export function resolveOrgLandingPath(
  organizations: readonly OrgLandingOrg[],
  listings?: { propertySlugs?: readonly string[]; parkingSlugs?: readonly string[] }
): string {
  if (organizations.length === 0) {
    return '/onboarding';
  }

  const accessible = organizations.filter(isAccessibleOrg);
  if (accessible.length === 0) {
    if (organizations.every(isHardRejectedOrg)) {
      return HOST_VERIFICATION_REJECTED_PATH;
    }
    // Plan-limited-only (or mixed with rejected) — let the user start their own org.
    return '/onboarding';
  }

  const lastSlug = getLastOrgSlug();
  const org = accessible.find((entry) => entry.slug === lastSlug) ?? accessible[0]!;
  return resolveLastListingLandingPath(org.slug, listings) ?? orgDashboardPath(org.slug);
}

/**
 * True when the user already owns at least one organization that is still usable
 * (hard-rejected orgs do not block starting a new application).
 */
export function userOwnsOrganization(organizations: readonly OrgLandingOrg[]): boolean {
  return organizations.some((entry) => entry.accessKind === 'owner' && isAccessibleOrg(entry));
}
