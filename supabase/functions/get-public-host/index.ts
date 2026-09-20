/**
 * get-public-host — Public GET for guest marketing host (organization) profile.
 * Query: ?org=<org_slug>
 */

import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import { loadPublicHostByOrgSlug } from '../_shared/publicHostService.ts';
import { servePublic } from '../_shared/serveEdge.ts';
import { publicGetRateLimitGate } from '../_shared/publicEndpointRateLimit.ts';

function readOrgSlugFromUrl(url: URL): string {
  return (url.searchParams.get('org') ?? url.searchParams.get('org_slug') ?? '').trim();
}

servePublic('get-public-host', async (req) => {
  if (req.method !== 'GET') {
    return jsonError(req, `Method ${req.method} not allowed`, 405);
  }

  const limited = await publicGetRateLimitGate(req, 'get-public-host');
  if (limited) return limited;

  const orgSlug = readOrgSlugFromUrl(new URL(req.url));
  if (!orgSlug) {
    return jsonError(req, 'org query param is required', 400);
  }

  const profile = await loadPublicHostByOrgSlug(orgSlug);
  if (!profile) {
    return jsonError(req, 'Host not found', 404);
  }

  // Public dynamic — no ETag: `loadPublicHostByOrgSlug` not audited here for
  // embedded Storage signed URLs (doc 11 Phase 11.3 edge case).
  return jsonSuccess(req, profile, undefined, 'publicDynamic');
});
