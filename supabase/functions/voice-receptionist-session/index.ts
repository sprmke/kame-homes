/**
 * Authenticated lifecycle acknowledgement for a guest-owned voice session.
 * `active` confirms provider setup completed; `heartbeat` renews the active lease.
 */

import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import { buildActorContext, logActivity } from '../_shared/activityLog.ts';
import { resolveOrganizationIdForProperty } from '../_shared/propertyScope.ts';
import { identityFromRequest, rateLimitGate } from '../_shared/rateLimit.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import {
  acknowledgeVoiceReceptionistSession,
  deleteGuestVoiceTranscript,
  heartbeatVoiceReceptionistSession,
  loadVoiceReceptionistSessionForGuest,
  markVoiceReceptionistHandoff,
} from '../_shared/voiceReceptionistService.ts';

serveAuthenticated('voice-receptionist-session', async (req, user) => {
  if (req.method !== 'POST') return jsonError(req, 'Method not allowed', 405);

  const limited = await rateLimitGate(req, {
    scope: 'voice-receptionist-session',
    identity: identityFromRequest(req, user),
    limit: 240,
    windowSec: 3600,
  });
  if (limited) return limited;

  const body = await readJsonBody(req);
  const sessionId = String(body.sessionId ?? body.session_id ?? '').trim();
  const action = String(body.action ?? '').trim();
  if (!sessionId) return jsonError(req, 'sessionId is required', 400);
  if (
    action !== 'active' &&
    action !== 'heartbeat' &&
    action !== 'handoff' &&
    action !== 'delete_transcript'
  ) {
    return jsonError(req, 'action must be active, heartbeat, handoff, or delete_transcript', 400);
  }

  if (action === 'delete_transcript') {
    const session = await loadVoiceReceptionistSessionForGuest(sessionId, user.id);
    if (!session) return jsonError(req, 'Voice session not found', 404);
    const deleted = await deleteGuestVoiceTranscript(sessionId, user.id);
    if (!deleted) return jsonError(req, 'Voice session not found', 404);
    await logActivity({
      action: 'privacy.data_deleted',
      organizationId: await resolveOrganizationIdForProperty(session.propertyId),
      propertyId: session.propertyId,
      actor: buildActorContext(
        'public_form',
        {
          authUser: { id: user.id, email: user.email },
          actorType: 'guest',
          role: 'guest',
        },
        req
      ),
      metadata: { target: 'voice_transcript', session_id: sessionId },
    });
    return jsonSuccess(req, { sessionId, status: 'discarded' });
  }

  const updated =
    action === 'active'
      ? await acknowledgeVoiceReceptionistSession(sessionId, user.id)
      : action === 'handoff'
        ? await markVoiceReceptionistHandoff(sessionId, user.id)
        : await heartbeatVoiceReceptionistSession(sessionId, user.id);
  if (!updated) return jsonError(req, 'Voice session is not active', 409);

  return jsonSuccess(req, {
    sessionId,
    status: action === 'active' ? 'active' : action === 'handoff' ? 'handoff' : 'ok',
  });
});
