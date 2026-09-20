/**
 * dashboard-stats — Admin home dashboard aggregates.
 * Property scope: ?property_id=…
 * Parking scope: ?parking_id=…
 * Org scope: ?org_slug=… or ?org_id=… (aggregates org properties + parking listings)
 * Scoped org admins (`all_listings = false`) only aggregate assigned listings.
 */

import { computeDashboardStats } from '../_shared/dashboardService.ts';
import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import { resolveAssignedListingIdsForOrgUser } from '../_shared/orgAuth.ts';
import {
  readOrgIdFromUrl,
  readOrgSlugFromUrl,
  readPropertyIdFromUrl,
  resolveOrgAccessContext,
  resolveScopedPropertyAccess,
} from '../_shared/propertyScope.ts';
import { readParkingIdFromUrl, resolveScopedParkingAccess } from '../_shared/parkingScope.ts';
import { buildCacheKey, readThrough } from '../_shared/queryCache.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

// dashboard-stats is polled every 60s by every open property/org/parking dashboard tab
// (ui/src/features/dashboard/{property,org,parking}/hooks/use*DashboardStats.ts) and its
// query (_shared/dashboardService.ts#computeDashboardStats) does an unbounded select('*') on
// guest_submissions in every branch — the doc 12 "polled + unbounded" worst case. Cached via
// _shared/queryCache.ts (doc 12, Phase 12.3) with a short TTL: stale by at most ~1 minute,
// which matches the poll cadence itself, so no observable staleness regression for the UI.
const DASHBOARD_STATS_CACHE_TTL_MS = 45_000;

serveAuthenticated('dashboard-stats', async (req) => {
  if (req.method !== 'GET') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const url = new URL(req.url);
  const explicitPropertyId = readPropertyIdFromUrl(url);
  const explicitParkingId = readParkingIdFromUrl(url);
  const orgSlug = readOrgSlugFromUrl(url);
  const orgIdParam = readOrgIdFromUrl(url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  let propertyId: string | undefined;
  let parkingId: string | undefined;
  let orgId: string | undefined;
  let scopedPropertyIds: string[] | undefined;
  let scopedParkingIds: string[] | undefined;
  // REQUIRED whenever the response can differ by viewer permission — see queryCache.ts's
  // buildCacheKey doc comment and the migration's security note. Only the org branch varies
  // by viewer (a scoped org admin's assigned-listing set vs an all-listings admin); the
  // property/parking branches are already fully scoped + access-checked by
  // resolveScopedPropertyAccess/resolveScopedParkingAccess above, so any viewer who reaches
  // computeDashboardStats for that id is entitled to the identical response.
  let permissionScope: string[] | null = null;

  if (explicitParkingId) {
    await resolveScopedParkingAccess(req, 'bookings:view');
    parkingId = explicitParkingId;
  } else if (explicitPropertyId) {
    const { property } = await resolveScopedPropertyAccess(
      req,
      'bookings:view',
      explicitPropertyId
    );
    propertyId = property.id;
  } else if (orgSlug || orgIdParam) {
    const ctx = await resolveOrgAccessContext(req, 'org:dashboard:view');
    orgId = ctx.org.id;
    if (!ctx.canListAllProperties) {
      const assigned = await resolveAssignedListingIdsForOrgUser(ctx.user.id, ctx.org.id);
      scopedPropertyIds = assigned.propertyIds;
      scopedParkingIds = assigned.parkingIds;
      permissionScope = [
        'scoped',
        ...scopedPropertyIds.map((id) => `p:${id}`),
        ...scopedParkingIds.map((id) => `k:${id}`),
      ];
    } else {
      permissionScope = ['all_listings'];
    }
  } else {
    return jsonError(req, 'property_id, parking_id, or org_slug is required', 400);
  }

  const cacheKey = buildCacheKey({
    namespace: 'dashboard-stats',
    scope: { orgId, propertyId, parkingId },
    params: { from, to },
    permissionScope,
  });

  const data = await readThrough({
    cacheKey,
    scope: { orgId, propertyId, parkingId },
    ttlMs: DASHBOARD_STATS_CACHE_TTL_MS,
    compute: () =>
      computeDashboardStats({
        propertyId,
        parkingId,
        orgId,
        scopedPropertyIds,
        scopedParkingIds,
        from,
        to,
      }),
  });

  return jsonSuccess(req, data);
});
