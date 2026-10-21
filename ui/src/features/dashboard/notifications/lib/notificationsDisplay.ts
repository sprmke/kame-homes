import {
  AlertTriangle,
  BarChart3,
  CalendarCheck,
  CalendarPlus,
  CalendarX,
  Car,
  ClipboardCheck,
  Copy,
  FileCheck,
  LogIn,
  LogOut,
  MessageCircle,
  PawPrint,
  RefreshCw,
  Reply,
  Sparkles,
  Star,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

import { platformLabel } from '@/features/dashboard/inbox/lib/inboxFormat';
import type { SocialPlatform } from '@/features/dashboard/inbox/types/inbox';
import type {
  NotificationRecord,
  NotificationRealtimeRow,
  NotificationType,
} from '@/features/dashboard/notifications/lib/notificationsApi';

import { supabase } from '@/lib/supabase/client';
import { formatStayDateRange } from '@/utils/format/dates';

export const LEGACY_INBOX_NOTIFICATION_TITLE = 'New guest message';

const INBOX_PLATFORMS = new Set<SocialPlatform>([
  'web',
  'facebook',
  'instagram',
  'tiktok',
  'airbnb',
]);

const NOTIFICATION_ICONS: Record<NotificationType, LucideIcon> = {
  inbox_new_message: MessageCircle,
  booking_pending_review: CalendarPlus,
  booking_ready_for_checkin: LogIn,
  booking_ready_for_checkout: LogOut,
  booking_sd_refund_due: Wallet,
  booking_gaf_auto_approved: FileCheck,
  booking_pet_auto_approved: PawPrint,
  booking_parking_matched: Car,
  calendar_sync_failing: CalendarX,
  calendar_conflict: AlertTriangle,
  booking_external_imported: RefreshCw,
  booking_guest_form_completed: ClipboardCheck,
  smart_pricing_updated: Sparkles,
  property_settings_copied: Copy,
  analytics_review_updated: BarChart3,
  review_received: Star,
  review_due: Star,
  review_response_received: Reply,
};

/** Category glyph shared by the bell list, Activity page, and realtime toast. */
export function notificationIconFor(type: NotificationType): LucideIcon {
  return NOTIFICATION_ICONS[type] ?? CalendarCheck;
}

function readMetaString(metadata: Record<string, unknown> | undefined, key: string): string {
  const value = metadata?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

/** Inbox channel from notification metadata (`web` → Chat, Meta, etc.). */
export function notificationInboxPlatform(
  metadata: Record<string, unknown> | undefined
): SocialPlatform | null {
  const value = readMetaString(metadata, 'platform');
  if (!value || !INBOX_PLATFORMS.has(value as SocialPlatform)) return null;
  return value as SocialPlatform;
}

/** Host-facing channel label for inbox toasts/list rows. */
export function formatNotificationInboxPlatformLabel(
  metadata: Record<string, unknown> | undefined
): string | null {
  const platform = notificationInboxPlatform(metadata);
  return platform ? platformLabel(platform) : null;
}

/** Primary line — guest name (inbox + booking notifications). */
export function formatNotificationGuestName(
  notification: Pick<NotificationRecord, 'type' | 'title' | 'metadata'>
): string {
  const guestName = readMetaString(notification.metadata, 'guest_name');
  const participantName = readMetaString(notification.metadata, 'participant_name');
  const name = guestName || participantName;

  if (notification.type === 'inbox_new_message') {
    if (name) return name;
    const title = notification.title.trim();
    if (title && title !== LEGACY_INBOX_NOTIFICATION_TITLE) return title;
    return 'Guest';
  }

  if (name) return name;
  return notification.title.trim() || 'Guest';
}

/** Alias kept for existing call sites. */
export function formatNotificationDisplayTitle(
  notification: Pick<NotificationRecord, 'type' | 'title' | 'metadata'>
): string {
  return formatNotificationGuestName(notification);
}

/** Inquiry dates (web chat) or booked stay dates when present. */
export function formatNotificationStayLabel(
  metadata: Record<string, unknown> | undefined
): string | null {
  const inquiryIn = readMetaString(metadata, 'inquiry_check_in');
  const inquiryOut = readMetaString(metadata, 'inquiry_check_out');
  if (inquiryIn && inquiryOut) {
    return formatStayDateRange(inquiryIn, inquiryOut);
  }

  const checkIn = readMetaString(metadata, 'check_in_date');
  const checkOut = readMetaString(metadata, 'check_out_date');
  if (checkIn && checkOut) {
    return formatStayDateRange(checkIn, checkOut);
  }

  return null;
}

type DisplayNotification = Pick<NotificationRecord, 'type' | 'title' | 'body' | 'metadata'>;

/** Fill missing guest/stay metadata for realtime toasts (list API enriches historical rows). */
export async function enrichRealtimeNotificationRow(
  row: NotificationRealtimeRow
): Promise<DisplayNotification> {
  const metadata: Record<string, unknown> = { ...(row.metadata ?? {}) };

  if (row.type === 'inbox_new_message' && row.conversation_id) {
    const needsName =
      !readMetaString(metadata, 'guest_name') && !readMetaString(metadata, 'participant_name');
    const needsDates =
      !readMetaString(metadata, 'inquiry_check_in') ||
      !readMetaString(metadata, 'inquiry_check_out');
    const needsPlatform = !notificationInboxPlatform(metadata);

    if (needsName || needsDates || needsPlatform) {
      const { data } = await supabase
        .from('social_conversations')
        .select('participant_name, platform, inquiry_check_in, inquiry_check_out')
        .eq('id', row.conversation_id)
        .maybeSingle();

      if (data?.participant_name?.trim()) {
        metadata.participant_name = data.participant_name;
        metadata.guest_name = data.participant_name.trim();
      }
      if (data?.platform) metadata.platform = data.platform;
      if (data?.inquiry_check_in) metadata.inquiry_check_in = data.inquiry_check_in;
      if (data?.inquiry_check_out) metadata.inquiry_check_out = data.inquiry_check_out;
    }
  }

  let title = row.title;
  const guestName = readMetaString(metadata, 'guest_name');
  if (guestName) {
    title = guestName;
  } else if (
    row.type === 'inbox_new_message' &&
    (title.trim() === LEGACY_INBOX_NOTIFICATION_TITLE || !title.trim())
  ) {
    title = 'Guest';
  }

  return {
    type: row.type,
    title,
    body: row.body,
    metadata,
  };
}
