/**
 * identity-verification-review — a super admin confirms or rejects a verdict.
 *
 * Auth: super admin + step-up OTP (`identity_review`). A human decision is the only way a
 * `rejected` verdict can be lifted and the only way an `unverified` capture becomes
 * `verified` without a cryptographic signal.
 */

import { capturePostHogEvent } from '../_shared/posthog.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { jsonError, jsonSuccess, readJsonBody, requireHttpMethod } from '../_shared/httpResponse.ts';
import { serveSuperAdmin } from '../_shared/serveEdge.ts';
import { logSuperAdminAction } from '../_shared/superAdminAudit.ts';
import { requireSuperAdminStepUp } from '../_shared/superAdminVerification.ts';
import { makeFlag, type IdentityFlag, type IdentityVerdict } from '../_shared/identityVerification.ts';

type Decision = 'approve' | 'reject' | 'request_reupload';

const DECISION_VERDICT: Record<Decision, IdentityVerdict> = {
  approve: 'verified',
  reject: 'rejected',
  request_reupload: 'unverified',
};

serveSuperAdmin('identity-verification-review', async (req, user) => {
  requireHttpMethod(req, 'POST');
  const stepped = await requireSuperAdminStepUp(req, user, 'identity_review');
  if (stepped) return stepped;

  const body = await readJsonBody(req);
  const verificationId = typeof body.verificationId === 'string' ? body.verificationId.trim() : '';
  const decision = typeof body.decision === 'string' ? (body.decision as Decision) : null;
  if (!verificationId) return jsonError(req, 'verificationId is required', 400);
  if (!decision || !(decision in DECISION_VERDICT)) {
    return jsonError(req, 'decision must be approve, reject, or request_reupload', 400);
  }
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : '';

  const supabase = createServiceClient();
  const { data } = await supabase
    .from('identity_verifications')
    .select('id, verdict, flags, organization_id, booking_id, subject_kind')
    .eq('id', verificationId)
    .maybeSingle();
  const row = data as
    | {
        id: string;
        verdict: IdentityVerdict;
        flags: IdentityFlag[] | null;
        organization_id: string | null;
        booking_id: string | null;
        subject_kind: string;
      }
    | null;
  if (!row) return jsonError(req, 'Verification not found', 404);

  const nextVerdict = DECISION_VERDICT[decision];
  const nextFlags =
    decision === 'reject'
      ? [...(row.flags ?? []), makeFlag('reviewer_rejected', note || undefined)]
      : (row.flags ?? []).filter((flag) => flag.code !== 'reviewer_rejected');

  const { error } = await supabase
    .from('identity_verifications')
    .update({
      verdict: nextVerdict,
      flags: nextFlags,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      review_note: note || null,
      ...(decision === 'approve' ? { verified_at: new Date().toISOString() } : {}),
    })
    .eq('id', verificationId);
  if (error) return jsonError(req, 'Could not save the review', 500);

  if (row.organization_id) {
    await logSuperAdminAction(user, {
      action: 'identity.verification_reviewed',
      targetType: 'identity_verification',
      targetId: verificationId,
      summary: `Identity verification ${decision}`,
      metadata: { decision, previousVerdict: row.verdict, verdict: nextVerdict },
      mirrorToOrgActivity: {
        organizationId: row.organization_id,
        action: 'identity.verification_reviewed',
        targetType: 'identity_verification',
        targetId: verificationId,
        targetLabel: 'identity verification',
        metadata: { decision, verdict: nextVerdict },
        req,
      },
    });
  } else {
    await logSuperAdminAction(user, {
      action: 'identity.verification_reviewed',
      targetType: 'identity_verification',
      targetId: verificationId,
      summary: `Guest identity verification ${decision}`,
      metadata: { decision, previousVerdict: row.verdict, verdict: nextVerdict },
    });
  }

  await capturePostHogEvent('identity_session_completed', {
    logPrefix: 'identity-verification-review',
    distinctId: user.id,
    request: req,
    system: true,
    properties: { decision, verdict: nextVerdict, reviewed: true },
    groups: { organization: row.organization_id },
  });

  return jsonSuccess(
    req,
    { verificationId, verdict: nextVerdict, decision },
    undefined,
    'mutation'
  );
});
