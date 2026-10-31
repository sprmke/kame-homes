/**
 * property-entitlements — GET resolved plan features for a property (read-only).
 *
 * Returns the full `ResolvedPropertyEntitlements` payload (every `PlanFeatures` key +
 * plan metadata). Do not hand-pick feature fields — missing keys make the client treat
 * paid features as off (`isFeatureEnabled` → false) even when the org is on Pro.
 */

import { resolvePropertyEntitlements } from '../_shared/planEntitlements.ts';
import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import { readPropertyIdFromUrl, resolveScopedPropertyAccess } from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('property-entitlements', async (req) => {
  if (req.method !== 'GET') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const url = new URL(req.url);
  const propertyIdFromQuery = readPropertyIdFromUrl(url);
  const { property } = await resolveScopedPropertyAccess(req, 'settings:view', propertyIdFromQuery);
  const propertyId = property.id as string;

  const entitlements = await resolvePropertyEntitlements(propertyId);

  // Spread the full resolved row — every PlanFeatures key must reach the client.
  return jsonSuccess(req, { ...entitlements });
});
