/**
 * get-public-property — Public GET for guest marketing property detail.
 * Trigger: guest SPA `/properties/:propertySlug`. Auth: anon key only (verify_jwt = false).
 * Query: ?property=<slug> or ?property_id=<uuid>
 * Returns 404 when slug/id missing or property status is INACTIVE.
 * `?preview=1`/`?embed=1` plus `?admin_jwt=` (verified host access) also returns INACTIVE
 * listings so the Page Editor can load before the property is published. That response
 * is private and is never served to anonymous guests.
 */

import { hasHostPreviewAccess } from '../_shared/hostPreviewAccess.ts';
import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import { loadPublicPropertyById } from '../_shared/publicPropertyService.ts';
import { publicGetRateLimitGate } from '../_shared/publicEndpointRateLimit.ts';
import {
  readPropertyIdFromUrl,
  readPropertySlugFromUrl,
  resolvePropertyIdBySlug,
} from '../_shared/propertyScope.ts';
import { servePublic } from '../_shared/serveEdge.ts';

servePublic('get-public-property', async (req) => {
  if (req.method !== 'GET') {
    return jsonError(req, `Method ${req.method} not allowed`, 405);
  }

  const limited = await publicGetRateLimitGate(req, 'get-public-property');
  if (limited) return limited;

  const url = new URL(req.url);
  const propertyIdParam = readPropertyIdFromUrl(url);
  const slug = readPropertySlugFromUrl(url);

  if (!propertyIdParam && !slug) {
    return jsonError(req, 'property or property_id query param is required', 400);
  }

  const propertyId = propertyIdParam ?? (await resolvePropertyIdBySlug(slug!));
  if (!propertyId) {
    return jsonError(req, 'Property not found', 404);
  }

  const previewRequested =
    url.searchParams.get('preview') === '1' || url.searchParams.get('embed') === '1';
  const hostPreview = previewRequested && (await hasHostPreviewAccess(req, propertyId));
  const detail = await loadPublicPropertyById(propertyId, { allowInactive: hostPreview });

  if (!detail) {
    return jsonError(req, 'Property not found', 404);
  }

  // Public dynamic — no ETag: `loadPublicPropertyById` is not audited here for
  // embedded Storage signed URLs, and a mismatched ETag on a signed-URL payload
  // is worse than no ETag (doc 11 Phase 11.3 edge case). Host preview (may
  // include an INACTIVE listing) must not land in the shared public cache.
  return jsonSuccess(req, detail, undefined, hostPreview ? 'private' : 'publicDynamic');
});
