/**
 * get-public-property — Public GET for guest marketing property detail.
 * Trigger: guest SPA `/properties/:propertySlug`. Auth: anon key only (verify_jwt = false).
 * Query: ?property=<slug> or ?property_id=<uuid>
 * Returns 404 when slug/id missing or property status is INACTIVE.
 */

import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import {
  loadPublicPropertyById,
  loadPublicPropertyBySlug,
} from '../_shared/publicPropertyService.ts';
import { publicGetRateLimitGate } from '../_shared/publicEndpointRateLimit.ts';
import { readPropertyIdFromUrl, readPropertySlugFromUrl } from '../_shared/propertyScope.ts';
import { servePublic } from '../_shared/serveEdge.ts';

servePublic('get-public-property', async (req) => {
  if (req.method !== 'GET') {
    return jsonError(req, `Method ${req.method} not allowed`, 405);
  }

  const limited = await publicGetRateLimitGate(req, 'get-public-property');
  if (limited) return limited;

  const url = new URL(req.url);
  const propertyId = readPropertyIdFromUrl(url);
  const slug = readPropertySlugFromUrl(url);

  if (!propertyId && !slug) {
    return jsonError(req, 'property or property_id query param is required', 400);
  }

  const detail = propertyId
    ? await loadPublicPropertyById(propertyId)
    : await loadPublicPropertyBySlug(slug!);

  if (!detail) {
    return jsonError(req, 'Property not found', 404);
  }

  // Public dynamic — no ETag: `loadPublicPropertyById`/`BySlug` are not audited
  // here for embedded Storage signed URLs, and a mismatched ETag on a signed-URL
  // payload is worse than no ETag (doc 11 Phase 11.3 edge case).
  return jsonSuccess(req, detail, undefined, 'publicDynamic');
});
