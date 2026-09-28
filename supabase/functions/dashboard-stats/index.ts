/**
 * dashboard-stats — Admin home dashboard aggregates.
 * Property scope: ?property_id=…
 * Parking scope: ?parking_id=…
 * Org scope: ?org_slug=… or ?org_id=… (aggregates org properties + parking listings)
 * Scoped org admins (`all_listings = false`) only aggregate assigned listings.
 * Scope, RBAC and caching live in _shared/dashboardStatsScope.ts (shared with the assistant
 * briefing so both hit the same cache rows).
 */

import {
  readDashboardStatsCached,
  resolveDashboardStatsScope,
} from '../_shared/dashboardStatsScope.ts';
import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('dashboard-stats', async (req) => {
  if (req.method !== 'GET') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const url = new URL(req.url);
  const scope = await resolveDashboardStatsScope(req, url);
  if (!scope) {
    return jsonError(req, 'property_id, parking_id, or org_slug is required', 400);
  }

  const data = await readDashboardStatsCached(scope, {
    from: url.searchParams.get('from'),
    to: url.searchParams.get('to'),
  });
  return jsonSuccess(req, data);
});
