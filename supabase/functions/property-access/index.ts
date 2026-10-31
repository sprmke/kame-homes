/**
 * property-access — current user's permissions for a property.
 * Auth: JWT + verifyPropertyAccess (no specific permission required).
 * Query: ?property_id=uuid
 */

import { jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import { resolvePropertyAccessContext } from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('property-access', async (req) => {
  requireHttpMethod(req, 'GET');
  const ctx = await resolvePropertyAccessContext(req);

  return jsonSuccess(req, {
    accessKind: ctx.accessKind,
    permissions: ctx.permissions,
    memberId: ctx.memberId ?? null,
    propertyId: ctx.property.id,
    orgSlug: ctx.org.slug,
    orgName: ctx.org.name,
    propertySlug: ctx.property.slug,
    propertyName: ctx.property.name,
    planLimited: ctx.planLimited === true,
  });
});
