/**
 * dashboard-assistant-feedback — thumbs up / down on one assistant reply.
 *
 * POST { messageId, rating: 1 | -1 | 0, reason? }   0 clears the caller's rating.
 *
 * The caller must own the conversation the message belongs to, and the message must be an
 * assistant row. One rating per user and message (upsert). Read on the super-admin AI usage tab.
 * Docs: docs/workflow/in-progress/ai-chat-mode.md (Phase 5).
 *
 * activity-log: N/A — private quality signal about an AI reply, no org / property / parking state.
 */

import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

const REASON_MAX = 500;

serveAuthenticated('dashboard-assistant-feedback', async (req, user) => {
  if (req.method !== 'POST') return jsonError(req, 'Method not allowed', 405);

  const body = await readJsonBody(req);
  const messageId = typeof body.messageId === 'string' ? body.messageId.trim() : '';
  const rating = body.rating;
  if (!messageId) return jsonError(req, 'messageId is required', 400);
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

  const sb = createServiceClient();
  const { data: message, error: messageError } = await sb
    .from('ai_dashboard_assistant_messages')
    .select('id, role, conversation_id')
    .eq('id', messageId)
    .maybeSingle();
  if (messageError || !message || message.role !== 'assistant') {
    return jsonError(req, 'Message not found', 404);
  }
  const { data: conversation } = await sb
    .from('ai_dashboard_assistant_conversations')
    .select('id, user_id, organization_id')
    .eq('id', message.conversation_id)
    .maybeSingle();
  if (!conversation || conversation.user_id !== user.id) {
    return jsonError(req, 'Message not found', 404);
  }

  if (rating === 0) {
    const { error } = await sb
      .from('ai_dashboard_assistant_feedback')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', user.id);
    if (error) return jsonError(req, `Failed to clear feedback: ${error.message}`, 500);
    return jsonSuccess(req, { messageId, rating: 0 });
  }

  const { error } = await sb.from('ai_dashboard_assistant_feedback').upsert(
    {
      organization_id: conversation.organization_id,
      user_id: user.id,
      conversation_id: conversation.id,
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
