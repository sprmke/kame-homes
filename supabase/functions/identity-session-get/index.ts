/**
 * identity-session-get — the phone's bootstrap and the desktop's polling endpoint.
 *
 * Auth: the handoff token (`?t=` or `x-identity-session`). Public by design: the phone is
 * not signed in. Nothing personal is returned — status, step, and (once completed) a
 * masked name plus the verdict.
 *
 * The token is NOT consumed here. iOS Safari reloads a backgrounded tab; burning the token
 * on first read would strand the guest mid-capture. Replay is bounded by the session status
 * and the 10-minute expiry instead.
 */

import { capturePostHogEvent } from '../_shared/posthog.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { jsonError, jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import { publicGetRateLimitGate } from '../_shared/publicEndpointRateLimit.ts';
import { servePublic } from '../_shared/serveEdge.ts';
import { identitySessionTokenFromRequest, verifyIdentitySessionToken } from '../_shared/identitySessionToken.ts';
import {
  claimSession,
  expireSessionIfStale,
  loadSessionByToken,
  toMicroView,
} from '../_shared/identitySessionService.ts';
import type { IdentityFlag, IdentityVerdict } from '../_shared/identityVerification.ts';

type VerdictRow = {
  verdict: IdentityVerdict;
  flags: IdentityFlag[];
  document_type: string | null;
  full_name: string | null;
};

servePublic('identity-session-get', async (req) => {
  requireHttpMethod(req, 'GET');

  // The desktop polls this every 2-5s, so the ceiling is generous but bounded.
  const limited = await publicGetRateLimitGate(req, 'identity-session-get', { maxPerMin: 120 });
  if (limited) return limited;

  const token = identitySessionTokenFromRequest(req);
  const verified = await verifyIdentitySessionToken(token);
  if (!verified.ok) {
    const message =
      verified.reason === 'expired'
        ? 'This link expired. Start again on your computer.'
        : 'This link is not valid.';
    return jsonError(req, message, verified.reason === 'expired' ? 410 : 401);
  }

  const supabase = createServiceClient();
  const loaded = await loadSessionByToken(supabase, verified.sessionId, token ?? '');
  if (!loaded) return jsonError(req, 'This link is not valid.', 401);

  let session = await expireSessionIfStale(supabase, loaded);

  const url = new URL(req.url);
  const fromMobile = url.searchParams.get('device') === 'mobile';
  if (fromMobile && session.status === 'pending') {
    session = await claimSession(supabase, session, 'mobile');
    await capturePostHogEvent('identity_handoff_scanned', {
      logPrefix: 'identity-session-get',
      request: req,
      properties: { subjectKind: session.subject_kind },
    });
  }

  let verdict: VerdictRow | null = null;
  if (session.result_id) {
    const { data } = await supabase
      .from('identity_verifications')
      .select('verdict, flags, document_type, full_name')
      .eq('id', session.result_id)
      .maybeSingle();
    verdict = (data as VerdictRow | null) ?? null;
  }

  const view = toMicroView(session, verdict);

  return jsonSuccess(
    req,
    {
      ...view,
      subjectKind: session.subject_kind,
      guestSlot: session.guest_slot,
      // `expired` is surfaced separately so the UI can offer a restart instead of an error.
      expired: session.status === 'expired',
    },
    undefined,
    'guestToken'
  );
});
