/**
 * decide-contract-consideration — Super Admin grant / deny / request changes.
 * Scoped per listing (listingKind + listingId): grant reactivates that listing only, after the
 * tower+unit conflict check; deny archives that listing only.
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import {
  appendConsiderationAudit,
  maxGrantedUntilYmd,
  validateGrantedUntil,
} from '../_shared/contractLifecycle.ts';
import { manilaTodayYmd } from '../_shared/calendarAvailabilityManila.ts';
import { listingTableForKind } from '../_shared/listingAuthorization.ts';
import {
  loadListingContext,
  parseListingKind,
  saveListingAuthorization,
} from '../_shared/listingAuthorizationService.ts';
import { collectUnitConflictsForOrgProperties } from '../_shared/propertyTowerUnit.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { serveSuperAdmin } from '../_shared/serveEdge.ts';
import { logSuperAdminAction } from '../_shared/superAdminAudit.ts';
import { requireSuperAdminStepUp } from '../_shared/superAdminVerification.ts';

serveSuperAdmin('decide-contract-consideration', async (req, user) => {
  const stepUp = await requireSuperAdminStepUp(req, user, 'contract_consideration');
  if (stepUp) return stepUp;

  requireHttpMethod(req, 'POST');
  const body = await readJsonBody(req);

  const listingKind = parseListingKind(body.listingKind ?? body.leg);
  const listingId = typeof body.listingId === 'string' ? body.listingId.trim() : '';
  const decisionRaw = typeof body.decision === 'string' ? body.decision.trim() : '';
  const decision =
    decisionRaw === 'grant' || decisionRaw === 'deny' || decisionRaw === 'changes'
      ? decisionRaw
      : null;
  const note = typeof body.note === 'string' ? body.note.trim() : '';
  const grantedUntilRaw = typeof body.grantedUntil === 'string' ? body.grantedUntil.trim() : '';
  const allowOverride = body.allowConsiderationOverride === true;

  if (!listingKind) return jsonError(req, 'listingKind must be property or parking');
  if (!listingId) return jsonError(req, 'listingId is required');
  if (!decision) return jsonError(req, 'decision must be grant, deny, or changes');

  const supabase = createServiceClient();
  const context = await loadListingContext(supabase, listingKind, listingId);
  const { authorization } = context;
  let life = authorization.lifecycle;

  if (life.consideration.status !== 'pending' && !allowOverride) {
    return jsonError(req, 'No pending consideration for this listing', 409);
  }

  const today = manilaTodayYmd();
  const table = listingTableForKind(listingKind);
  let archivedCount = 0;
  let activatedCount = 0;

  if (decision === 'grant') {
    const until = grantedUntilRaw || life.consideration.expectedDate || '';
    const dateError = validateGrantedUntil(until, today);
    if (dateError) return jsonError(req, dateError);
    if (until > maxGrantedUntilYmd(today)) {
      return jsonError(req, 'Grant cannot exceed 14 days');
    }

    if (listingKind === 'property') {
      const { data: property, error: propError } = await supabase
        .from('properties')
        .select('id, tower, unit_number, status')
        .eq('id', listingId)
        .maybeSingle();
      if (propError) return jsonError(req, propError.message, 500);
      if (!property) return jsonError(req, 'Property not found', 404);

      const { hasActiveUnitConflict, unitConflicts } = await collectUnitConflictsForOrgProperties(
        supabase,
        context.org.id,
        [property]
      );
      if (hasActiveUnitConflict) {
        return jsonError(
          req,
          `Cannot grant while another ACTIVE listing exists (${unitConflicts.map((c) => c.orgName).join(', ')})`,
          409
        );
      }
    }

    const { error: actError, data: activated } = await supabase
      .from(table)
      .update({ status: 'ACTIVE' })
      .eq('id', listingId)
      .eq('status', 'INACTIVE')
      .select('id');
    if (actError) return jsonError(req, actError.message, 500);
    activatedCount = activated?.length ?? 0;

    life = {
      ...life,
      accessLockedAt: null,
      consideration: appendConsiderationAudit(
        {
          ...life.consideration,
          status: 'granted',
          grantedUntil: until,
          allowConsiderationOverride: false,
        },
        { by: user.email, action: 'grant', note: note || null }
      ),
    };
  } else if (decision === 'deny') {
    const { data: archived, error: archError } = await supabase
      .from(table)
      .update({ status: 'INACTIVE' })
      .eq('id', listingId)
      .eq('status', 'ACTIVE')
      .select('id');
    if (archError) return jsonError(req, archError.message, 500);
    archivedCount = archived?.length ?? 0;

    life = {
      ...life,
      accessLockedAt: life.accessLockedAt ?? new Date().toISOString(),
      consideration: appendConsiderationAudit(
        {
          ...life.consideration,
          status: 'denied',
          grantedUntil: null,
        },
        { by: user.email, action: 'deny', note: note || null }
      ),
    };
  } else {
    // changes — host may resubmit if still in grace / override
    life = {
      ...life,
      consideration: appendConsiderationAudit(
        {
          ...life.consideration,
          status: 'changes',
          grantedUntil: null,
          selfServeUsedThisCycle: false,
          allowConsiderationOverride:
            allowOverride || life.consideration.allowConsiderationOverride,
        },
        { by: user.email, action: 'changes', note: note || null }
      ),
    };
  }

  await saveListingAuthorization(supabase, context, { ...authorization, lifecycle: life });

  await logSuperAdminAction(user, {
    action: 'listing.contract_consideration_decided',
    targetType: listingKind,
    targetId: listingId,
    summary: `Decided contract consideration (${decision})`,
    metadata: { listingKind, decision },
  });

  return jsonSuccess(req, {
    listingKind,
    listingId,
    decision,
    activatedCount,
    archivedCount,
    consideration: {
      status: life.consideration.status,
      grantedUntil: life.consideration.grantedUntil,
      expectedDate: life.consideration.expectedDate,
    },
  });
});
