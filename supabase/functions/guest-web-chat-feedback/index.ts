/**
 * guest-web-chat-feedback — thumbs on one AI web-chat reply.
 *
 * POST { conversationId, messageId, rating: 1 | -1 | 0, reason? }   0 clears.
 *
 * Caller must own the web conversation. Message must be outbound + is_ai_generated.
 * activity-log: N/A — private quality signal, no org / property / parking state.
 */

import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import { identityFromRequest, rateLimitGate } from '../_shared/rateLimit.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { assertGuestOwnsWebConversation } from '../_shared/webGuestChatService.ts';

const REASON_MAX = 500;

serveAuthenticated('guest-web-chat-feedback', async (req, user) => {
  if (req.method !== 'POST') return jsonError(req, 'Method not allowed', 405);

  const limited = await rateLimitGate(req, {
    scope: 'guest-web-chat-feedback',
    identity: identityFromRequest(req, user),
    limit: 20,
    windowSec: 3600,
  });
  if (limited) return limited;

  const body = await readJsonBody(req);
  const conversationId = typeof body.conversationId === 'string' ? body.conversationId.trim() : '';
  const messageId = typeof body.messageId === 'string' ? body.messageId.trim() : '';
  const rating = body.rating;
  if (!conversationId || !messageId) {
    return jsonError(req, 'conversationId and messageId are required', 400);
  }
  if (rating !== 1 && rating !== -1 && rating !== 0) {
    return jsonError(req, 'rating must be 1, -1 or 0', 400);
  }
  if (body.reason !== undefined && typeof body.reason !== 'string') {
    return jsonError(req, 'reason must be a string', 400);
  }
  const reason =
    typeof body.reason === 'string' && body.reason.trim()
      ? body.reason.trim().slice(0, REASON_MAX)
      : null;

  let conv;
  try {
    conv = await assertGuestOwnsWebConversation(user.id, conversationId);
  } catch (e) {
    const message = (e as Error).message;
    if (message === 'Conversation not found') return jsonError(req, message, 404);
    throw e;
  }

  const sb = createServiceClient();
  const { data: message, error: messageError } = await sb
    .from('social_messages')
    .select('id, conversation_id, direction, is_ai_generated')
    .eq('id', messageId)
    .eq('conversation_id', conv.id)
    .maybeSingle();
  if (messageError || !message || message.direction !== 'outbound' || !message.is_ai_generated) {
    return jsonError(req, 'Message not found', 404);
  }

  if (rating === 0) {
    const { error } = await sb
      .from('guest_chat_ai_feedback')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', user.id);
    if (error) return jsonError(req, `Failed to clear feedback: ${error.message}`, 500);
    return jsonSuccess(req, { messageId, rating: 0 });
  }

  const { error } = await sb.from('guest_chat_ai_feedback').upsert(
    {
      organization_id: conv.organization_id,
      user_id: user.id,
      conversation_id: conv.id,
      message_id: messageId,
      rating,
      reason,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'message_id,user_id' }
  );
  if (error) return jsonError(req, `Failed to save feedback: ${error.message}`, 500);
  return jsonSuccess(req, { messageId, rating });
});
