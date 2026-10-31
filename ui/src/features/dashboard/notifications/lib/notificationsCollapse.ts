import type { NotificationRecord } from '@/features/dashboard/notifications/lib/notificationsApi';

/**
 * One inbox row per conversation (newest first). Merges unread when legacy per-message rows exist.
 */
export function collapseInboxNotifications(
  notifications: NotificationRecord[]
): NotificationRecord[] {
  const inboxUnreadByConversation = new Map<string, boolean>();
  for (const notification of notifications) {
    if (
      notification.type === 'inbox_new_message' &&
      notification.conversation_id &&
      !notification.isRead
    ) {
      inboxUnreadByConversation.set(notification.conversation_id, true);
    }
  }

  const seen = new Set<string>();
  const result: NotificationRecord[] = [];

  for (const notification of notifications) {
    if (notification.type === 'inbox_new_message' && notification.conversation_id) {
      if (seen.has(notification.conversation_id)) continue;
      seen.add(notification.conversation_id);
      const unread = inboxUnreadByConversation.get(notification.conversation_id) ?? false;
      result.push({ ...notification, isRead: !unread });
    } else {
      result.push(notification);
    }
  }

  return result;
}

export function countCollapsedUnread(notifications: NotificationRecord[]): number {
  return collapseInboxNotifications(notifications).filter((n) => !n.isRead).length;
}
