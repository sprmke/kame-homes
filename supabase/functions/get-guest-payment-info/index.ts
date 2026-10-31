/**
 * get-guest-payment-info — Public GET for property payment + GAF defaults on the guest form.
 * Trigger: guest SPA on load (Payment step + submit). Auth: anon key only (verify_jwt = false).
 */

import { serializeGuestPaymentInfo } from '../_shared/appSettings.ts';
import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import { servePublic } from '../_shared/serveEdge.ts';
import { publicGetRateLimitGate } from '../_shared/publicEndpointRateLimit.ts';
import { resolvePublicPropertyId } from '../_shared/propertyScope.ts';

servePublic('get-guest-payment-info', async (req) => {
  if (req.method !== 'GET') {
    return jsonError(req, `Method ${req.method} not allowed`, 405);
  }


  const limited = await publicGetRateLimitGate(req, 'get-guest-payment-info', { maxPerMin: 30 });
  if (limited) return limited;

  const propertyId = await resolvePublicPropertyId(new URL(req.url));
  const data = await serializeGuestPaymentInfo(propertyId);
  return jsonSuccess(req, data);
});
