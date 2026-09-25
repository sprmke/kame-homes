/**
 * Optional AI auto-send after inbound Meta DM webhooks.
 */

import { getPageAccessToken, sendMetaMessage } from './metaInboxGraph.ts';
import {
  consumeAutoReplyBudget,
  isAutoReplyEntitled,
  isSendableAutoReply,
  isWithinAutoReplyCooldown,
  loadAutoReplySettings,
} from './inboxAutoReplyPolicy.ts';
import { isWithinMessagingWindowFromInbound, suggestInboxReply } from './socialInboxAiService.ts';
import { socialInboxDb } from './socialInboxDb.ts';
import { getConversationByExternalThread, insertMessageIfNew, listMessages, updateConversationAfterMessage } from './socialInboxService.ts';
import type { SocialPlatform } from './socialInboxTypes.ts';

export async function maybeAutoReplyToInboundDm(
  orgId: string,
  threadId: string,
  platform: Extract<SocialPlatform, 'facebook' | 'instagram'>,
  inboundExternalMessageId: string
): Promise<void> {
  const settings = await loadAutoReplySettings(orgId, platform);
  if (!settings) return;

  const conv = await getConversationByExternalThread(orgId, platform, threadId);
  if (!conv || conv.conversation_type !== 'dm') return;
  if (!isWithinMessagingWindowFromInbound(conv.last_inbound_at)) return;
  if (!(await isAutoReplyEntitled(orgId, (conv.property_id as string | null) ?? null))) return;

  const { messages } = await listMessages(orgId, conv.id, { limit: 20 });
  const latest = messages[messages.length - 1];
  if (!latest || latest.external_message_id !== inboundExternalMessageId) return;
  if (isWithinAutoReplyCooldown(messages)) return;

  const sb = socialInboxDb();
  const { data: connRow } = await sb
    .from('social_channel_connections')
    .select('*')
    .eq('id', conv.connection_id)
    .maybeSingle();
  if (!connRow?.meta_page_id || !connRow.encrypted_access_token) return;

  if (!(await consumeAutoReplyBudget(conv.id))) return;

  const reply = await suggestInboxReply({
    orgId,
    platform,
    conversationType: conv.conversation_type,
    participantName: conv.participant_name,
    propertyId: (conv.property_id as string | null) ?? null,
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

  const token = await getPageAccessToken(connRow as never);
  const result = await sendMetaMessage({
    pageId: connRow.meta_page_id as string,
    pageAccessToken: token,
    recipientId: conv.external_participant_id ?? '',
    text: draft,
    platform,
  });

  const now = new Date().toISOString();
  await insertMessageIfNew({
    organization_id: orgId,
    conversation_id: conv.id,
    direction: 'outbound',
    external_message_id: result.message_id,
    body_text: draft,
    attachments: [],
    sent_at: now,
    delivery_status: 'sent',
    sent_by_user_id: null,
    is_ai_generated: true,
  });
  await updateConversationAfterMessage(conv.id, {
    subject_preview: draft.slice(0, 500),
    last_message_at: now,
    reply_status: 'replied',
  });
}
