/**
 * Read receipts, edit rules, reply threading for social inbox + web guest chat.
 */

import { socialInboxDb } from './socialInboxDb.ts';
import type { SocialMessageRow } from './socialInboxTypes.ts';

export const REPLY_PREVIEW_MAX = 200;

export function buildReplyPreview(body: string | null | undefined): string {
  const trimmed = (body ?? '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return '(attachment)';
  return trimmed.length > REPLY_PREVIEW_MAX ? `${trimmed.slice(0, REPLY_PREVIEW_MAX)}…` : trimmed;
}

export async function loadMessageInConversation(
  conversationId: string,
  messageId: string
): Promise<SocialMessageRow | null> {
  const sb = socialInboxDb();
  const { data, error } = await sb
    .from('social_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('id', messageId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SocialMessageRow | null) ?? null;
}

async function hasReplyAfter(
  conversationId: string,
  afterSentAt: string,
  direction: 'inbound' | 'outbound'
): Promise<boolean> {
  const sb = socialInboxDb();
  const { count, error } = await sb
    .from('social_messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conversationId)
    .eq('direction', direction)
    .gt('sent_at', afterSentAt)
    .is('deleted_at', null);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

export async function markGuestWebConversationRead(
  userId: string,
  conversationId: string
): Promise<void> {
  const sb = socialInboxDb();
  const now = new Date().toISOString();

  const { data: conv, error: convError } = await sb
    .from('social_conversations')
    .select('id, guest_user_id, external_participant_id, platform')
    .eq('id', conversationId)
    .eq('platform', 'web')
    .maybeSingle();
  if (convError) throw new Error(convError.message);
  if (!conv) throw new Error('Conversation not found');

  const owns =
    conv.guest_user_id === userId ||
    (conv.external_participant_id === userId && !conv.guest_user_id);
  if (!owns) throw new Error('Conversation not found');

  await sb
    .from('social_messages')
    .update({ read_at: now, delivery_status: 'read' })
    .eq('conversation_id', conversationId)
    .eq('direction', 'outbound')
    .is('read_at', null)
    .is('deleted_at', null);

  await sb
    .from('social_conversations')
    .update({
      guest_last_read_at: now,
      guest_unread_count: 0,
      updated_at: now,
    })
    .eq('id', conversationId);
}

export async function markHostConversationRead(
  orgId: string,
  conversationId: string
): Promise<void> {
  const sb = socialInboxDb();
  const now = new Date().toISOString();

  await sb
    .from('social_messages')
    .update({ read_at: now, delivery_status: 'read' })
    .eq('organization_id', orgId)
    .eq('conversation_id', conversationId)
    .eq('direction', 'inbound')
    .is('read_at', null)
    .is('deleted_at', null);

  await sb
    .from('social_conversations')
    .update({
      unread_count: 0,
      host_last_read_at: now,
      updated_at: now,
    })
    .eq('organization_id', orgId)
    .eq('id', conversationId);
}

export async function assertGuestCanEditMessage(
  userId: string,
  conversationId: string,
  messageId: string
): Promise<SocialMessageRow> {
  const sb = socialInboxDb();
  const { data: conv, error: convError } = await sb
    .from('social_conversations')
    .select('id, guest_user_id, external_participant_id, platform')
    .eq('id', conversationId)
    .eq('platform', 'web')
    .maybeSingle();
  if (convError) throw new Error(convError.message);
  if (!conv || (conv.guest_user_id !== userId && conv.external_participant_id !== userId)) {
    throw new Error('Conversation not found');
  }

  const message = await loadMessageInConversation(conversationId, messageId);
  if (!message || message.deleted_at) throw new Error('Message not found');
  if (message.direction !== 'inbound') throw new Error('Cannot edit this message');
  if (message.sent_by_user_id && message.sent_by_user_id !== userId) {
    throw new Error('Cannot edit this message');
  }
  if (message.read_at) throw new Error('Message already read');
  if (await hasReplyAfter(conversationId, message.sent_at, 'outbound')) {
    throw new Error('Host already replied');
  }
  return message;
}

export async function assertHostCanEditMessage(
  orgId: string,
  conversationId: string,
  messageId: string
): Promise<SocialMessageRow> {
  const sb = socialInboxDb();
  const { data: conv, error: convError } = await sb
    .from('social_conversations')
    .select('id, platform')
    .eq('id', conversationId)
    .eq('organization_id', orgId)
    .maybeSingle();
  if (convError) throw new Error(convError.message);
  if (!conv) throw new Error('Conversation not found');

  const message = await loadMessageInConversation(conversationId, messageId);
  if (!message || message.deleted_at) throw new Error('Message not found');
  if (message.direction !== 'outbound') throw new Error('Cannot edit this message');
  if (message.read_at) throw new Error('Message already read');
  if (await hasReplyAfter(conversationId, message.sent_at, 'inbound')) {
    throw new Error('Guest already replied');
  }
  return message;
}

export async function editMessageBody(
  messageId: string,
  text: string,
  opts?: { refreshPreview?: boolean; conversationId?: string }
): Promise<SocialMessageRow> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Message text required');

  const sb = socialInboxDb();
  const now = new Date().toISOString();

  const { data, error } = await sb
    .from('social_messages')
    .update({
      body_text: trimmed,
      edited_at: now,
    })
    .eq('id', messageId)
    .select('*')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Message not found');

  if (opts?.refreshPreview && opts.conversationId) {
    const { data: latest } = await sb
      .from('social_messages')
      .select('id, body_text, sent_at')
      .eq('conversation_id', opts.conversationId)
      .is('deleted_at', null)
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latest?.id === messageId) {
      await sb
        .from('social_conversations')
        .update({
          subject_preview: trimmed.slice(0, 500),
          updated_at: now,
        })
        .eq('id', opts.conversationId);
    }
  }

  return data as SocialMessageRow;
}

export async function resolveReplyTarget(
  conversationId: string,
  replyToMessageId: string
): Promise<{ reply_to_message_id: string; reply_preview_text: string }> {
  const target = await loadMessageInConversation(conversationId, replyToMessageId);
  if (!target) throw new Error('Reply target not found');
  if (target.deleted_at) {
    return {
      reply_to_message_id: target.id,
      reply_preview_text: '(unsent message)',
    };
  }
  return {
    reply_to_message_id: target.id,
    reply_preview_text: buildReplyPreview(target.body_text),
  };
}

/** Resolve DB reply fields + Meta Graph `reply_to.mid` for Messenger / IG DMs. */
export async function resolveMetaReplyTarget(
  conversationId: string,
  replyToMessageId: string
): Promise<{
  reply_to_message_id: string;
  reply_preview_text: string;
  replyToMid: string;
}> {
  const target = await loadMessageInConversation(conversationId, replyToMessageId);
  if (!target) throw new Error('Reply target not found');

  const mid = target.external_message_id?.trim();
  if (!mid || mid.startsWith('web:')) {
    throw new Error('Reply target not found');
  }

  return {
    reply_to_message_id: target.id,
    reply_preview_text: buildReplyPreview(target.body_text),
    replyToMid: mid,
  };
}

async function refreshConversationSubjectPreview(conversationId: string): Promise<void> {
  const sb = socialInboxDb();
  const now = new Date().toISOString();
  const { data: latest } = await sb
    .from('social_messages')
    .select('body_text')
    .eq('conversation_id', conversationId)
    .is('deleted_at', null)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const preview = latest?.body_text?.trim().slice(0, 500) ?? '';
  await sb
    .from('social_conversations')
    .update({
      subject_preview: preview || null,
      updated_at: now,
    })
    .eq('id', conversationId);
}

export async function assertGuestCanUnsendMessage(
  userId: string,
  conversationId: string,
  messageId: string
): Promise<SocialMessageRow> {
  return assertGuestCanEditMessage(userId, conversationId, messageId);
}

export async function assertHostCanUnsendMessage(
  orgId: string,
  conversationId: string,
  messageId: string
): Promise<SocialMessageRow> {
  return assertHostCanEditMessage(orgId, conversationId, messageId);
}

export async function softDeleteMessage(
  messageId: string,
  opts?: { conversationId?: string }
): Promise<void> {
  const sb = socialInboxDb();
  const now = new Date().toISOString();

  const { data, error } = await sb
    .from('social_messages')
    .update({
      deleted_at: now,
      body_text: null,
      attachments: [],
    })
    .eq('id', messageId)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Message not found');

  if (opts?.conversationId) {
    await refreshConversationSubjectPreview(opts.conversationId);
  }
}
