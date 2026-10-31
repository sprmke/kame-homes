/**
 * voice-receptionist-end — atomically ends a guest voice session and stores bounded browser
 * captions as unverified session evidence. Client-reported assistant text is never written
 * as a canonical outbound social message.
 * Auth: any signed-in guest (Supabase JWT); the session must belong to that guest.
 */

import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import {
  endVoiceReceptionistSession,
  loadVoiceReceptionistSessionForEnd,
  sanitizeVoiceReceptionistClientMetrics,
  sanitizeVoiceTranscriptTurns,
  storeClientReportedVoiceTranscript,
  storeVoiceReceptionistClientMetrics,
  type VoiceReceptionistEndReason,
} from '../_shared/voiceReceptionistService.ts';

const END_REASONS: VoiceReceptionistEndReason[] = [
  'guest_ended',
  'timeout',
  'cap_reached',
  'error',
  'provider_go_away',
  'provider_error',
  'page_closed',
  'idle_timeout',
];

serveAuthenticated('voice-receptionist-end', async (req, user) => {
  if (req.method !== 'POST') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const body = await readJsonBody(req);
  const sessionId = String(body.sessionId ?? body.session_id ?? '').trim();
  if (!sessionId) {
    return jsonError(req, 'sessionId is required', 400);
  }
  const endReasonRaw = String(body.endReason ?? body.end_reason ?? 'guest_ended').trim();
  const endReason = END_REASONS.includes(endReasonRaw as VoiceReceptionistEndReason)
    ? (endReasonRaw as VoiceReceptionistEndReason)
    : 'guest_ended';
  const turns = sanitizeVoiceTranscriptTurns(body.transcript);
  const metrics = sanitizeVoiceReceptionistClientMetrics(body.metrics);

  const session = await loadVoiceReceptionistSessionForEnd(sessionId, user.id);
  if (!session) {
    return jsonError(req, 'Voice session not found', 404);
  }

  const result = await endVoiceReceptionistSession(session, endReason, user.id);
  await storeVoiceReceptionistClientMetrics(session.id, user.id, metrics);

  if (turns.length) {
    try {
      await storeClientReportedVoiceTranscript(session, user.id, turns);
    } catch (e) {
      console.error(
        '[voice-receptionist-end] transcript evidence write failed:',
        (e as Error).message
      );
    }
  }

  console.info(
    JSON.stringify({
      event: 'voice_session_end_processed',
      endReason,
      transitioned: result.transitioned,
      transcriptTurnCount: turns.length,
    })
  );

  return jsonSuccess(req, result);
});
