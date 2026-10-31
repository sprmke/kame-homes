/**
 * approve-listing-recommended — Super admin approves a listing's Tier 2.
 * Grants the Recommended badge on that listing only; siblings and the host badge are untouched.
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import {
  loadListingContext,
  parseListingKind,
  saveListingAuthorization,
  serializeListingAuthorization,
} from '../_shared/listingAuthorizationService.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { verifySuperAdminJwt } from '../_shared/superAdminAuth.ts';

serveAuthenticated('approve-listing-recommended', async (req) => {
  requireHttpMethod(req, 'POST');
  await verifySuperAdminJwt(req);

  const body = await readJsonBody(req);
  const listingKind = parseListingKind(body.listingKind);
  const listingId = typeof body.listingId === 'string' ? body.listingId.trim() : '';
  if (!listingKind) return jsonError(req, 'listingKind must be property or parking');
  if (!listingId) return jsonError(req, 'listingId is required');

  const supabase = createServiceClient();
  const context = await loadListingContext(supabase, listingKind, listingId);

  if (context.authorization.recommendedStatus !== 'pending') {
    return jsonError(req, 'Recommended is not pending review for this listing');
  }

  const state = {
    ...context.authorization,
    recommendedStatus: 'approved' as const,
    recommendedRejectionReason: null,
    recommendedRejectionKind: null,
  };

  const listing = await saveListingAuthorization(supabase, context, state);

  return jsonSuccess(req, serializeListingAuthorization(context, state, listing));
});
