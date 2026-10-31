import { useMemo } from 'react';

import { useQuery } from '@tanstack/react-query';

import type { NotificationRecord } from '@/features/dashboard/notifications/lib/notificationsApi';
import {
  formatNotificationGuestName,
  notificationInboxPlatform,
} from '@/features/dashboard/notifications/lib/notificationsDisplay';

import { supabase } from '@/lib/supabase/client';

type ConversationRow = {
  id: string;
  participant_name: string | null;
  platform: string | null;
  inquiry_check_in: string | null;
  inquiry_check_out: string | null;
};

function inboxRowsMissingContext(notifications: NotificationRecord[]): NotificationRecord[] {
  return notifications.filter((notification) => {
    if (notification.type !== 'inbox_new_message' || !notification.conversation_id) return false;
    const metadata = notification.metadata ?? {};
    const guestName =
      typeof metadata.guest_name === 'string'
        ? metadata.guest_name.trim()
        : typeof metadata.participant_name === 'string'
          ? metadata.participant_name.trim()
          : '';
    const needsPlatform = !notificationInboxPlatform(metadata);
    const needsName = !guestName;
    const needsDates =
      typeof metadata.inquiry_check_in !== 'string' ||
      !metadata.inquiry_check_in.trim() ||
      typeof metadata.inquiry_check_out !== 'string' ||
      !metadata.inquiry_check_out.trim();
    return needsPlatform || needsName || needsDates;
  });
}

function mergeConversationMetadata(
  notification: NotificationRecord,
  conv: ConversationRow
): NotificationRecord {
  const metadata: Record<string, unknown> = { ...(notification.metadata ?? {}) };

  if (conv.participant_name?.trim()) {
    metadata.participant_name = conv.participant_name;
    metadata.guest_name = conv.participant_name.trim();
  }
  if (conv.platform) metadata.platform = conv.platform;
  if (conv.inquiry_check_in) metadata.inquiry_check_in = conv.inquiry_check_in;
  if (conv.inquiry_check_out) metadata.inquiry_check_out = conv.inquiry_check_out;

  const title = formatNotificationGuestName({
    type: notification.type,
    title: notification.title,
    metadata,
  });

  return { ...notification, metadata, title };
}

/** Client-side inbox context — mirrors toast enrichment when list API rows lack platform. */
export function useEnrichedNotifications(
  notifications: NotificationRecord[]
): NotificationRecord[] {
  const rowsNeedingContext = useMemo(() => inboxRowsMissingContext(notifications), [notifications]);

  const conversationIds = useMemo(() => {
    const ids = [
      ...new Set(
        rowsNeedingContext
          .map((row) => row.conversation_id)
          .filter((id): id is string => Boolean(id))
      ),
    ];
    ids.sort();
    return ids;
  }, [rowsNeedingContext]);

  const { data: conversationById } = useQuery({
    queryKey: ['notification-inbox-enrichment', conversationIds],
    enabled: conversationIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('social_conversations')
        .select('id, participant_name, platform, inquiry_check_in, inquiry_check_out')
        .in('id', conversationIds);
      if (error) throw error;
      return new Map((data ?? []).map((row) => [row.id, row as ConversationRow]));
    },
  });

  return useMemo(() => {
    if (!conversationById?.size) return notifications;
    return notifications.map((notification) => {
      if (notification.type !== 'inbox_new_message' || !notification.conversation_id) {
        return notification;
      }
      const conv = conversationById.get(notification.conversation_id);
      if (!conv) return notification;

      const metadata = notification.metadata ?? {};
      const guestName =
        typeof metadata.guest_name === 'string'
          ? metadata.guest_name.trim()
          : typeof metadata.participant_name === 'string'
            ? metadata.participant_name.trim()
            : '';
      const needsPlatform = !notificationInboxPlatform(metadata);
      const needsName = !guestName;
      const needsDates =
        typeof metadata.inquiry_check_in !== 'string' ||
        !metadata.inquiry_check_in.trim() ||
        typeof metadata.inquiry_check_out !== 'string' ||
        !metadata.inquiry_check_out.trim();

      if (!needsPlatform && !needsName && !needsDates) return notification;
      return mergeConversationMetadata(notification, conv);
    });
  }, [notifications, conversationById]);
}
