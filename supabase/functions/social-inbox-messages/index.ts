/**
 * Paginated messages for one conversation; mark read; edit host messages.
 */

import {
  assertHostCanEditMessage,
  assertHostCanUnsendMessage,
  editMessageBody,
  softDeleteMessage,
} from '../_shared/chatMessageLifecycle.ts';
import { logActivity } from '../_shared/activityLog.ts';
import {
  listGuestRequestsForConversation,
  resolveGuestRequest,
} from '../_shared/guestRequestsService.ts';
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
import { featureUnavailableResponse } from '../_shared/featureAvailability.ts';
import type { SocialConversationRow } from '../_shared/socialInboxTypes.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

async function metaReplyFeatureBlock(
  req: Request,
  conv: SocialConversationRow,
  user: { id: string; email: string }
): Promise<Response | null> {
  if (conv.platform !== 'facebook' && conv.platform !== 'instagram') return null;
  return featureUnavailableResponse(req, 'inbox.meta.reply', { user });
}

serveAuthenticated('social-inbox-messages', async (req, user) => {
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
  const needsReply =
    req.method === 'PATCH' ||
    (req.method === 'POST' && (action === 'unsend' || action === 'resolve_guest_request'));
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
    const guestRequests = await listGuestRequestsForConversation(conversationId);
    return jsonSuccess(req, {
      conversation: conversation ?? namedConv,
      messages: enriched,
      hasMore,
      guestRequests,
    });
  }

  if (req.method === 'POST') {
    if (action === 'unsend') {
      const blocked = await metaReplyFeatureBlock(req, conv, user);
      if (blocked) return blocked;
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

    if (action === 'resolve_guest_request') {
      const requestId = String(body.requestId ?? body.request_id ?? '').trim();
      const status = String(body.status ?? '').trim();
      if (!requestId || (status !== 'approved' && status !== 'declined')) {
        return jsonError(req, 'requestId and a valid status (approved|declined) required', 400);
      }
      const resolved = await resolveGuestRequest({
        id: requestId,
        organizationId: ctx.orgId,
        status,
        resolvedBy: user.id,
      });
      if (!resolved) {
        return jsonError(req, 'Request not found or already resolved', 404);
      }
      await logActivity({
        action: 'guest_request.resolved',
        organizationId: ctx.orgId,
        propertyId: resolved.property_id,
        actor: { actorType: 'team_member', source: 'dashboard', userId: user.id },
        targetId: resolved.id,
        metadata: { status },
      });
      return jsonSuccess(req, { request: resolved });
    }

    await markConversationRead(ctx.orgId, conversationId);
    return jsonSuccess(req, { read: true });
  }

  if (req.method === 'PATCH') {
    const blocked = await metaReplyFeatureBlock(req, conv, user);
    if (blocked) return blocked;
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
