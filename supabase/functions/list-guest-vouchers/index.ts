/**
 * list-guest-vouchers — Wallet of next-stay vouchers for the signed-in guest.
 *
 * GET ?property=<slug>|propertyId=<uuid> — filter to one property (booking form)
 * GET ?includeRedeemed=1 — include already-used awards
 */

import { listGuestVouchers } from '../_shared/guestProfileService.ts';
import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import { readPropertySlugFromUrl, resolvePropertyIdBySlug } from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('list-guest-vouchers', async (req, user) => {
  if (req.method !== 'GET') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const url = new URL(req.url);
  let propertyId = (url.searchParams.get('propertyId') ?? '').trim() || undefined;
  if (!propertyId) {
    const slug = readPropertySlugFromUrl(url);
    if (slug) {
      propertyId = (await resolvePropertyIdBySlug(slug)) ?? undefined;
    }
  }
  const includeRedeemed =
    url.searchParams.get('includeRedeemed') === '1' ||
    url.searchParams.get('includeRedeemed') === 'true';

  const vouchers = await listGuestVouchers(user, { propertyId, includeRedeemed });
  return jsonSuccess(req, { vouchers });
});
