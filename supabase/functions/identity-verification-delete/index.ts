/**
 * identity-verification-delete — the data-subject right, wired.
 *
 * A guest can delete their own verification. The verdict row and every capture for its
 * session are removed; `guest_submissions.primary_identity_verification_id` is
 * `ON DELETE SET NULL`, so the booking keeps its `valid_id_url` and no stay is silently
 * un-verified mid-flight beyond the badge itself.
 *
 * Auth: the subject. No super admin path here on purpose — an operator deleting a guest's
 * identity is a support workflow that should go through a recorded request.
 */

import { buildActorContext, logActivity } from '../_shared/activityLog.ts';
import { capturePostHogEvent } from '../_shared/posthog.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { jsonError, jsonSuccess, readJsonBody, requireHttpMethod } from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { IDENTITY_CAPTURE_BUCKET, identityCapturePrefix } from '../_shared/identitySessionService.ts';

serveAuthenticated('identity-verification-delete', async (req, user) => {
  requireHttpMethod(req, 'POST');
  const body = await readJsonBody(req);
  const verificationId =
    typeof body.verificationId === 'string' ? body.verificationId.trim() : '';
  if (!verificationId) return jsonError(req, 'verificationId is required', 400);

  const supabase = createServiceClient();
  const { data } = await supabase
    .from('identity_verifications')
    .select('id, guest_user_id, owner_user_id, organization_id, booking_id')
    .eq('id', verificationId)
    .maybeSingle();
  const row = data as
    | {
        id: string;
        guest_user_id: string | null;
        owner_user_id: string | null;
        organization_id: string | null;
        booking_id: string | null;
      }
    | null;
  const ownsRow = row && (row.guest_user_id === user.id || row.owner_user_id === user.id);
  if (!row || !ownsRow) return jsonError(req, 'Not found', 404);

  // Capture cleanup first: a failed file delete must not leave the row pointing at an
  // orphan. Best-effort — the purge cron is the backstop.
  const { data: sessions } = await supabase
    .from('identity_verification_sessions')
    .select('id, subject_kind, guest_user_id, owner_user_id, organization_id')
    .eq('result_id', verificationId)
    .limit(10);
  for (const session of (sessions ?? []) as Array<{
    id: string;
    subject_kind: 'guest' | 'org_owner';
    guest_user_id: string | null;
    owner_user_id: string | null;
    organization_id: string | null;
  }>) {
    const prefix = identityCapturePrefix(session);
    const { data: entries } = await supabase.storage
      .from(IDENTITY_CAPTURE_BUCKET)
      .list(prefix, { limit: 100 });
    const paths = (entries ?? [])
      .filter((entry) => entry.name)
      .map((entry) => `${prefix}/${entry.name}`);
    if (paths.length > 0) {
      await supabase.storage.from(IDENTITY_CAPTURE_BUCKET).remove(paths);
    }
  }

  const { error } = await supabase.from('identity_verifications').delete().eq('id', verificationId);
  if (error) return jsonError(req, 'Could not delete the verification', 500);

  await supabase
    .from('guest_profiles')
    .update({ identity_verified_at: null })
    .eq('user_id', user.id);

  let organizationId = row.organization_id;
  if (!organizationId && row.booking_id) {
    const { data: booking } = await supabase
      .from('guest_submissions')
      .select('property_id')
      .eq('id', row.booking_id)
      .maybeSingle();
    const propertyId = (booking as { property_id: string | null } | null)?.property_id ?? null;
    if (propertyId) {
      const { data: property } = await supabase
        .from('properties')
        .select('organization_id')
        .eq('id', propertyId)
        .maybeSingle();
      organizationId = (property as { organization_id: string } | null)?.organization_id ?? null;
    }
  }

  if (organizationId) {
    await logActivity({
      action: 'identity.verification_deleted',
      organizationId,
      scope: 'org',
      actor: buildActorContext('dashboard', { authUser: user, actorType: 'guest' }, req),
      targetType: 'identity_verification',
      targetId: verificationId,
      targetLabel: 'guest identity verification',
      metadata: { selfService: true },
    });
  }

  await capturePostHogEvent('identity_verification_deleted', {
    logPrefix: 'identity-verification-delete',
    distinctId: user.id,
    request: req,
    properties: { selfService: true },
    groups: { organization: organizationId },
  });

  return jsonSuccess(req, { verificationId, deleted: true }, undefined, 'mutation');
});
