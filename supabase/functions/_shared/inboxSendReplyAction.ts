/**
 * Shared inbox reply send for the AI dashboard assistant's `propose_send_inbox_reply` tool
 * and any other callers that need the same scoped, guest-facing send path.
 */

import {
  isWithinHumanAgentWindowFromInbound,
  isWithinMessagingWindowFromInbound,
} from './socialInboxAiService.ts';
import { friendlyMetaSendError } from './metaInboxSendErrors.ts';
import { getPageAccessToken, sendMetaMessage } from './metaInboxGraph.ts';
import { createServiceClient } from './orgAuth.ts';
import {
  conversationAllowedInScope,
  getConversationById,
  insertMessageIfNew,
  updateConversationAfterMessage,
} from './socialInboxService.ts';
import { maybeNotifyGuestOfHostWebReply } from './guestChatEmail.ts';
import { assertGuestWebMessagePayload, buildMessagePreview } from './guestChatAttachments.ts';
import type { NormalizedInboxAttachment } from './inboxAttachments.ts';
import type { SocialChannelConnectionRow, SocialConversationRow } from './socialInboxTypes.ts';
import { assertFeatureAvailable, FeatureUnavailableError } from './featureAvailability.ts';
import type { InboxAccessContext } from './inboxAccess.ts';
import type { AuthenticatedUser } from './orgAuth.ts';

export class InboxSendReplyError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Loads + scope-checks the target conversation; throws InboxSendReplyError (404-equivalent) if out of scope. */
export async function loadInboxConversationInScope(
  ctx: InboxAccessContext,
  conversationId: string,
  metaIds: Set<string>
): Promise<SocialConversationRow> {
  const conv = await getConversationById(ctx.orgId, conversationId);
  if (!conv) throw new InboxSendReplyError('Conversation not found', 404);
  if (
    !conversationAllowedInScope(conv, {
      propertyId: ctx.propertyId,
      parkingId: ctx.parkingId,
      metaIds,
    })
  ) {
    throw new InboxSendReplyError('Conversation not found', 404);
  }
  return conv;
}

export type SendInboxReplyOptions = {
  useHumanAgentTag?: boolean;
  attachments?: NormalizedInboxAttachment[];
  /** When set, super-admin bypass on `inbox.meta.reply` may apply. */
  actor?: AuthenticatedUser;
};

/** Sends a reply — web insert+notify (text and/or attachments), or Meta DM text only. */
export async function sendInboxReply(
  ctx: InboxAccessContext,
  conv: SocialConversationRow,
  userId: string,
  text: string,
  opts: SendInboxReplyOptions = {}
): Promise<{ sent: true }> {
  const trimmed = text.trim();
  const attachments = opts.attachments ?? [];

  if (attachments.length > 0 && conv.platform !== 'web') {
    throw new InboxSendReplyError(
      'Attachments are only supported for website chat — send text only on Messenger or Instagram'
    );
  }

  const now = new Date().toISOString();

  if (conv.platform === 'web') {
    try {
      assertGuestWebMessagePayload(trimmed, attachments);
    } catch (e) {
      throw new InboxSendReplyError(e instanceof Error ? e.message : String(e));
    }

    const externalId = `web:${crypto.randomUUID()}`;
    const preview = buildMessagePreview(trimmed, attachments);
    await insertMessageIfNew({
      organization_id: ctx.org.id,
      conversation_id: conv.id,
      direction: 'outbound',
      external_message_id: externalId,
      body_text: trimmed || null,
      attachments,
      sent_at: now,
      delivery_status: 'sent',
      sent_by_user_id: userId,
      is_ai_generated: false,
    });
    await updateConversationAfterMessage(conv.id, {
      subject_preview: preview,
      last_message_at: now,
      reply_status: 'replied',
      unread_delta: 0,
      guest_unread_delta: 1,
    });
    void maybeNotifyGuestOfHostWebReply({
      orgId: ctx.org.id,
      conversationId: conv.id,
      externalMessageId: externalId,
    }).catch((err) => console.warn('[inboxSendReplyAction] guest notify:', err));
    return { sent: true };
  }

  if (!trimmed) throw new InboxSendReplyError('text is required');

  const sb = createServiceClient();
  const { data: conn } = await sb
    .from('social_channel_connections')
    .select('*')
    .eq('id', conv.connection_id)
    .maybeSingle();
  if (conn?.status !== 'connected') {
    throw new InboxSendReplyError('This channel is disconnected — reconnect Meta to reply');
  }
  if (!conn?.encrypted_access_token || !conn.meta_page_id) {
    throw new InboxSendReplyError('Channel not connected');
  }
  const connection = conn as SocialChannelConnectionRow;
  const token = await getPageAccessToken(connection);

  try {
    try {
      await assertFeatureAvailable('inbox.meta.reply', { user: opts.actor });
    } catch (err) {
      if (err instanceof FeatureUnavailableError) {
        throw new InboxSendReplyError(err.message, 503);
      }
      throw err;
    }

    if (conv.conversation_type === 'dm') {
      const withinStandardWindow = isWithinMessagingWindowFromInbound(conv.last_inbound_at);
      const withinHumanAgentWindow = isWithinHumanAgentWindowFromInbound(conv.last_inbound_at);
      if (!withinStandardWindow && !(opts.useHumanAgentTag === true && withinHumanAgentWindow)) {
        throw new InboxSendReplyError('Reply window closed — guest must message again');
      }
      const result = await sendMetaMessage({
        pageId: connection.meta_page_id,
        pageAccessToken: token,
        recipientId: conv.external_participant_id ?? '',
        text: trimmed,
        platform: conv.platform,
        tag: !withinStandardWindow && opts.useHumanAgentTag === true ? 'HUMAN_AGENT' : undefined,
      });
      if (!result.ok) {
        throw new InboxSendReplyError(result.message, 503);
      }
      await insertMessageIfNew({
        organization_id: ctx.org.id,
        conversation_id: conv.id,
        direction: 'outbound',
        external_message_id: result.message_id,
        body_text: trimmed,
        attachments: [],
        sent_at: now,
        delivery_status: 'sent',
        message_tag: !withinStandardWindow && opts.useHumanAgentTag === true ? 'human_agent' : null,
        sent_by_user_id: userId,
        is_ai_generated: false,
      });
    } else {
      throw new InboxSendReplyError('This conversation type is no longer supported');
    }
  } catch (err) {
    if (err instanceof InboxSendReplyError) throw err;
    throw new InboxSendReplyError(
      friendlyMetaSendError(err instanceof Error ? err.message : String(err)),
      502
    );
  }

  await updateConversationAfterMessage(conv.id, {
    subject_preview: trimmed.slice(0, 500),
    last_message_at: now,
    reply_status: 'replied',
    unread_delta: 0,
  });

  return { sent: true };
}

/** @deprecated Use sendInboxReply — kept for existing imports. */
export async function sendInboxTextReply(
  ctx: InboxAccessContext,
  conv: SocialConversationRow,
  userId: string,
  text: string,
  opts: { useHumanAgentTag?: boolean } = {}
): Promise<{ sent: true }> {
  return sendInboxReply(ctx, conv, userId, text, opts);
}
