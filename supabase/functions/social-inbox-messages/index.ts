/**
 * Paginated messages for one conversation; mark read; edit host messages.
 */

import {
  assertHostCanEditMessage,
  assertHostCanUnsendMessage,
  editMessageBody,
  softDeleteMessage,
} from '../_shared/chatMessageLifecycle.ts';
import { resolveInboxAccess } from '../_shared/inboxAccess.ts';
import { resolveMetaConnectionIdsForScope } from '../_shared/metaInboxScope.ts';
import {
  attachConversationConnectionStatus,
  conversationAllowedInScope,
  enrichConversationMessageAttachments,
  fillMissingMetaParticipantIdentity,
  getConversationById,
  listMessages,
  markConversationRead,
} from '../_shared/socialInboxService.ts';
import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('social-inbox-messages', async (req) => {
  const url = new URL(req.url);
  const conversationId = url.searchParams.get('conversation_id')?.trim();
  if (!conversationId) {
    return jsonError(req, 'conversation_id required', 400);
  }

  let body: Record<string, unknown> = {};
  if (req.method === 'POST' || req.method === 'PATCH') {
    body = (await readJsonBody(req).catch(() => ({}))) as Record<string, unknown>;
  }

  const action = String(body.action ?? '').trim();
  const needsReply = req.method === 'PATCH' || (req.method === 'POST' && action === 'unsend');
  const ctx = await resolveInboxAccess(req, needsReply ? 'reply' : 'view', body);

  const conv = await getConversationById(ctx.orgId, conversationId);
  if (!conv) {
    return jsonError(req, 'Conversation not found', 404);
  }

  const metaIds = new Set(await resolveMetaConnectionIdsForScope(ctx.orgId, ctx.scope));
  if (
    !conversationAllowedInScope(conv, {
      propertyId: ctx.propertyId,
      parkingId: ctx.parkingId,
      metaIds,
    })
  ) {
    return jsonError(req, 'Conversation not found', 404);
  }

  if (req.method === 'GET') {
    const before = url.searchParams.get('before') ?? undefined;
    const namedConv = await fillMissingMetaParticipantIdentity(conv);
    const { messages, hasMore } = await listMessages(ctx.orgId, conversationId, { before });
    const enriched = await enrichConversationMessageAttachments(namedConv, messages);
    const [conversation] = await attachConversationConnectionStatus([namedConv]);
    return jsonSuccess(req, {
      conversation: conversation ?? namedConv,
      messages: enriched,
      hasMore,
    });
  }

  if (req.method === 'POST') {
    if (action === 'unsend') {
      const messageId = String(body.messageId ?? body.message_id ?? '').trim();
      if (!messageId) {
        return jsonError(req, 'messageId required', 400);
      }
      try {
        await assertHostCanUnsendMessage(ctx.orgId, conversationId, messageId);
        await softDeleteMessage(messageId, { conversationId });
        return jsonSuccess(req, { unsent: true });
      } catch (e) {
        const message = (e as Error).message;
        if (message === 'Conversation not found' || message === 'Message not found') {
          return jsonError(req, message, 404);
        }
        if (
          message === 'Cannot edit this message' ||
          message === 'Message already read' ||
          message === 'Guest already replied'
        ) {
          return jsonError(req, message, 400);
        }
        throw e;
      }
    }

    await markConversationRead(ctx.orgId, conversationId);
    return jsonSuccess(req, { read: true });
  }

  if (req.method === 'PATCH') {
    const messageId = String(body.messageId ?? body.message_id ?? '').trim();
    const text = String(body.text ?? '').trim();
    if (!messageId || !text) {
      return jsonError(req, 'messageId and text required', 400);
    }
    try {
      await assertHostCanEditMessage(ctx.orgId, conversationId, messageId);
      const message = await editMessageBody(messageId, text, {
        refreshPreview: true,
        conversationId,
      });
      return jsonSuccess(req, { message });
    } catch (e) {
      const message = (e as Error).message;
      if (message === 'Conversation not found' || message === 'Message not found') {
        return jsonError(req, message, 404);
      }
      if (
        message === 'Cannot edit this message' ||
        message === 'Message already read' ||
        message === 'Guest already replied' ||
        message === 'Message text required'
      ) {
        return jsonError(req, message, 400);
      }
      throw e;
    }
  }

  return jsonError(req, 'Method not allowed', 405);
});
