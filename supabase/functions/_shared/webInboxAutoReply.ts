/**
 * Optional AI auto-send after inbound guest web chat messages.
 */

import { suggestInboxReply } from './socialInboxAiService.ts';
import {
  consumeAutoReplyBudget,
  isAutoReplyEntitled,
  isSendableAutoReply,
  isWithinAutoReplyCooldown,
  loadAutoReplySettings,
} from './inboxAutoReplyPolicy.ts';
import { socialInboxDb } from './socialInboxDb.ts';
import { insertMessageIfNew, listMessages, updateConversationAfterMessage } from './socialInboxService.ts';
import { maybeNotifyGuestOfHostWebReply } from './guestChatEmail.ts';
import { buildWebMessageExternalId } from './webGuestChatIds.ts';

async function loadWebPropertyContext(propertyId: string | null): Promise<{
  propertyName: string | null;
  inquiryCheckIn: string | null;
  inquiryCheckOut: string | null;
}> {
  if (!propertyId) {
    return { propertyName: null, inquiryCheckIn: null, inquiryCheckOut: null };
  }
  const sb = socialInboxDb();
  const { data } = await sb.from('properties').select('name').eq('id', propertyId).maybeSingle();
  return {
    propertyName: (data?.name as string | undefined) ?? null,
    inquiryCheckIn: null,
    inquiryCheckOut: null,
  };
}

export async function maybeAutoReplyToWebInbound(
  orgId: string,
  conversationId: string,
  inboundExternalMessageId: string
): Promise<void> {
  const settings = await loadAutoReplySettings(orgId, 'web');
  if (!settings) return;

  const sb = socialInboxDb();
  const { data: conv } = await sb
    .from('social_conversations')
    .select('*')
    .eq('id', conversationId)
    .eq('organization_id', orgId)
    .eq('platform', 'web')
    .maybeSingle();
  if (!conv || conv.conversation_type !== 'dm') return;
  if (!(await isAutoReplyEntitled(orgId, (conv.property_id as string | null) ?? null))) return;

  const { data: inboundRow } = await sb
    .from('social_messages')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('external_message_id', inboundExternalMessageId)
    .eq('direction', 'inbound')
    .maybeSingle();
  if (!inboundRow) return;

  const { messages } = await listMessages(orgId, conversationId, { limit: 20 });
  if (isWithinAutoReplyCooldown(messages)) return;
  if (!(await consumeAutoReplyBudget(conversationId))) return;

  const propertyCtx = await loadWebPropertyContext(conv.property_id as string | null);

  const reply = await suggestInboxReply({
    orgId,
    platform: 'web',
    conversationType: conv.conversation_type,
    participantName: conv.participant_name,
    propertyId: conv.property_id as string | null,
    propertyName: propertyCtx.propertyName,
    inquiryCheckIn: (conv.inquiry_check_in as string | null) ?? null,
    inquiryCheckOut: (conv.inquiry_check_out as string | null) ?? null,
    messages: messages.map((m) => ({
      direction: m.direction,
      body: m.body_text,
      sentAt: m.sent_at,
    })),
    systemPromptOverride: settings.ai_system_prompt,
  });
  if (!isSendableAutoReply(reply)) return;
  const draft = reply.suggestion;

  const now = new Date().toISOString();
  const externalId = buildWebMessageExternalId();
  await insertMessageIfNew({
    organization_id: orgId,
    conversation_id: conversationId,
    direction: 'outbound',
    external_message_id: externalId,
    body_text: draft,
    attachments: [],
    sent_at: now,
    delivery_status: 'sent',
    sent_by_user_id: null,
    is_ai_generated: true,
  });
  await updateConversationAfterMessage(conversationId, {
    subject_preview: draft.slice(0, 500),
    last_message_at: now,
    reply_status: 'replied',
    guest_unread_delta: 1,
  });
  void maybeNotifyGuestOfHostWebReply({
    orgId,
    conversationId,
    externalMessageId: externalId,
  }).catch((err) => console.warn('[webInboxAutoReply] guest notify:', err));
}
