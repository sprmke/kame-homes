/**
 * approve-org-verification — Super admin approves a pending host (org) verification tier.
 * Host scope only — no listing status changes. Listing activation and the tower+unit peer
 * handoff live in approve-listing-authorization (verification scope split).
 */

import { createServiceClient, serializeOrganization, type OrgRow } from '../_shared/orgAuth.ts';
import {
  orgVerificationToSettingsValue,
  readOrgVerificationFromSettings,
} from '../_shared/orgVerification.ts';
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
import { maybeGrantHostVerificationReward } from '../_shared/hostVerificationReward.ts';

serveAuthenticated('approve-org-verification', async (req) => {
  requireHttpMethod(req, 'POST');
  const admin = await verifySuperAdminJwt(req);

  const body = await readJsonBody(req);
  const orgId = typeof body.orgId === 'string' ? body.orgId.trim() : '';
  const tier = body.tier === 'enhanced' ? 'enhanced' : body.tier === 'base' ? 'base' : '';
  if (!orgId) return jsonError(req, 'orgId is required');
  if (!tier) return jsonError(req, 'tier must be base or enhanced');

  const supabase = createServiceClient();
  const { data: orgRow, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', orgId)
    .maybeSingle();

  if (error) {
    console.error('[approve-org-verification]', error.message);
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
      baseStatus: 'approved',
      baseRejectionReason: null,
      baseRejectionKind: null,
      baseChangesRequestedDocs: [],
    };
  } else {
    if (verification.enhancedStatus !== 'pending') {
      return jsonError(req, 'Enhanced verification is not pending review');
    }
    verification = {
      ...verification,
      enhancedStatus: 'approved',
      enhancedRejectionReason: null,
      enhancedRejectionKind: null,
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
    console.error('[approve-org-verification]', updateError?.message);
    return jsonError(req, 'Failed to approve verification', 500);
  }

  await logSuperAdminAction(admin, {
    action: 'org_verification.approve',
    targetType: 'organization',
    targetId: orgId,
    summary: `Approved ${tier} verification for ${(data as OrgRow).name ?? orgId}`,
    metadata: { tier },
  });

  await logActivity({
    action: 'verification.approved',
    organizationId: orgId,
    scope: 'org',
    actor: buildActorContext(
      'dashboard',
      { superAdmin: { id: admin.id, email: admin.email } },
      req
    ),
    targetType: 'verification',
    targetId: orgId,
    targetLabel: (data as OrgRow).name ?? 'the organization',
    metadata: { kind: `${tier} host verification`, via: 'platform_review' },
  });

  let rewardGrant: Awaited<ReturnType<typeof maybeGrantHostVerificationReward>> | null = null;
  if (tier === 'enhanced') {
    try {
      rewardGrant = await maybeGrantHostVerificationReward(orgId, {
        trigger: 'recommended_verification_approved',
        assignedBy: admin.id,
      });
    } catch (err) {
      console.error('[approve-org-verification] reward grant', err);
    }
  }

  return jsonSuccess(req, {
    organization: serializeOrganization(data as OrgRow),
    rewardGrant,
  });
});
