/**
 * reject-listing-authorization — Super admin requests changes or declines one listing tier.
 * Body: { listingKind, listingId, tier: 'base' | 'recommended', kind: 'changes' | 'rejected', reason }.
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import {
  isListingAuthorizationTier,
  LISTING_AUTHORIZATION_REJECTION_KINDS,
  type ListingAuthorizationRejectionKind,
} from '../_shared/listingAuthorization.ts';
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

serveAuthenticated('reject-listing-authorization', async (req) => {
  requireHttpMethod(req, 'POST');
  await verifySuperAdminJwt(req);

  const body = await readJsonBody(req);
  const listingKind = parseListingKind(body.listingKind);
  const listingId = typeof body.listingId === 'string' ? body.listingId.trim() : '';
  const tierRaw = typeof body.tier === 'string' ? body.tier.trim() : '';
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  const kindRaw = typeof body.kind === 'string' ? body.kind.trim() : 'rejected';
  const kindNormalized = kindRaw === 'compliance' ? 'changes' : kindRaw;
  const kind = (LISTING_AUTHORIZATION_REJECTION_KINDS as readonly string[]).includes(kindNormalized)
    ? (kindNormalized as ListingAuthorizationRejectionKind)
    : null;

  if (!listingKind) return jsonError(req, 'listingKind must be property or parking');
  if (!listingId) return jsonError(req, 'listingId is required');
  if (!isListingAuthorizationTier(tierRaw)) {
    return jsonError(req, 'tier must be base or recommended');
  }
  if (!reason) {
    return jsonError(req, kind === 'changes' ? 'notes are required' : 'reason is required');
  }
  if (!kind) return jsonError(req, 'kind must be changes or rejected');

  const supabase = createServiceClient();
  const context = await loadListingContext(supabase, listingKind, listingId);
  const current = context.authorization;

  const state =
    tierRaw === 'base'
      ? (() => {
          if (current.baseStatus !== 'pending') return null;
          return {
            ...current,
            baseStatus: 'rejected' as const,
            baseRejectionReason: reason,
            baseRejectionKind: kind,
          };
        })()
      : (() => {
          if (current.recommendedStatus !== 'pending') return null;
          return {
            ...current,
            recommendedStatus: 'rejected' as const,
            recommendedRejectionReason: reason,
            recommendedRejectionKind: kind,
          };
        })();

  if (!state) {
    return jsonError(
      req,
      tierRaw === 'base'
        ? 'This listing is not pending review'
        : 'Recommended is not pending review for this listing'
    );
  }

  const listing = await saveListingAuthorization(supabase, context, state);

  return jsonSuccess(req, serializeListingAuthorization(context, state, listing));
});
