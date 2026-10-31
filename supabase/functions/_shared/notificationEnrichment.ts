/**
 * Guest + stay context for in-app notifications (metadata + list enrichment).
 */

import {
  inboxNotificationParticipantLabel,
  LEGACY_INBOX_NOTIFICATION_TITLE,
  type NotificationType,
} from './notificationService.ts';
import type { SocialPlatform } from './socialInboxTypes.ts';

export type InboxConversationContext = {
  participant_name?: string | null;
  conversation_type?: 'dm' | 'comment';
  platform?: SocialPlatform | null;
  inquiry_check_in?: string | null;
  inquiry_check_out?: string | null;
};

export type BookingGuestContext = {
  primary_guest_name?: string | null;
  check_in_date?: string | null;
  check_out_date?: string | null;
};

export function inboxNotificationMetadata(conv: InboxConversationContext): Record<string, unknown> {
  const guestName = conv.participant_name?.trim() || null;
  return {
    participant_name: conv.participant_name ?? null,
    guest_name: guestName,
    platform: conv.platform ?? null,
    inquiry_check_in: conv.inquiry_check_in ?? null,
    inquiry_check_out: conv.inquiry_check_out ?? null,
  };
}

export function bookingNotificationMetadata(booking: BookingGuestContext): Record<string, unknown> {
  const guestName = booking.primary_guest_name?.trim() || null;
  return {
    guest_name: guestName,
    check_in_date: booking.check_in_date ?? null,
    check_out_date: booking.check_out_date ?? null,
  };
}

function readMetaString(metadata: Record<string, unknown>, key: string): string {
  const value = metadata[key];
  return typeof value === 'string' ? value.trim() : '';
}

export function resolveNotificationGuestTitle(
  type: string,
  title: string,
  metadata: Record<string, unknown>
): string {
  const guestName = readMetaString(metadata, 'guest_name');
  const participantName = readMetaString(metadata, 'participant_name');
  const name = guestName || participantName;

  if (type === 'inbox_new_message') {
    if (name) return name;
    const trimmedTitle = title.trim();
    if (trimmedTitle && trimmedTitle !== LEGACY_INBOX_NOTIFICATION_TITLE) return trimmedTitle;
    return inboxNotificationParticipantLabel(null);
  }

  if (name) return name;
  return title.trim() || 'Guest';
}

export function mergeInboxMetadata(
  metadata: Record<string, unknown>,
  conv: InboxConversationContext | null | undefined
): Record<string, unknown> {
  if (!conv) return metadata;
  const patch = inboxNotificationMetadata(conv);
  return {
    ...metadata,
    participant_name: readMetaString(metadata, 'participant_name') || patch.participant_name,
    guest_name: readMetaString(metadata, 'guest_name') || patch.guest_name,
    platform: (conv.platform ?? readMetaString(metadata, 'platform')) || null,
    inquiry_check_in: readMetaString(metadata, 'inquiry_check_in') || patch.inquiry_check_in,
    inquiry_check_out: readMetaString(metadata, 'inquiry_check_out') || patch.inquiry_check_out,
  };
}

export function mergeBookingMetadata(
  metadata: Record<string, unknown>,
  booking: BookingGuestContext | null | undefined
): Record<string, unknown> {
  if (!booking) return metadata;
  const patch = bookingNotificationMetadata(booking);
  return {
    ...metadata,
    guest_name: readMetaString(metadata, 'guest_name') || patch.guest_name,
    check_in_date: readMetaString(metadata, 'check_in_date') || patch.check_in_date,
    check_out_date: readMetaString(metadata, 'check_out_date') || patch.check_out_date,
  };
}

export function enrichNotificationRowForDisplay(
  row: {
    type: string;
    title: string;
    metadata: Record<string, unknown>;
    conversation_id: string | null;
    booking_id: string | null;
  },
  conversationById: Map<string, InboxConversationContext>,
  bookingById: Map<string, BookingGuestContext>
): { title: string; metadata: Record<string, unknown> } {
  let metadata = row.metadata ?? {};
  let title = row.title;

  if (row.type === 'inbox_new_message' && row.conversation_id) {
    metadata = mergeInboxMetadata(metadata, conversationById.get(row.conversation_id));
    title = resolveNotificationGuestTitle(row.type, title, metadata);
  } else if (row.booking_id) {
    metadata = mergeBookingMetadata(metadata, bookingById.get(row.booking_id));
    title = resolveNotificationGuestTitle(row.type, title, metadata);
  }

  return { title, metadata };
}

export type NotificationListRow = {
  type: NotificationType | string;
  title: string;
  body: string | null;
  booking_id: string | null;
  conversation_id: string | null;
  metadata: Record<string, unknown>;
};
