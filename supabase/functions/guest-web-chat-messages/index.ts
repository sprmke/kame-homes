/**
 * guest-web-chat-messages — List, send, edit, or mark read in a guest web chat thread.
 * Auth: signed-in guest who owns the thread.
 */

import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import { identityFromRequest, rateLimitGate } from '../_shared/rateLimit.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import {
  editGuestWebMessage,
  listGuestWebMessages,
  markGuestWebConversationRead,
  sendGuestWebMessage,
  unsendGuestWebMessage,
} from '../_shared/webGuestChatService.ts';

serveAuthenticated('guest-web-chat-messages', async (req, user) => {
  const url = new URL(req.url);
  const conversationId = url.searchParams.get('conversation_id')?.trim();

  if (req.method === 'GET') {
    const id = conversationId ?? url.searchParams.get('conversationId')?.trim();
    if (!id) {
      return jsonError(req, 'conversation_id required', 400);
    }
    const before = url.searchParams.get('before') ?? undefined;
    try {
      const result = await listGuestWebMessages(user, id, { before });
      return jsonSuccess(req, result);
    } catch (e) {
      const message = (e as Error).message;
      if (message === 'Conversation not found') {
        return jsonError(req, message, 404);
      }
      throw e;
    }
  }

  if (req.method === 'POST') {
    // Durable per-user write rate limit — sends fan out to Resend + Telegram.
    // Plan: docs/workflow/in-progress/production-readiness/audits/captcha-anti-spam-hardening.md
    const limited = await rateLimitGate(req, {
      scope: 'guest-web-chat-messages',
      identity: identityFromRequest(req, user),
      limit: 40,
      windowSec: 300,
    });
    if (limited) return limited;

    const body = await readJsonBody(req);
    const action = String(body.action ?? '').trim();

    if (action === 'mark_read') {
      const id = String(body.conversationId ?? body.conversation_id ?? conversationId ?? '').trim();
      if (!id) return jsonError(req, 'conversationId required', 400);
      try {
        await markGuestWebConversationRead(user.id, id);
        return jsonSuccess(req, { read: true });
      } catch (e) {
        const message = (e as Error).message;
        if (message === 'Conversation not found') return jsonError(req, message, 404);
        throw e;
      }
    }

    if (action === 'unsend') {
      const id = String(body.conversationId ?? body.conversation_id ?? conversationId ?? '').trim();
      const messageId = String(body.messageId ?? body.message_id ?? '').trim();
      if (!id || !messageId) {
        return jsonError(req, 'conversationId and messageId required', 400);
      }
      try {
        await unsendGuestWebMessage(user, id, messageId);
        return jsonSuccess(req, { unsent: true });
      } catch (e) {
        const message = (e as Error).message;
        if (message === 'Conversation not found' || message === 'Message not found') {
          return jsonError(req, message, 404);
        }
        if (
          message === 'Cannot edit this message' ||
          message === 'Message already read' ||
          message === 'Host already replied'
        ) {
          return jsonError(req, message, 400);
        }
        throw e;
      }
    }

    const id = String(body.conversationId ?? body.conversation_id ?? conversationId ?? '').trim();
    const text = String(body.text ?? '').trim();
    const replyToMessageId = String(body.replyToMessageId ?? body.reply_to_message_id ?? '').trim();
    const attachments = body.attachments;
    if (!id) {
      return jsonError(req, 'conversationId required', 400);
    }
    if (!text && !Array.isArray(attachments)) {
      return jsonError(req, 'conversationId and text or attachments required', 400);
    }
    try {
      const sent = await sendGuestWebMessage(user, id, text, {
        replyToMessageId: replyToMessageId || undefined,
        attachments,
      });
      return jsonSuccess(req, { sent: true, assistantWillReply: sent.assistantWillReply });
    } catch (e) {
      const message = (e as Error).message;
      if (message === 'Conversation not found') return jsonError(req, message, 404);
      if (
        message === 'Message text required' ||
        message === 'Message text or attachment required' ||
        message === 'Reply target not found'
      ) {
        return jsonError(req, message, 400);
      }
      throw e;
    }
  }

  if (req.method === 'PATCH') {
    const body = await readJsonBody(req);
    const id = String(body.conversationId ?? body.conversation_id ?? conversationId ?? '').trim();
    const messageId = String(body.messageId ?? body.message_id ?? '').trim();
    const text = String(body.text ?? '').trim();
    if (!id || !messageId || !text) {
      return jsonError(req, 'conversationId, messageId, and text required', 400);
    }
    try {
      const message = await editGuestWebMessage(user, id, messageId, text);
      return jsonSuccess(req, { message });
    } catch (e) {
      const message = (e as Error).message;
      if (message === 'Conversation not found' || message === 'Message not found') {
        return jsonError(req, message, 404);
      }
      if (
        message === 'Cannot edit this message' ||
        message === 'Message already read' ||
        message === 'Host already replied' ||
        message === 'Message text required'
      ) {
        return jsonError(req, message, 400);
      }
      throw e;
    }
  }

  return jsonError(req, 'Method not allowed', 405);
});
