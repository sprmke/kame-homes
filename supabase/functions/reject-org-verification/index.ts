/**
 * reject-org-verification — Super admin requests document changes or rejects with a reason.
 * Both set base/enhanced status to `rejected` and persist the message for the host Get Verified modal.
 */

import { createServiceClient, serializeOrganization, type OrgRow } from '../_shared/orgAuth.ts';
import {
  ORG_VERIFICATION_REJECTION_KINDS,
  asChangesRequestedDocs,
  orgVerificationToSettingsValue,
  readOrgVerificationFromSettings,
  type OrgVerificationRejectionKind,
} from '../_shared/orgVerification.ts';
import { sendOrgVerificationRejectedEmail } from '../_shared/orgVerificationEmail.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { logSuperAdminAction } from '../_shared/superAdminAudit.ts';
import { verifySuperAdminJwt } from '../_shared/superAdminAuth.ts';
import { buildActorContext, logActivity } from '../_shared/activityLog.ts';

serveAuthenticated('reject-org-verification', async (req) => {
  requireHttpMethod(req, 'POST');
  const admin = await verifySuperAdminJwt(req);

  const body = await readJsonBody(req);
  const orgId = typeof body.orgId === 'string' ? body.orgId.trim() : '';
  const tier = body.tier === 'enhanced' ? 'enhanced' : body.tier === 'base' ? 'base' : '';
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  const kindRaw = typeof body.kind === 'string' ? body.kind.trim() : 'rejected';
  const kindNormalized = kindRaw === 'compliance' ? 'changes' : kindRaw;
  const kind = ORG_VERIFICATION_REJECTION_KINDS.includes(
    kindNormalized as OrgVerificationRejectionKind
  )
    ? (kindNormalized as OrgVerificationRejectionKind)
    : null;

  const changesRequestedDocs =
    kind === 'changes' ? asChangesRequestedDocs(body.changesRequestedDocs) : [];

  if (!orgId) return jsonError(req, 'orgId is required');
  if (!tier) return jsonError(req, 'tier must be base or enhanced');
  if (!reason) {
    return jsonError(req, kind === 'changes' ? 'notes are required' : 'reason is required');
  }
  if (!kind) return jsonError(req, 'kind must be changes or rejected');

  const supabase = createServiceClient();
  const { data: orgRow, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', orgId)
    .maybeSingle();

  if (error) {
    console.error('[reject-org-verification]', error.message);
    throw new Error('Failed to load organization');
  }
  if (!orgRow) return jsonError(req, 'Organization not found', 404);

  const org = orgRow as OrgRow;
  const currentSettings =
    org.settings && typeof org.settings === 'object' && !Array.isArray(org.settings)
      ? (org.settings as Record<string, unknown>)
      : {};
  let verification = readOrgVerificationFromSettings(currentSettings);

  if (tier === 'base') {
    if (verification.baseStatus !== 'pending') {
      return jsonError(req, 'Base verification is not pending review');
    }
    verification = {
      ...verification,
      baseStatus: 'rejected',
      baseRejectionReason: reason,
      baseRejectionKind: kind,
      baseChangesRequestedDocs: kind === 'changes' ? changesRequestedDocs : [],
    };
  } else {
    if (verification.enhancedStatus !== 'pending') {
      return jsonError(req, 'Enhanced verification is not pending review');
    }
    verification = {
      ...verification,
      enhancedStatus: 'rejected',
      enhancedRejectionReason: reason,
      enhancedRejectionKind: kind,
    };
  }

  const { data, error: updateError } = await supabase
    .from('organizations')
    .update({
      settings: {
        ...currentSettings,
        verification: orgVerificationToSettingsValue(verification),
      },
    })
    .eq('id', orgId)
    .select('*')
    .single();

  if (updateError || !data) {
    console.error('[reject-org-verification]', updateError?.message);
    return jsonError(req, 'Failed to reject verification', 500);
  }

  const updated = data as OrgRow;
  if (kind === 'rejected' && tier === 'base' && updated.owner_id) {
    try {
      await sendOrgVerificationRejectedEmail({
        supabase,
        ownerId: updated.owner_id,
        organizationName: updated.name,
        rejectionReason: reason,
      });
    } catch (err) {
      console.error(
        '[reject-org-verification] email',
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  await logSuperAdminAction(admin, {
    action: kind === 'changes' ? 'org_verification.request_changes' : 'org_verification.reject',
    targetType: 'organization',
    targetId: orgId,
    summary: `${kind === 'changes' ? 'Requested changes on' : 'Rejected'} ${tier} verification for ${updated.name ?? orgId}`,
    metadata: { tier, kind, reason },
  });

  await logActivity({
    action: 'verification.rejected',
    organizationId: orgId,
    scope: 'org',
    actor: buildActorContext(
      'dashboard',
      { superAdmin: { id: admin.id, email: admin.email } },
      req
    ),
    targetType: 'verification',
    targetId: orgId,
    targetLabel: updated.name ?? 'the organization',
    metadata: {
      kind: `${tier} host verification`,
      decision: kind === 'changes' ? 'changes_requested' : 'rejected',
      via: 'platform_review',
    },
  });

  return jsonSuccess(req, { organization: serializeOrganization(updated) });
});
