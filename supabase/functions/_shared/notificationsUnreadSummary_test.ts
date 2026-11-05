import { assertEquals } from 'jsr:@std/assert';

import { summarizeNotificationsUnread } from './notificationsUnreadSummary.ts';

Deno.test('summarizeNotificationsUnread: collapses inbox threads', () => {
  const summary = summarizeNotificationsUnread([
    {
      type: 'inbox_new_message',
      conversation_id: 'c1',
      notification_reads: null,
    },
    {
      type: 'inbox_new_message',
      conversation_id: 'c1',
      notification_reads: null,
    },
    {
      type: 'booking_pending_review',
      conversation_id: null,
      notification_reads: null,
    },
    {
      type: 'review_due',
      conversation_id: null,
      notification_reads: null,
    },
  ]);

  assertEquals(summary.unreadInbox, 1);
  assertEquals(summary.unreadBookings, 1);
  assertEquals(summary.unreadReviews, 1);
  assertEquals(summary.unreadCount, 3);
});
