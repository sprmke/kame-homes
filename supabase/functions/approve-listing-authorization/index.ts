/**
 * approve-listing-authorization — Super admin approves a listing's Tier 1 (authority).
 * Activates that listing (property: archive tower+unit peers first). No org-status precondition —
 * a listing goes ACTIVE on its own approval even while the host tier is still pending.
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import { emptyContractLegLifecycle } from '../_shared/contractLifecycle.ts';
import {
  parseListingKind,
  saveListingAuthorization,
  serializeListingAuthorization,
  loadListingContext,
} from '../_shared/listingAuthorizationService.ts';
import {
  activatePropertyAfterListingApproval,
  type UnitConflict,
} from '../_shared/propertyTowerUnit.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { verifySuperAdminJwt } from '../_shared/superAdminAuth.ts';

serveAuthenticated('approve-listing-authorization', async (req) => {
  requireHttpMethod(req, 'POST');
  await verifySuperAdminJwt(req);

  const body = await readJsonBody(req);
  const listingKind = parseListingKind(body.listingKind);
  const listingId = typeof body.listingId === 'string' ? body.listingId.trim() : '';
  if (!listingKind) return jsonError(req, 'listingKind must be property or parking');
  if (!listingId) return jsonError(req, 'listingId is required');

  const supabase = createServiceClient();
  const context = await loadListingContext(supabase, listingKind, listingId);

  if (context.authorization.baseStatus !== 'pending') {
    return jsonError(req, 'This listing is not pending review');
  }

  const state = {
    ...context.authorization,
    baseStatus: 'approved' as const,
    baseRejectionReason: null,
    baseRejectionKind: null,
    lifecycle: emptyContractLegLifecycle(),
  };

  // Activate before writing approved — if the handoff fails, status stays pending for retry.
  let activatedListingIds: string[] = [];
  let archivedPeers: UnitConflict[] = [];
  try {
    if (listingKind === 'property') {
      const handoff = await activatePropertyAfterListingApproval(supabase, listingId);
      activatedListingIds = handoff.activatedPropertyIds;
      archivedPeers = handoff.archivedPeers;
    } else {
      if (context.listing.status !== 'ACTIVE') {
        const { error } = await supabase
          .from('parkings')
          .update({ status: 'ACTIVE' })
          .eq('id', listingId);
        if (error) {
          console.error('[approve-listing-authorization] activate parking:', error.message);
          throw new Error('Failed to activate parking after approve');
        }
      }
      activatedListingIds = [listingId];
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Listing activation failed';
    console.error('[approve-listing-authorization] activation:', message);
    return jsonError(req, message, 500);
  }

  const listing = await saveListingAuthorization(supabase, context, state);

  return jsonSuccess(req, {
    ...serializeListingAuthorization(context, state, listing),
    activatedListingIds,
    archivedPeers,
  });
});
