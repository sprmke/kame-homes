/**
 * identity-session-cancel — the desktop aborts a handoff, or the guest backs out on the
 * phone after signing in.
 *
 * Auth: signed-in subject. The session must belong to the caller.
 */

import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { jsonError, jsonSuccess, readJsonBody, requireHttpMethod } from '../_shared/httpResponse.ts';
import { failSession } from '../_shared/identitySessionService.ts';

serveAuthenticated('identity-session-cancel', async (req, user) => {
  requireHttpMethod(req, 'POST');
  const body = await readJsonBody(req);
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
  if (!sessionId) return jsonError(req, 'sessionId is required', 400);

  const supabase = createServiceClient();
  const { data } = await supabase
    .from('identity_verification_sessions')
    .select('id, guest_user_id, owner_user_id, organization_id')
    .eq('id', sessionId)
    .maybeSingle();
  const session = data as
    | {
        id: string;
        guest_user_id: string | null;
        owner_user_id: string | null;
        organization_id: string | null;
      }
    | null;
  if (!session) return jsonError(req, 'Session not found', 404);

  // A guest owns the session when it is theirs; an org owner owns it when it targets their org.
  const ownsGuest = session.guest_user_id === user.id || session.owner_user_id === user.id;
  if (!ownsGuest) {
    if (!session.organization_id) return jsonError(req, 'Not found', 404);
    const { data: org } = await supabase
      .from('organizations')
      .select('owner_id')
      .eq('id', session.organization_id)
      .maybeSingle();
    if ((org as { owner_id: string } | null)?.owner_id !== user.id) {
      return jsonError(req, 'Not found', 404);
    }
  }

  await failSession(supabase, sessionId, 'cancelled_by_subject');
  return jsonSuccess(req, { sessionId, status: 'failed' }, undefined, 'mutation');
});
