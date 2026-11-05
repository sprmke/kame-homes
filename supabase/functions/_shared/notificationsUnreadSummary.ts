/** Minimal row shape for unread bucketing (list API + unread count query). */
export type NotificationUnreadRow = {
  type: string;
  conversation_id: string | null;
  notification_reads: { id: string }[] | null;
};

export type NotificationsUnreadSummary = {
  unreadCount: number;
  unreadInbox: number;
  unreadBookings: number;
  unreadReviews: number;
};

const REVIEW_NOTIFICATION_TYPES = new Set([
  'review_received',
  'review_due',
  'review_response_received',
]);

function isUnread(row: NotificationUnreadRow): boolean {
  return !Array.isArray(row.notification_reads) || row.notification_reads.length === 0;
}

function inboxUnreadConversationIds(rows: NotificationUnreadRow[]): Set<string> {
  const unread = new Set<string>();
  for (const row of rows) {
    if (row.type === 'inbox_new_message' && row.conversation_id && isUnread(row)) {
      unread.add(row.conversation_id);
    }
  }
  return unread;
}

/** Collapsed unread totals by category — mirrors inbox one-row-per-conversation rules. */
export function summarizeNotificationsUnread(
  rows: NotificationUnreadRow[]
): NotificationsUnreadSummary {
  const inboxUnreadConversations = inboxUnreadConversationIds(rows);
  const seenInbox = new Set<string>();

  let unreadInbox = 0;
  let unreadBookings = 0;
  let unreadReviews = 0;

  for (const row of rows) {
    if (!isUnread(row)) continue;

    if (row.type === 'inbox_new_message' && row.conversation_id) {
      if (seenInbox.has(row.conversation_id)) continue;
      seenInbox.add(row.conversation_id);
      if (inboxUnreadConversations.has(row.conversation_id)) unreadInbox++;
      continue;
    }

    if (REVIEW_NOTIFICATION_TYPES.has(row.type)) {
      unreadReviews++;
      continue;
    }

    unreadBookings++;
  }

  return {
    unreadCount: unreadInbox + unreadBookings + unreadReviews,
    unreadInbox,
    unreadBookings,
    unreadReviews,
  };
}
