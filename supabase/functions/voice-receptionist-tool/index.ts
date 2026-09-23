/**
 * voice-receptionist-tool — executes a closed set of guest-safe tools for an active session.
 * Tool names, arguments, data scope, spoken text, and UI actions are server-authoritative.
 * Auth: any signed-in guest (Supabase JWT); the session must belong to that guest.
 */

import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import { identityFromRequest, rateLimitGate } from '../_shared/rateLimit.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import {
  loadVoiceReceptionistSessionForGuest,
  recordVoiceReceptionistToolMetric,
} from '../_shared/voiceReceptionistService.ts';
import {
  executeVoiceReceptionistTool,
  type VoiceReceptionistToolName,
} from '../_shared/voiceReceptionistTool.ts';

const TOOL_NAMES: VoiceReceptionistToolName[] = [
  'get_property_facts',
  'check_dates',
  'get_inquiry_price',
  'get_my_stay',
  'get_stay_guide',
  'handoff_to_host',
];
const TOOL_TIMEOUT_MS = 8_000;

serveAuthenticated('voice-receptionist-tool', async (req, user) => {
  if (req.method !== 'POST') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const limited = await rateLimitGate(req, {
    scope: 'voice-receptionist-tool',
    identity: identityFromRequest(req, user),
    limit: 120,
    windowSec: 3600,
  });
  if (limited) return limited;

  const body = await readJsonBody(req);
  const sessionId = String(body.sessionId ?? body.session_id ?? '').trim();
  const toolName = String(
    body.toolName ?? body.tool_name ?? ''
  ).trim() as VoiceReceptionistToolName;
  const args =
    body.args && typeof body.args === 'object' && !Array.isArray(body.args)
      ? (body.args as Record<string, unknown>)
      : {};
  if (!sessionId || !TOOL_NAMES.includes(toolName)) {
    return jsonError(req, 'A valid sessionId and toolName are required', 400);
  }

  const session = await loadVoiceReceptionistSessionForGuest(sessionId, user.id);
  if (!session) {
    return jsonError(req, 'Voice session not found', 404);
  }
  if (session.endedAt || session.status !== 'active') {
    return jsonError(req, 'Voice session has ended', 410);
  }

  const toolStartedAt = performance.now();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      executeVoiceReceptionistTool({
        name: toolName,
        args,
        propertyId: session.propertyId,
        guestUserId: user.id,
      }),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Voice tool timed out')), TOOL_TIMEOUT_MS);
      }),
    ]);
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    const durationMs = Math.round(performance.now() - toolStartedAt);
    await recordVoiceReceptionistToolMetric({
      sessionId,
      toolName,
      durationMs,
      outcome: 'success',
    });
    console.info(
      JSON.stringify({
        event: 'voice_tool_completed',
        toolName,
        durationMs,
        outcome: 'success',
      })
    );
    return jsonSuccess(req, { toolName, ...result });
  } catch (e) {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    const message = (e as Error).message;
    const durationMs = Math.round(performance.now() - toolStartedAt);
    await recordVoiceReceptionistToolMetric({
      sessionId,
      toolName,
      durationMs,
      outcome: 'failed',
    });
    console.warn(
      JSON.stringify({
        event: 'voice_tool_completed',
        toolName,
        durationMs,
        outcome: 'failed',
      })
    );
    if (
      message === 'Property not found' ||
      message === 'Unsupported property fact' ||
      message === 'A valid stay of 1 to 90 nights is required'
    ) {
      return jsonError(req, message, message === 'Property not found' ? 404 : 400);
    }
    throw e;
  }
});
