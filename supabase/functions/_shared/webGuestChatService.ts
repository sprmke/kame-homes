/**
 * Guest ↔ host web chat — uses social inbox tables with platform = web.
 */

import { loadAuthUserProfile } from './authUserProfile.ts';
import { loadPublicParkingBySlug } from './parkingScope.ts';
import { loadPublicPropertyBySlug } from './publicPropertyService.ts';
import { createServiceClient } from './orgAuth.ts';
import { socialInboxDb, upsertChannelConnection } from './socialInboxDb.ts';
import {
  insertMessageIfNew,
  updateConversationAfterMessage,
  upsertConversation,
} from './socialInboxService.ts';
import { runAfterResponse } from './backgroundTask.ts';
import { maybeAutoReplyToWebInbound } from './webInboxAutoReply.ts';
import {
  createOrCoalesceNotification,
  inboxNotificationParticipantLabel,
} from './notificationService.ts';
import { inboxNotificationMetadata } from './notificationEnrichment.ts';
import type { AuthenticatedUser } from './orgAuth.ts';
import type { SocialConversationRow, SocialMessageRow } from './socialInboxTypes.ts';

import {
  assertGuestCanEditMessage,
  assertGuestCanUnsendMessage,
  editMessageBody,
  markGuestWebConversationRead,
  resolveReplyTarget,
  softDeleteMessage,
} from './chatMessageLifecycle.ts';

import {
  assertGuestWebMessagePayload,
  buildMessagePreview,
  parseGuestWebChatAttachments,
} from './guestChatAttachments.ts';

import {
  buildParkingWebThreadId,
  buildWebMessageExternalId,
  buildWebThreadId,
} from './webGuestChatIds.ts';
import { resolveGuestStayGuideUrlForProperty } from './guestStayGuide.ts';
import { isVoiceReceptionistAvailableForProperty } from './voiceReceptionistService.ts';

/** YYYY-MM-DD inquiry dates from the guest chat / contact-host flow. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

async function linkGuestWebConversationUser(
  sb: ReturnType<typeof createServiceClient>,
  userId: string
): Promise<void> {
  const { error } = await sb
    .from('social_conversations')
    .update({ guest_user_id: userId })
    .eq('platform', 'web')
    .eq('external_participant_id', userId)
    .is('guest_user_id', null);

  if (error) {
    console.warn('[webGuestChat] link guest_user_id failed:', error.message);
  }
}

export function parseInquiryDates(
  checkInRaw: string,
  checkOutRaw: string
): { checkIn: string; checkOut: string } | null {
  const checkIn = checkInRaw.trim();
  const checkOut = checkOutRaw.trim();
  if (!ISO_DATE.test(checkIn) || !ISO_DATE.test(checkOut)) return null;
  const inDate = new Date(`${checkIn}T00:00:00`);
  const outDate = new Date(`${checkOut}T00:00:00`);
  if (Number.isNaN(inDate.getTime()) || Number.isNaN(outDate.getTime())) return null;
  if (outDate <= inDate) return null;
  return { checkIn, checkOut };
}

export async function ensureWebChannelConnection(orgId: string) {
  return upsertChannelConnection({
    organization_id: orgId,
    platform: 'web',
    external_account_id: orgId,
    display_name: 'Website chat',
    status: 'connected',
  });
}

export type WebChatListingRef = {
  id: string;
  slug: string;
  name: string;
};

export type WebChatStartResult = {
  conversationId: string;
  property?: WebChatListingRef;
  parking?: WebChatListingRef;
  host: {
    organizationName: string;
    ownerName: string;
    ownerAvatarUrl: string | null;
  };
  inquiryCheckIn: string;
  inquiryCheckOut: string;
  replyStatus: 'pending' | 'replied' | 'none';
  voiceReceptionistEnabled: boolean;
  stayGuideUrl: string | null;
};

export type WebChatResumeResult = {
  hasMessages: boolean;
  conversationId: string | null;
  inquiryCheckIn: string | null;
  inquiryCheckOut: string | null;
  replyStatus: 'pending' | 'replied' | 'none' | null;
  property?: WebChatListingRef | null;
  parking?: WebChatListingRef | null;
  host: {
    organizationName: string;
    ownerName: string;
    ownerAvatarUrl: string | null;
  } | null;
  voiceReceptionistEnabled: boolean;
  stayGuideUrl: string | null;
};

export type StartGuestWebChatInput = {
  propertySlug?: string;
  parkingSlug?: string;
  checkInDate: string;
  checkOutDate: string;
};

async function loadParkingWebChatHost(organizationId: string): Promise<WebChatStartResult['host']> {
  const sb = createServiceClient();
  const { data: org, error } = await sb
    .from('organizations')
    .select('name, owner_id')
    .eq('id', organizationId)
    .maybeSingle();
  if (error || !org) {
    throw new Error('Parking not found');
  }
  const profile = await loadAuthUserProfile(sb, org.owner_id as string);
  return {
    organizationName: String(org.name ?? 'Host'),
    ownerName: profile.name.trim() || 'Host',
    ownerAvatarUrl: profile.avatarUrl,
  };
}

export async function resumeGuestWebChat(
  user: AuthenticatedUser,
  input: { propertySlug?: string; parkingSlug?: string }
): Promise<WebChatResumeResult> {
  const empty: WebChatResumeResult = {
    hasMessages: false,
    conversationId: null,
    inquiryCheckIn: null,
    inquiryCheckOut: null,
    replyStatus: null,
    property: null,
    parking: null,
    host: null,
    voiceReceptionistEnabled: false,
    stayGuideUrl: null,
  };

  const propertySlug = input.propertySlug?.trim() ?? '';
  const parkingSlug = input.parkingSlug?.trim() ?? '';
  if ((!propertySlug && !parkingSlug) || (propertySlug && parkingSlug)) {
    return empty;
  }

  const sb = createServiceClient();
  await linkGuestWebConversationUser(sb, user.id);

  if (propertySlug) {
    const property = await loadPublicPropertyBySlug(propertySlug);
    if (!property) return empty;

    const threadId = buildWebThreadId(property.id, user.id);
    const { data: conv, error } = await sb
      .from('social_conversations')
      .select('id, inquiry_check_in, inquiry_check_out, subject_preview, reply_status')
      .eq('platform', 'web')
      .eq('external_thread_id', threadId)
      .maybeSingle();

    if (error) {
      console.error('[webGuestChat] resume lookup failed:', error.message);
      return empty;
    }

    const voiceReceptionistEnabled = await isVoiceReceptionistAvailableForProperty(property.id);
    const stayGuideUrl = await resolveGuestStayGuideUrlForProperty(user, property.id);
    if (!conv?.subject_preview?.trim()) {
      return { ...empty, voiceReceptionistEnabled, stayGuideUrl };
    }

    return {
      hasMessages: true,
      conversationId: conv.id as string,
      inquiryCheckIn: (conv.inquiry_check_in as string | null) ?? null,
      inquiryCheckOut: (conv.inquiry_check_out as string | null) ?? null,
      replyStatus: (conv.reply_status as WebChatResumeResult['replyStatus']) ?? 'none',
      property: {
        id: property.id,
        slug: property.slug,
        name: property.name,
      },
      host: {
        organizationName: property.host.organizationName,
        ownerName: property.host.ownerName,
        ownerAvatarUrl: property.host.ownerAvatarUrl,
      },
      voiceReceptionistEnabled,
      stayGuideUrl,
    };
  }

  const parking = await loadPublicParkingBySlug(parkingSlug);
  if (!parking) return empty;

  const threadId = buildParkingWebThreadId(parking.id, user.id);
  const { data: conv, error } = await sb
    .from('social_conversations')
    .select('id, inquiry_check_in, inquiry_check_out, subject_preview, reply_status')
    .eq('platform', 'web')
    .eq('external_thread_id', threadId)
    .maybeSingle();

  if (error) {
    console.error('[webGuestChat] parking resume lookup failed:', error.message);
    return empty;
  }

  const { data: parkingRow } = await sb
    .from('parkings')
    .select('organization_id')
    .eq('id', parking.id)
    .maybeSingle();
  if (!parkingRow) return empty;

  const host = await loadParkingWebChatHost(parkingRow.organization_id as string);
  if (!conv?.subject_preview?.trim()) {
    return { ...empty, host, voiceReceptionistEnabled: false };
  }

  return {
    hasMessages: true,
    conversationId: conv.id as string,
    inquiryCheckIn: (conv.inquiry_check_in as string | null) ?? null,
    inquiryCheckOut: (conv.inquiry_check_out as string | null) ?? null,
    replyStatus: (conv.reply_status as WebChatResumeResult['replyStatus']) ?? 'none',
    parking: {
      id: parking.id,
      slug: parking.slug,
      name: parking.name,
    },
    host,
    voiceReceptionistEnabled: false,
    stayGuideUrl: null,
  };
}

export async function startGuestWebChat(
  user: AuthenticatedUser,
  input: StartGuestWebChatInput
): Promise<WebChatStartResult> {
  const dates = parseInquiryDates(input.checkInDate, input.checkOutDate);
  if (!dates) {
    throw new Error('Valid checkInDate and checkOutDate (YYYY-MM-DD) required');
  }

  const propertySlug = input.propertySlug?.trim() ?? '';
  const parkingSlug = input.parkingSlug?.trim() ?? '';
  if ((!propertySlug && !parkingSlug) || (propertySlug && parkingSlug)) {
    throw new Error('Exactly one of propertySlug or parkingSlug is required');
  }

  const sb = createServiceClient();
  const profile = await loadAuthUserProfile(sb, user.id);
  const participantName = profile.name.trim() || profile.email.split('@')[0]?.trim() || 'Guest';

  await linkGuestWebConversationUser(sb, user.id);

  if (propertySlug) {
    const property = await loadPublicPropertyBySlug(propertySlug);
    if (!property) {
      throw new Error('Property not found');
    }

    const { data: propertyRow, error: propertyError } = await sb
      .from('properties')
      .select('id, organization_id')
      .eq('id', property.id)
      .maybeSingle();
    if (propertyError || !propertyRow) {
      throw new Error('Property not found');
    }

    const connection = await ensureWebChannelConnection(propertyRow.organization_id);
    const threadId = buildWebThreadId(property.id, user.id);

    const conversation = await upsertConversation({
      organization_id: propertyRow.organization_id,
      connection_id: connection.id,
      platform: 'web',
      conversation_type: 'dm',
      external_thread_id: threadId,
      external_participant_id: user.id,
      participant_name: participantName,
      participant_avatar_url: profile.avatarUrl,
      property_id: property.id,
      guest_user_id: user.id,
      inquiry_check_in: dates.checkIn,
      inquiry_check_out: dates.checkOut,
      last_message_at: new Date().toISOString(),
    });

    const stayGuideUrl = await resolveGuestStayGuideUrlForProperty(user, property.id);

    return {
      conversationId: conversation.id,
      property: {
        id: property.id,
        slug: property.slug,
        name: property.name,
      },
      host: {
        organizationName: property.host.organizationName,
        ownerName: property.host.ownerName,
        ownerAvatarUrl: property.host.ownerAvatarUrl,
      },
      inquiryCheckIn: dates.checkIn,
      inquiryCheckOut: dates.checkOut,
      replyStatus: (conversation.reply_status as WebChatStartResult['replyStatus']) ?? 'none',
      voiceReceptionistEnabled: await isVoiceReceptionistAvailableForProperty(property.id),
      stayGuideUrl,
    };
  }

  const parking = await loadPublicParkingBySlug(parkingSlug);
  if (!parking) {
    throw new Error('Parking not found');
  }

  const { data: parkingRow, error: parkingError } = await sb
    .from('parkings')
    .select('id, organization_id')
    .eq('id', parking.id)
    .maybeSingle();
  if (parkingError || !parkingRow) {
    throw new Error('Parking not found');
  }

  const host = await loadParkingWebChatHost(parkingRow.organization_id as string);
  const connection = await ensureWebChannelConnection(parkingRow.organization_id as string);
  const threadId = buildParkingWebThreadId(parking.id, user.id);

  const conversation = await upsertConversation({
    organization_id: parkingRow.organization_id as string,
    connection_id: connection.id,
    platform: 'web',
    conversation_type: 'dm',
    external_thread_id: threadId,
    external_participant_id: user.id,
    participant_name: participantName,
    participant_avatar_url: profile.avatarUrl,
    parking_id: parking.id,
    guest_user_id: user.id,
    inquiry_check_in: dates.checkIn,
    inquiry_check_out: dates.checkOut,
    last_message_at: new Date().toISOString(),
  });

  return {
    conversationId: conversation.id,
    parking: {
      id: parking.id,
      slug: parking.slug,
      name: parking.name,
    },
    host,
    inquiryCheckIn: dates.checkIn,
    inquiryCheckOut: dates.checkOut,
    replyStatus: (conversation.reply_status as WebChatStartResult['replyStatus']) ?? 'none',
    voiceReceptionistEnabled: false,
    stayGuideUrl: null,
  };
}

export async function assertGuestOwnsWebConversation(
  userId: string,
  conversationId: string
): Promise<SocialConversationRow> {
  const sb = socialInboxDb();
  await linkGuestWebConversationUser(sb, userId);

  const { data, error } = await sb
    .from('social_conversations')
    .select('*')
    .eq('id', conversationId)
    .eq('platform', 'web')
    .or(`guest_user_id.eq.${userId},external_participant_id.eq.${userId}`)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Conversation not found');
  return data as SocialConversationRow;
}

export async function sendGuestWebMessage(
  user: AuthenticatedUser,
  conversationId: string,
  text: string,
  opts?: { replyToMessageId?: string; attachments?: unknown }
): Promise<void> {
  const trimmed = text.trim();
  const attachments = parseGuestWebChatAttachments(opts?.attachments);
  assertGuestWebMessagePayload(trimmed, attachments);

  const conv = await assertGuestOwnsWebConversation(user.id, conversationId);
  const now = new Date().toISOString();
  const externalId = buildWebMessageExternalId();
  const preview = buildMessagePreview(trimmed, attachments);

  let replyFields: { reply_to_message_id?: string; reply_preview_text?: string } = {};
  if (opts?.replyToMessageId?.trim()) {
    replyFields = await resolveReplyTarget(conv.id, opts.replyToMessageId.trim());
  }

  await insertMessageIfNew({
    organization_id: conv.organization_id,
    conversation_id: conv.id,
    direction: 'inbound',
    external_message_id: externalId,
    body_text: trimmed || null,
    attachments,
    sent_at: now,
    delivery_status: 'sent',
    sent_by_user_id: user.id,
    is_ai_generated: false,
    ...replyFields,
  });

  await updateConversationAfterMessage(conv.id, {
    subject_preview: preview,
    last_message_at: now,
    last_inbound_at: now,
    reply_status: 'pending',
    unread_delta: 1,
  });

  // After the response — the guest's send must not wait on the AI model.
  await runAfterResponse('webGuestChat auto-reply', () =>
    maybeAutoReplyToWebInbound(conv.organization_id, conv.id, externalId)
  );

  try {
    const { notifyTelegramChatInbound } = await import('./telegramChat.ts');
    await notifyTelegramChatInbound({
      conversation: conv,
      text: trimmed || null,
      attachments,
      sentAt: now,
    });
  } catch (tgErr) {
    console.warn('[webGuestChat] telegram notify:', tgErr);
  }

  try {
    const participantLabel = inboxNotificationParticipantLabel(
      conv.participant_name,
      conv.conversation_type
    );
    await createOrCoalesceNotification({
      organizationId: conv.organization_id,
      propertyId: conv.property_id ?? null,
      parkingId: conv.parking_id ?? null,
      type: 'inbox_new_message',
      title: participantLabel,
      body: preview.slice(0, 200),
      conversationId: conv.id,
      metadata: inboxNotificationMetadata(conv),
      dedupeKey: `${conv.id}:inbox_new_message`,
    });
  } catch (notifErr) {
    console.warn('[webGuestChat] notification create:', notifErr);
  }
}

export async function editGuestWebMessage(
  user: AuthenticatedUser,
  conversationId: string,
  messageId: string,
  text: string
): Promise<SocialMessageRow> {
  await assertGuestCanEditMessage(user.id, conversationId, messageId);
  return editMessageBody(messageId, text, {
    refreshPreview: true,
    conversationId,
  });
}

export async function unsendGuestWebMessage(
  user: AuthenticatedUser,
  conversationId: string,
  messageId: string
): Promise<void> {
  await assertGuestCanUnsendMessage(user.id, conversationId, messageId);
  await softDeleteMessage(messageId, { conversationId });
}

export { markGuestWebConversationRead };

export async function listGuestWebMessages(
  user: AuthenticatedUser,
  conversationId: string,
  opts?: { before?: string; limit?: number }
) {
  const conv = await assertGuestOwnsWebConversation(user.id, conversationId);
  const sb = socialInboxDb();
  const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100);
  let q = sb
    .from('social_messages')
    .select('*')
    .eq('conversation_id', conv.id)
    .order('sent_at', { ascending: false })
    .limit(limit + 1);
  if (opts?.before) {
    q = q.lt('sent_at', opts.before);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  return {
    conversation: conv,
    messages: slice.reverse(),
    hasMore,
    replyStatus: conv.reply_status ?? 'none',
  };
}

export async function enrichWebConversationsWithPropertyNames<
  T extends { platform: string; property_id?: string | null },
>(
  conversations: T[]
): Promise<Array<T & { property_name?: string | null; property_slug?: string | null }>> {
  const propertyIds = [
    ...new Set(
      conversations
        .filter((c) => c.platform === 'web' && c.property_id)
        .map((c) => c.property_id as string)
    ),
  ];
  if (!propertyIds.length) return conversations;

  const sb = socialInboxDb();
  const { data } = await sb.from('properties').select('id, name, slug').in('id', propertyIds);
  const byId = new Map((data ?? []).map((row) => [row.id as string, row]));

  return conversations.map((conv) => {
    if (conv.platform !== 'web' || !conv.property_id) return conv;
    const row = byId.get(conv.property_id);
    return {
      ...conv,
      property_name: (row?.name as string | undefined) ?? null,
      property_slug: (row?.slug as string | undefined) ?? null,
    };
  });
}
