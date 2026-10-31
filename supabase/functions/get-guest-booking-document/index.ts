/**
 * get-guest-booking-document — Public GET for a token-gated approved-document PDF
 * (GAF or Pet). Mints a fresh signed Storage URL server-side on each visit so the
 * shared link keeps working long after any individual signed URL would expire.
 *
 * GET ?token=<opaque>&doc=gaf|pet&property=<slug>
 */

import {
  resolveBookingDocumentByToken,
  type BookingDocumentKind,
} from '../_shared/bookingDocumentShareToken.ts';
import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import { servePublic } from '../_shared/serveEdge.ts';
import { publicGetRateLimitGate } from '../_shared/publicEndpointRateLimit.ts';

const NOT_AVAILABLE = {
  success: false,
  error: 'not_available',
  message: 'This link is not available.',
};

function parseDocKind(raw: string | null): BookingDocumentKind | null {
  const value = (raw ?? '').trim().toLowerCase();
  return value === 'gaf' || value === 'pet' ? value : null;
}

servePublic('get-guest-booking-document', async (req) => {
  if (req.method !== 'GET') {
    return jsonError(req, `Method ${req.method} not allowed`, 405);
  }


  const limited = await publicGetRateLimitGate(req, 'get-guest-booking-document');
  if (limited) return limited;

  const url = new URL(req.url);
  const token = (url.searchParams.get('token') ?? '').trim();
  const doc = parseDocKind(url.searchParams.get('doc'));
  const propertySlug = (url.searchParams.get('property') ?? '').trim() || null;

  if (!token || !doc) {
    return jsonError(req, NOT_AVAILABLE, 404);
  }

  const resolved = await resolveBookingDocumentByToken(token, doc, propertySlug);
  if (!resolved) {
    return jsonError(req, NOT_AVAILABLE, 404);
  }

  return jsonSuccess(req, resolved);
});
