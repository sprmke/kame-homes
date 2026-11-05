/**
 * guest-web-chat-start — Create or resume a web chat thread for a property or parking inquiry.
 * Auth: any signed-in guest (Supabase JWT, not admin allow list).
 */

import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import { identityFromRequest, rateLimitGate } from '../_shared/rateLimit.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { startGuestWebChat } from '../_shared/webGuestChatService.ts';

serveAuthenticated('guest-web-chat-start', async (req, user) => {
  if (req.method !== 'POST') {
    return jsonError(req, 'Method not allowed', 405);
  }

  // Durable per-user rate limit — thread starts fan out to Resend + Telegram.
  // Plan: docs/workflow/in-progress/production-readiness/audits/captcha-anti-spam-hardening.md
  const limited = await rateLimitGate(req, {
    scope: 'guest-web-chat-start',
    identity: identityFromRequest(req, user),
    limit: 10,
    windowSec: 3600,
  });
  if (limited) return limited;

  const body = await readJsonBody(req);
  const propertySlug = String(body.propertySlug ?? body.property_slug ?? '').trim();
  const parkingSlug = String(body.parkingSlug ?? body.parking_slug ?? '').trim();
  const checkInDate = String(body.checkInDate ?? body.check_in_date ?? '').trim();
  const checkOutDate = String(body.checkOutDate ?? body.check_out_date ?? '').trim();

  if ((!propertySlug && !parkingSlug) || (propertySlug && parkingSlug)) {
    return jsonError(req, 'Exactly one of propertySlug or parkingSlug is required', 400);
  }
  if (!checkInDate || !checkOutDate) {
    return jsonError(req, 'checkInDate and checkOutDate required', 400);
  }

  try {
    const result = await startGuestWebChat(user, {
      propertySlug: propertySlug || undefined,
      parkingSlug: parkingSlug || undefined,
      checkInDate,
      checkOutDate,
    });
    return jsonSuccess(req, result);
  } catch (e) {
    const message = (e as Error).message;
    if (message === 'Property not found' || message === 'Parking not found') {
      return jsonError(req, message, 404);
    }
    if (message.includes('checkInDate') || message.includes('propertySlug')) {
      return jsonError(req, message, 400);
    }
    throw e;
  }
});
