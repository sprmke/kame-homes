/**
 * submit-contract-consideration — Listing owner requests temporary access during grace.
 * Scoped per listing (listingKind + listingId), not per org leg.
 * Auth: listing owner. Anti-abuse: 1 self-serve per cycle, grace only, 14-day expectedDate.
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import {
  appendConsiderationAudit,
  canOwnerSubmitConsideration,
  validateGrantedUntil,
} from '../_shared/contractLifecycle.ts';
import {
  parseListingKind,
  saveListingAuthorization,
  verifyListingOwner,
} from '../_shared/listingAuthorizationService.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('submit-contract-consideration', async (req, user) => {
  requireHttpMethod(req, 'POST');
  const body = await readJsonBody(req);

  const listingKind = parseListingKind(body.listingKind ?? body.leg);
  const listingId = typeof body.listingId === 'string' ? body.listingId.trim() : '';
  const note = typeof body.note === 'string' ? body.note.trim() : '';
  const expectedDate = typeof body.expectedDate === 'string' ? body.expectedDate.trim() : '';
  const proofRaw = body.proofPaths;
  const proofPaths = Array.isArray(proofRaw)
    ? proofRaw
        .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
        .map((p) => p.trim())
    : [];

  if (!listingKind) return jsonError(req, 'listingKind must be property or parking');
  if (!listingId) return jsonError(req, 'listingId is required');
  if (!note) return jsonError(req, 'note is required');
  if (note.length > 2000) return jsonError(req, 'note is too long');
  const dateError = validateGrantedUntil(expectedDate);
  if (dateError) return jsonError(req, dateError);
  if (proofPaths.length < 1) return jsonError(req, 'At least one proof is required');

  const context = await verifyListingOwner(req, listingKind, listingId);
  for (const path of proofPaths) {
    if (!path.startsWith(`org/${context.org.id}/`)) {
      return jsonError(req, 'Invalid proof path');
    }
  }

  const { authorization } = context;
  const life = authorization.lifecycle;

  const gate = canOwnerSubmitConsideration(life, authorization.contractEndDate);
  if (!gate.ok) return jsonError(req, gate.reason, 409);

  const consideration = appendConsiderationAudit(
    {
      ...life.consideration,
      status: 'pending',
      note,
      expectedDate,
      grantedUntil: null,
      proofPaths,
      selfServeUsedThisCycle: true,
    },
    {
      by: user.email,
      action: 'submit',
      note,
    }
  );

  const supabase = createServiceClient();
  await saveListingAuthorization(supabase, context, {
    ...authorization,
    lifecycle: { ...life, consideration },
  });

  return jsonSuccess(req, {
    listingKind,
    listingId,
    consideration: {
      status: consideration.status,
      expectedDate: consideration.expectedDate,
      selfServeUsedThisCycle: consideration.selfServeUsedThisCycle,
    },
  });
});
