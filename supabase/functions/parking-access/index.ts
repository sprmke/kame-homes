/**
 * parking-access — current user's permissions for a parking slot.
 * Auth: JWT + verifyParkingTeamAccess (no specific permission required).
 * Query: ?parking_id=uuid
 */

import { jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import { resolveParkingTeamAccessContext } from '../_shared/parkingScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('parking-access', async (req) => {
  requireHttpMethod(req, 'GET');
  const ctx = await resolveParkingTeamAccessContext(req);

  return jsonSuccess(req, {
    accessKind: ctx.accessKind,
    permissions: ctx.permissions,
    memberId: ctx.memberId ?? null,
    parkingId: ctx.parking.id,
    orgSlug: ctx.org.slug,
    parkingSlug: ctx.parking.slug,
    parkingName: ctx.parking.name,
  });
});
