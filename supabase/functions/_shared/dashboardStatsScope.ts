/**
 * Scope resolution + cached read for `computeDashboardStats`, shared by `dashboard-stats` and
 * `dashboard-assistant-briefing` so both apply the same RBAC and hit the same cache rows.
 *
 * Property scope: ?property_id=…   (needs bookings:view)
 * Parking scope:  ?parking_id=…    (needs bookings:view)
 * Org scope:      ?org_slug=… | ?org_id=…  (needs org:dashboard:view; scoped org admins only
 *                 aggregate their assigned listings)
 */

import { computeDashboardStats, type DashboardStats } from './dashboardService.ts';
import { resolveAssignedListingIdsForOrgUser, verifyParkingTeamAccess } from './orgAuth.ts';
import { readParkingIdFromUrl } from './parkingScope.ts';
import {
  readOrgIdFromUrl,
  readOrgSlugFromUrl,
  readPropertyIdFromUrl,
  resolveOrgAccessContext,
  resolveScopedPropertyAccess,
} from './propertyScope.ts';
import { buildCacheKey, readThrough } from './queryCache.ts';

// dashboard-stats is polled every 60s by every open dashboard tab and computeDashboardStats does
// an unbounded select on guest_submissions — cached with a TTL that matches the poll cadence
// (doc 12, Phase 12.3), so no observable staleness regression for the UI.
export const DASHBOARD_STATS_CACHE_TTL_MS = 45_000;

export type DashboardStatsScope = {
  /** Org the verified scope belongs to (every branch). */
  organizationId: string;
  propertyId?: string;
  parkingId?: string;
  orgId?: string;
  scopedPropertyIds?: string[];
  scopedParkingIds?: string[];
  /**
   * REQUIRED whenever the response can differ by viewer permission (see queryCache.ts
   * buildCacheKey). Only the org branch varies by viewer; property / parking branches are fully
   * scoped + access-checked, so every viewer who reaches them gets the identical response.
   */
  permissionScope: string[] | null;
};

/** Throws the usual access errors; returns null when no scope param was given. */
export async function resolveDashboardStatsScope(
  req: Request,
  url: URL
): Promise<DashboardStatsScope | null> {
  const explicitPropertyId = readPropertyIdFromUrl(url);
  const explicitParkingId = readParkingIdFromUrl(url);
  const orgSlug = readOrgSlugFromUrl(url);
  const orgIdParam = readOrgIdFromUrl(url);

  if (explicitParkingId) {
    // Parking team RBAC (owner, org admins by listing assignment, parking members), same gate as
    // list-bookings. The old org-permission check only let owners / platform admins through.
    const access = await verifyParkingTeamAccess(req, explicitParkingId, 'bookings:view');
    return {
      organizationId: access.org.id,
      parkingId: explicitParkingId,
      permissionScope: null,
    };
  }
  if (explicitPropertyId) {
    const { property, org } = await resolveScopedPropertyAccess(
      req,
      'bookings:view',
      explicitPropertyId
    );
    return { organizationId: org.id, propertyId: property.id, permissionScope: null };
  }
  if (orgSlug || orgIdParam) {
    // Legacy coarse id, expanded to org.dashboard:view at runtime (orgLegacyPermissionExpansion).
    const ctx = await resolveOrgAccessContext(req, 'org:dashboard:view' as 'org.dashboard:view');
    if (ctx.canListAllProperties) {
      return { organizationId: ctx.org.id, orgId: ctx.org.id, permissionScope: ['all_listings'] };
    }
    const assigned = await resolveAssignedListingIdsForOrgUser(ctx.user.id, ctx.org.id);
    return {
      organizationId: ctx.org.id,
      orgId: ctx.org.id,
      scopedPropertyIds: assigned.propertyIds,
      scopedParkingIds: assigned.parkingIds,
      permissionScope: [
        'scoped',
        ...assigned.propertyIds.map((id) => `p:${id}`),
        ...assigned.parkingIds.map((id) => `k:${id}`),
      ],
    };
  }
  return null;
}

export function readDashboardStatsCached(
  scope: DashboardStatsScope,
  range: { from: string | null; to: string | null }
): Promise<DashboardStats> {
  const cacheScope = {
    orgId: scope.orgId,
    propertyId: scope.propertyId,
    parkingId: scope.parkingId,
  };
  return readThrough({
    cacheKey: buildCacheKey({
      namespace: 'dashboard-stats',
      scope: cacheScope,
      params: range,
      permissionScope: scope.permissionScope,
    }),
    scope: cacheScope,
    ttlMs: DASHBOARD_STATS_CACHE_TTL_MS,
    compute: () =>
      computeDashboardStats({
        propertyId: scope.propertyId,
        parkingId: scope.parkingId,
        orgId: scope.orgId,
        scopedPropertyIds: scope.scopedPropertyIds,
        scopedParkingIds: scope.scopedParkingIds,
        from: range.from,
        to: range.to,
      }),
  });
}
