/**
 * get-public-parking — Public GET for guest marketing parking detail.
 * Query: ?parking=<slug>
 */

import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import { loadPublicParkingBySlug, readParkingSlugFromUrl } from '../_shared/parkingScope.ts';
import { publicGetRateLimitGate } from '../_shared/publicEndpointRateLimit.ts';
import { servePublic } from '../_shared/serveEdge.ts';

servePublic('get-public-parking', async (req) => {
  if (req.method !== 'GET') {
    return jsonError(req, `Method ${req.method} not allowed`, 405);
  }

  const limited = await publicGetRateLimitGate(req, 'get-public-parking');
  if (limited) return limited;

  const url = new URL(req.url);
  const slug = readParkingSlugFromUrl(url);

  if (!slug) {
    return jsonError(req, 'parking query param is required', 400);
  }

  const detail = await loadPublicParkingBySlug(slug);

  if (!detail) {
    return jsonError(req, 'Parking not found', 404);
  }

  return jsonSuccess(req, detail);
});
