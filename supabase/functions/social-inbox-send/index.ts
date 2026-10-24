/**
 * Send a reply to a conversation.
 */

import {
  isWithinHumanAgentWindowFromInbound,
  isWithinMessagingWindowFromInbound,
} from '../_shared/socialInboxAiService.ts';
import { friendlyMetaSendError } from '../_shared/metaInboxSendErrors.ts';
import { getPageAccessToken, sendMetaMessage } from '../_shared/metaInboxGraph.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import {
  conversationAllowedInScope,
  getConversationById,
  insertMessageIfNew,
  updateConversationAfterMessage,
} from '../_shared/socialInboxService.ts';
import { resolveMetaReplyTarget, resolveReplyTarget } from '../_shared/chatMessageLifecycle.ts';
import { maybeNotifyGuestOfHostWebReply } from '../_shared/guestChatEmail.ts';
import {
  assertGuestWebMessagePayload,
  buildMessagePreview,
  parseGuestWebChatAttachments,
} from '../_shared/guestChatAttachments.ts';
import { buildActorContext, logActivity } from '../_shared/activityLog.ts';
import {
  MAX_META_TEMPLATE_TEXT_CHARS,
  renderChatTemplateForChat,
} from '../_shared/chatTemplateMessage.ts';
import type { SocialChannelConnectionRow } from '../_shared/socialInboxTypes.ts';
import { resolveInboxAccess } from '../_shared/inboxAccess.ts';
import { resolveMetaConnectionIdsForScope } from '../_shared/metaInboxScope.ts';
import type { SocialConversationRow } from '../_shared/socialInboxTypes.ts';
import { withIdempotency } from '../_shared/idempotency.ts';
import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

// `withIdempotency`: an `Idempotency-Key` (PWA offline-outbox replay) makes a
// queued reply send at most once — the Meta send path is not otherwise replay-safe.
serveAuthenticated(
  'social-inbox-send',
  withIdempotency(async (req, user) => {
    if (req.method !== 'POST') {
      return jsonError(req, 'Method not allowed', 405);
    }

    const body = await readJsonBody(req);
    const ctx = await resolveInboxAccess(req, 'reply', body as Record<string, unknown>);
    const conversationId = String(body.conversationId ?? '').trim();
    const useHumanAgentTag = body.useHumanAgentTag === true;
    const replyToMessageId = String(body.replyToMessageId ?? body.reply_to_message_id ?? '').trim();
    const attachments = parseGuestWebChatAttachments(body.attachments);
    const templateKey = String(body.templateKey ?? '').trim();
    const bookingId = String(body.bookingId ?? body.booking_id ?? '').trim() || null;

    if (!conversationId) {
      return jsonError(req, 'conversationId required', 400);
    }

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

    const now = new Date().toISOString();

    const templatePropertyId = conv.property_id ?? ctx.propertyId;
    let template: Awaited<ReturnType<typeof renderChatTemplateForChat>> | null = null;
    if (templateKey) {
      if (!templatePropertyId) {
        return jsonError(req, 'Template requires a property', 400);
      }
      if (attachments.length > 0) {
        return jsonError(req, 'A template message cannot include attachments', 400);
      }
      if (conv.platform !== 'web' && conv.platform !== 'facebook' && conv.platform !== 'instagram') {
        return jsonError(req, 'Templates are not available on this channel', 400);
      }
      try {
        template = await renderChatTemplateForChat({
          propertyId: templatePropertyId,
          templateKey,
          conversation: conv,
          bookingId,
        });
      } catch (e) {
        return jsonError(req, (e as Error).message, 400);
      }
    }

    const text = template ? template.plainText : String(body.text ?? '').trim();

    const logChatTemplateSent = async (
      propertyId: string,
      rendered: NonNullable<typeof template>
    ) => {
      await logActivity({
        action: 'inbox.chat_template_sent',
        organizationId: ctx.org.id,
        propertyId,
        actor: buildActorContext('dashboard', { authUser: user }, req),
        targetId: conv.id,
        targetLabel: rendered.source.name,
        metadata: {
          template_key: rendered.source.templateKey,
          template_name: rendered.source.name,
          template_category: rendered.source.category,
          conversation_id: conv.id,
          platform: conv.platform,
        },
      });
    };

    if (conv.platform === 'web') {
      try {
        assertGuestWebMessagePayload(text, attachments);
      } catch (e) {
        return jsonError(req, (e as Error).message, 400);
      }

      const externalId = `web:${crypto.randomUUID()}`;
      const preview = template
        ? template.source.name.slice(0, 500)
        : buildMessagePreview(text, attachments);
      let replyFields: { reply_to_message_id?: string; reply_preview_text?: string } = {};
      if (replyToMessageId) {
        replyFields = await resolveReplyTarget(conv.id, replyToMessageId);
      }
      await insertMessageIfNew({
        organization_id: ctx.org.id,
        conversation_id: conv.id,
        direction: 'outbound',
        external_message_id: externalId,
        body_text: text || null,
        attachments,
        sent_at: now,
        delivery_status: 'sent',
        sent_by_user_id: user.id,
        is_ai_generated: false,
        ...(template
          ? { message_kind: 'template', template_snapshot: template.snapshot }
          : {}),
        ...replyFields,
      });
      await updateConversationAfterMessage(conv.id, {
        subject_preview: preview,
        last_message_at: now,
        reply_status: 'replied',
        unread_delta: 0,
        guest_unread_delta: 1,
      });
      if (template) await logChatTemplateSent(templatePropertyId!, template);
      void maybeNotifyGuestOfHostWebReply({
        orgId: ctx.org.id,
        conversationId: conv.id,
        externalMessageId: externalId,
      }).catch((err) => console.warn('[social-inbox-send] guest notify:', err));
      return jsonSuccess(req, { sent: true });
    }

    if (!text) {
      return jsonError(req, 'conversationId and text required', 400);
    }
    if (template && text.length > MAX_META_TEMPLATE_TEXT_CHARS) {
      return jsonError(
        req,
        `This template is too long for a Meta message (max ${MAX_META_TEMPLATE_TEXT_CHARS} characters)`,
        400
      );
    }

    const sb = createServiceClient();
    const { data: conn } = await sb
      .from('social_channel_connections')
      .select('*')
      .eq('id', conv.connection_id)
      .maybeSingle();
    if (conn?.status !== 'connected') {
      return jsonError(req, 'This channel is disconnected — reconnect Meta to reply', 400);
    }
    if (!conn.encrypted_access_token || !conn.meta_page_id) {
      return jsonError(req, 'Channel not connected', 400);
    }

    const connection = conn as SocialChannelConnectionRow;
    const token = await getPageAccessToken(connection);

    try {
      if (conv.conversation_type === 'dm') {
        const withinStandardWindow = isWithinMessagingWindowFromInbound(conv.last_inbound_at);
        const withinHumanAgentWindow = isWithinHumanAgentWindowFromInbound(conv.last_inbound_at);
        if (!withinStandardWindow && !(useHumanAgentTag && withinHumanAgentWindow)) {
          return jsonError(req, 'Reply window closed — guest must message again', 400);
        }

        let replyFields: { reply_to_message_id?: string; reply_preview_text?: string } = {};
        let replyToMid: string | undefined;
        if (replyToMessageId) {
          const resolved = await resolveMetaReplyTarget(conv.id, replyToMessageId);
          replyFields = {
            reply_to_message_id: resolved.reply_to_message_id,
            reply_preview_text: resolved.reply_preview_text,
          };
          replyToMid = resolved.replyToMid;
        }

        const result = await sendMetaMessage({
          pageId: connection.meta_page_id,
          pageAccessToken: token,
          recipientId: conv.external_participant_id ?? '',
          text,
          platform: conv.platform,
          replyToMid,
          tag: !withinStandardWindow && useHumanAgentTag ? 'HUMAN_AGENT' : undefined,
        });
        await insertMessageIfNew({
          organization_id: ctx.org.id,
          conversation_id: conv.id,
          direction: 'outbound',
          external_message_id: result.message_id,
          body_text: text,
          attachments: [],
          sent_at: now,
          delivery_status: 'sent',
          message_tag: !withinStandardWindow && useHumanAgentTag ? 'human_agent' : null,
          sent_by_user_id: user.id,
          is_ai_generated: false,
          ...replyFields,
        });
        if (template) await logChatTemplateSent(templatePropertyId!, template);
      } else {
        return jsonError(req, 'This conversation type is no longer supported', 400);
      }
    } catch (e) {
      return jsonError(req, friendlyMetaSendError((e as Error).message), 502);
    }

    await updateConversationAfterMessage(conv.id, {
      subject_preview: (template ? template.source.name : text).slice(0, 500),
      last_message_at: now,
      reply_status: 'replied',
      unread_delta: 0,
    });

    return jsonSuccess(req, { sent: true });
  })
);
