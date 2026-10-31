/**
 * Process Meta webhook payloads into social_conversations / social_messages.
 */

import { metaMessagingWindowExpiry, normalizeMetaWebhookTimestamp } from './metaTimestamp.ts';
import {
  fetchMetaMessengerParticipantProfile,
  formatMetaParticipantDisplayName,
  getPageAccessToken,
} from './metaInboxGraph.ts';
import {
  createOrCoalesceNotification,
  inboxNotificationParticipantLabel,
} from './notificationService.ts';
import { inboxNotificationMetadata } from './notificationEnrichment.ts';
import {
  buildDmThreadId,
  getConnectionForMetaWebhook,
  getConversationByExternalThread,
  insertMessageIfNew,
  migrateLegacyDmThreadId,
  recordWebhookEvent,
  updateConversationAfterMessage,
  upsertConversation,
} from './socialInboxService.ts';
import type { SocialConversationRow, SocialPlatform } from './socialInboxTypes.ts';

type MetaMessagingEvent = {
  sender?: { id: string; username?: string; name?: string };
  recipient?: { id: string };
  timestamp?: number;
  message?: {
    mid: string;
    text?: string;
    attachments?: unknown[];
    is_echo?: boolean;
  };
};

export async function handleMetaMessagingWebhook(
  pageId: string,
  event: MetaMessagingEvent,
  platform: SocialPlatform
): Promise<void> {
  const eventId = event.message?.mid;
  if (!eventId) return;
  if (!(await recordWebhookEvent(eventId))) return;

  const connection = await getConnectionForMetaWebhook(pageId, platform);
  if (!connection?.encrypted_access_token) return;

  const orgId = connection.organization_id;
  const isEcho = event.message?.is_echo === true;
  const senderId = event.sender?.id ?? '';
  const isFromPage = isEcho || senderId === pageId;
  const guestId = isFromPage ? event.recipient?.id : senderId;
  const sentAt = event.timestamp
    ? normalizeMetaWebhookTimestamp(event.timestamp)
    : new Date().toISOString();
  const text = event.message?.text?.trim() ?? '';
  const preview = text || '(attachment)';

  const threadId = buildDmThreadId(platform, guestId ?? 'unknown');
  if (guestId) {
    await migrateLegacyDmThreadId(orgId, platform, guestId, threadId);
  }

  const existing = await getConversationByExternalThread(orgId, platform, threadId);
  const identityPatch: {
    participant_name?: string;
    participant_avatar_url?: string;
  } = {};
  const webhookName = formatMetaParticipantDisplayName({
    name: event.sender?.name,
    username: event.sender?.username,
  });
  if (!existing?.participant_name?.trim() && webhookName && !isFromPage) {
    identityPatch.participant_name = webhookName;
  }
  if (
    !existing?.participant_name?.trim() &&
    !identityPatch.participant_name &&
    guestId &&
    guestId !== 'unknown'
  ) {
    try {
      const token = await getPageAccessToken(connection);
      const profile = await fetchMetaMessengerParticipantProfile(guestId, token, platform);
      if (profile.name) identityPatch.participant_name = profile.name;
      if (profile.profilePic) identityPatch.participant_avatar_url = profile.profilePic;
    } catch (e) {
      console.warn('[handleMetaMessagingWebhook] profile lookup:', (e as Error).message);
    }
  }

  const conv = await upsertConversation({
    organization_id: orgId,
    connection_id: connection.id,
    platform,
    external_thread_id: threadId,
    conversation_type: 'dm',
    external_participant_id: guestId ?? null,
    subject_preview: preview.slice(0, 500),
    last_message_at: sentAt,
    last_inbound_at: isFromPage ? undefined : sentAt,
    unread_count: 0,
    reply_status: isFromPage ? 'replied' : 'pending',
    messaging_window_expires_at: isFromPage ? undefined : metaMessagingWindowExpiry(sentAt),
    ...identityPatch,
  });

  await insertMessageIfNew({
    organization_id: orgId,
    conversation_id: conv.id,
    direction: isFromPage ? 'outbound' : 'inbound',
    external_message_id: eventId,
    body_text: text || null,
    attachments: (event.message?.attachments as unknown[]) ?? [],
    sent_at: sentAt,
    delivery_status: null,
    sent_by_user_id: null,
    is_ai_generated: false,
  });

  await updateConversationAfterMessage(conv.id, {
    subject_preview: preview.slice(0, 500),
    last_message_at: sentAt,
    last_inbound_at: isFromPage ? undefined : sentAt,
    unread_delta: isFromPage ? 0 : 1,
    reply_status: isFromPage ? 'replied' : 'pending',
    messaging_window_expires_at: isFromPage ? undefined : metaMessagingWindowExpiry(sentAt),
  });

  if (!isFromPage) {
    try {
      const { notifyTelegramChatInbound } = await import('./telegramChat.ts');
      await notifyTelegramChatInbound({
        conversation: conv,
        text: text || null,
        attachments: [],
        sentAt,
      });
    } catch (e) {
      console.warn('[handleMetaMessagingWebhook] telegram notify:', e);
    }
    try {
      const participantLabel = inboxNotificationParticipantLabel(
        conv.participant_name,
        conv.conversation_type
      );
      await createOrCoalesceNotification({
        organizationId: orgId,
        propertyId: conv.property_id ?? null,
        parkingId: conv.parking_id ?? null,
        type: 'inbox_new_message',
        title: participantLabel,
        body: preview.slice(0, 200),
        conversationId: conv.id,
        metadata: inboxNotificationMetadata(conv),
        dedupeKey: `${conv.id}:inbox_new_message`,
      });
    } catch (e) {
      console.warn('[handleMetaMessagingWebhook] notification create:', e);
    }
  }
}

export async function handleMetaReadReceipt(
  pageId: string,
  senderId: string,
  platform: SocialPlatform
): Promise<void> {
  const connection = await getConnectionForMetaWebhook(pageId, platform);
  if (!connection) return;
  const threadId = buildDmThreadId(platform, senderId);
  const sb = (await import('./socialInboxService.ts')).socialInboxDb();
  await sb
    .from('social_conversations')
    .update({ unread_count: 0, updated_at: new Date().toISOString() })
    .eq('organization_id', connection.organization_id)
    .eq('external_thread_id', threadId);
}
