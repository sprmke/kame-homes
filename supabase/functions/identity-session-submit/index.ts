/**
 * identity-session-submit — run the verification pipeline for a captured session.
 *
 * Auth: the handoff token. Single-submit: the session row is moved to `submitted` with a
 * compare-and-set before any work starts, so two parallel requests cannot both verify.
 *
 * Never leaves the session half-done: a pipeline failure marks it `failed` with a
 * reason the phone can show, and the desktop polling loop sees that state.
 */

import { buildActorContext, logActivity } from '../_shared/activityLog.ts';
import { antiSpamGate } from '../_shared/antiSpam.ts';
import { capturePostHogEvent } from '../_shared/posthog.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { jsonError, jsonSuccess, readJsonBody, requireHttpMethod } from '../_shared/httpResponse.ts';
import { resolveOrganizationIdForProperty } from '../_shared/propertyScope.ts';
import { servePublic } from '../_shared/serveEdge.ts';
import {
  identitySessionTokenFromRequest,
  verifyIdentitySessionToken,
} from '../_shared/identitySessionToken.ts';
import {
  completeSession,
  expireSessionIfStale,
  isSubmittable,
  loadSessionByToken,
  runIdentityVerification,
  toMicroView,
  type IdentitySessionRow,
  type IdentitySubmitPayload,
} from '../_shared/identitySessionService.ts';

function readPayload(body: Record<string, unknown>): IdentitySubmitPayload {
  const liveness = body.liveness;
  const quality = body.quality;
  return {
    consentAccepted: body.consentAccepted === true,
    documentFrontPath: typeof body.documentFrontPath === 'string' ? body.documentFrontPath : null,
    documentBackPath: typeof body.documentBackPath === 'string' ? body.documentBackPath : null,
    selfiePath: typeof body.selfiePath === 'string' ? body.selfiePath : null,
    livenessFramePaths: Array.isArray(body.livenessFramePaths)
      ? body.livenessFramePaths.filter((value): value is string => typeof value === 'string')
      : [],
    philsysQr: typeof body.philsysQr === 'string' ? body.philsysQr : null,
    mrz: typeof body.mrz === 'string' ? body.mrz : null,
    documentTypeHint: typeof body.documentTypeHint === 'string' ? body.documentTypeHint : null,
    liveness:
      liveness && typeof liveness === 'object'
        ? {
            passed:
              typeof (liveness as Record<string, unknown>).passed === 'boolean'
                ? ((liveness as Record<string, unknown>).passed as boolean)
                : null,
            challenges: Array.isArray((liveness as Record<string, unknown>).challenges)
              ? ((liveness as Record<string, unknown>).challenges as unknown[]).filter(
                  (value): value is string => typeof value === 'string'
                )
              : [],
            frameCount:
              typeof (liveness as Record<string, unknown>).frameCount === 'number'
                ? ((liveness as Record<string, unknown>).frameCount as number)
                : 0,
            elapsedMs:
              typeof (liveness as Record<string, unknown>).elapsedMs === 'number'
                ? ((liveness as Record<string, unknown>).elapsedMs as number)
                : 0,
          }
        : null,
    quality:
      quality && typeof quality === 'object'
        ? {
            score:
              typeof (quality as Record<string, unknown>).score === 'number'
                ? ((quality as Record<string, unknown>).score as number)
                : undefined,
          }
        : null,
  };
}

async function resolveOrganizationId(session: IdentitySessionRow): Promise<string | null> {
  if (session.organization_id) return session.organization_id;
  if (!session.property_id) return null;
  try {
    return await resolveOrganizationIdForProperty(session.property_id);
  } catch {
    return null;
  }
}

servePublic('identity-session-submit', async (req) => {
  requireHttpMethod(req, 'POST');
  const body = await readJsonBody(req);

  const blocked = await antiSpamGate(req, body, {
    scope: 'identity-submit',
    heuristics: false,
    captcha: false,
    rateLimit: { limit: 8, windowSec: 60 },
  });
  if (blocked) return blocked;

  const token = identitySessionTokenFromRequest(req, body);
  const verified = await verifyIdentitySessionToken(token);
  if (!verified.ok) {
    return jsonError(
      req,
      verified.reason === 'expired'
        ? 'This link expired. Start again on your computer.'
        : 'This link is not valid.',
      verified.reason === 'expired' ? 410 : 401
    );
  }

  const supabase = createServiceClient();
  const loaded = await loadSessionByToken(supabase, verified.sessionId, token ?? '');
  if (!loaded) return jsonError(req, 'This link is not valid.', 401);

  const session = await expireSessionIfStale(supabase, loaded);
  if (!isSubmittable(session.status)) {
    if (session.status === 'completed') return jsonError(req, 'Already submitted', 409);
    return jsonError(req, 'This session is no longer active.', 409);
  }

  const payload = readPayload(body);
  if (!payload.consentAccepted) return jsonError(req, 'Consent is required', 400);

  // Compare-and-set: exactly one request wins the submit.
  const { data: claimed } = await supabase
    .from('identity_verification_sessions')
    .update({ status: 'submitted', step: 'verifying' })
    .eq('id', session.id)
    .in('status', ['pending', 'in_progress', 'captured'])
    .select('id, token_hash, subject_kind, guest_user_id, organization_id, booking_id, guest_slot, subject_email_hash, property_id, status, step, origin_device, failure_reason, attempt_count, claimed_at, result_id, expires_at, created_at, updated_at')
    .maybeSingle();
  if (!claimed) return jsonError(req, 'Already submitted', 409);

  const claimedSession = claimed as IdentitySessionRow;

  // The booking form's typed name is the cross-check target when a booking is known.
  let expectedFullName: string | null = null;
  if (claimedSession.booking_id) {
    const { data: booking } = await supabase
      .from('guest_submissions')
      .select('primary_guest_name')
      .eq('id', claimedSession.booking_id)
      .maybeSingle();
    expectedFullName = (booking as { primary_guest_name: string | null } | null)?.primary_guest_name ?? null;
  }

  try {
    const outcome = await runIdentityVerification(supabase, {
      session: claimedSession,
      payload,
      expectedFullName,
    });
    await completeSession(supabase, claimedSession, outcome.verificationId);

    const organizationId = await resolveOrganizationId(claimedSession);
    if (organizationId) {
      await logActivity({
        action: 'identity.session_completed',
        organizationId,
        propertyId: claimedSession.property_id,
        scope: 'org',
        actor: buildActorContext(
          'public_form',
          { guest: { email: null, name: null } },
          req
        ),
        targetType: 'identity_verification',
        targetId: outcome.verificationId,
        targetLabel:
          claimedSession.subject_kind === 'org_owner' ? 'host identity check' : 'guest identity check',
        // Never the name, document number, or capture path.
        metadata: {
          verdict: outcome.verdict,
          method: claimedSession.subject_kind,
          flags: outcome.flags.map((flag) => flag.code),
          guestSlot: claimedSession.guest_slot,
        },
      });
    }

    await capturePostHogEvent('identity_session_completed', {
      logPrefix: 'identity-session-submit',
      request: req,
      properties: {
        subjectKind: claimedSession.subject_kind,
        verdict: outcome.verdict,
        flagCount: outcome.flags.length,
      },
      groups: { organization: organizationId, property: claimedSession.property_id },
    });

    return jsonSuccess(
      req,
      {
        sessionId: claimedSession.id,
        verificationId: outcome.verificationId,
        status: 'completed',
        verdict: outcome.verdict,
        flags: outcome.flags,
        documentType: outcome.fields.documentType,
        maskedName: outcome.fields.fullName,
      },
      undefined,
      'mutation'
    );
  } catch (error) {
    console.error('[identity-session-submit] pipeline failed:', (error as Error).message);
    await supabase
      .from('identity_verification_sessions')
      .update({ status: 'failed', failure_reason: 'verification_failed', step: 'failed' })
      .eq('id', claimedSession.id)
      .eq('status', 'submitted');

    await capturePostHogEvent('identity_session_abandoned', {
      logPrefix: 'identity-session-submit',
      request: req,
      system: true,
      properties: { reason: 'pipeline_failed' },
    });

    return jsonError(req, 'We could not verify this document. Try again or upload a photo.', 422);
  }
});
