/**
 * get-guest-stay-guide — Public GET for the token-gated guest stay brochure page.
 *
 * GET ?token=<opaque>
 * Optional path context: property slug in SPA route must match booking property when present.
 */

import {
  loadGuestStayGuideByToken,
  STAY_GUIDE_PLAN_ACCESS_DENIED,
} from '../_shared/guestStayGuide.ts';
import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import { servePublic } from '../_shared/serveEdge.ts';
import { publicGetRateLimitGate } from '../_shared/publicEndpointRateLimit.ts';

const NOT_AVAILABLE = 'This guide is not available. Please use the link from your check-in email.';

/** Host's plan no longer includes the stay guide (`propertyShowcase`, Pro+). */
const PLAN_ACCESS_DENIED = "This stay guide isn't available. Contact your host if you need it.";

servePublic('get-guest-stay-guide', async (req) => {
  if (req.method !== 'GET') {
    return jsonError(req, `Method ${req.method} not allowed`, 405);
  }


  const limited = await publicGetRateLimitGate(req, 'get-guest-stay-guide');
  if (limited) return limited;

  const url = new URL(req.url);
  const token = (url.searchParams.get('token') ?? '').trim();
  const propertySlug = (url.searchParams.get('property') ?? '').trim() || null;

  if (!token) {
    return jsonError(req, NOT_AVAILABLE, 404);
  }

  const data = await loadGuestStayGuideByToken(token, propertySlug);
  if (data === STAY_GUIDE_PLAN_ACCESS_DENIED) {
    return jsonError(req, PLAN_ACCESS_DENIED, 403);
  }
  if (!data) {
    return jsonError(req, NOT_AVAILABLE, 404);
  }

  return jsonSuccess(req, data);
});
