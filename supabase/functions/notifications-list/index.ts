/**
 * List notifications for the caller's org (keyset pagination on created_at).
 */

import { summarizeNotificationsUnread } from '../_shared/notificationsUnreadSummary.ts';
import { resolveNotificationsAccess } from '../_shared/notificationsAccess.ts';
import {
  enrichNotificationRowForDisplay,
  type BookingGuestContext,
  type InboxConversationContext,
} from '../_shared/notificationEnrichment.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
/** Unread badge only ever looks at the most recent N — keeps it cheap on a growing table. */
const UNREAD_COUNT_CAP = 100;

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  booking_id: string | null;
  conversation_id: string | null;
  property_id: string | null;
  parking_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  notification_reads: { id: string }[] | null;
};

function isUnread(row: NotificationRow): boolean {
  return !Array.isArray(row.notification_reads) || row.notification_reads.length === 0;
}

/** Legacy rows used per-message dedupe keys — show one inbox row per conversation (newest first). */
function collapseInboxNotificationRows(rows: NotificationRow[]): NotificationRow[] {
  const seen = new Set<string>();
  const result: NotificationRow[] = [];
  for (const row of rows) {
    if (row.type === 'inbox_new_message' && row.conversation_id) {
      if (seen.has(row.conversation_id)) continue;
      seen.add(row.conversation_id);
    }
    result.push(row);
  }
  return result;
}

function inboxUnreadConversationIds(rows: NotificationRow[]): Set<string> {
  const unread = new Set<string>();
  for (const row of rows) {
    if (row.type === 'inbox_new_message' && row.conversation_id && isUnread(row)) {
      unread.add(row.conversation_id);
    }
  }
  return unread;
}

serveAuthenticated('notifications-list', async (req, user) => {
  if (req.method !== 'GET') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const ctx = await resolveNotificationsAccess(req);
  if (ctx.planLimited) {
    return jsonSuccess(req, {
      notifications: [],
      nextCursor: null,
      unreadCount: 0,
      unreadSummary: { inbox: 0, bookings: 0, reviews: 0 },
    });
  }
  const url = new URL(req.url);
  const cursor = url.searchParams.get('cursor');
  const limitRaw = url.searchParams.get('limit');
  const limit = Math.min(Math.max(Number(limitRaw) || DEFAULT_LIMIT, 1), MAX_LIMIT);

  const sb = createServiceClient();

  let listQuery = sb
    .from('notifications')
    .select(
      'id, type, title, body, booking_id, conversation_id, property_id, parking_id, metadata, created_at, notification_reads!left(id)'
    )
    .eq('organization_id', ctx.orgId)
    .eq('notification_reads.user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    listQuery = listQuery.lt('created_at', cursor);
  }

  const { data: rows, error } = await listQuery;
  if (error) return jsonError(req, error.message, 500);

  const fetched = (rows ?? []) as NotificationRow[];
  const hasMore = fetched.length > limit;
  const page = hasMore ? fetched.slice(0, limit) : fetched;
  const nextCursor = hasMore ? (page[page.length - 1]?.created_at ?? null) : null;

  const inboxUnreadConversations = inboxUnreadConversationIds(page);
  const collapsedPage = collapseInboxNotificationRows(page);

  const inboxConversationIds = [
    ...new Set(
      collapsedPage
        .filter((row) => row.type === 'inbox_new_message' && row.conversation_id)
        .map((row) => row.conversation_id as string)
    ),
  ];

  const bookingIds = [
    ...new Set(
      collapsedPage.filter((row) => row.booking_id).map((row) => row.booking_id as string)
    ),
  ];

  const conversationById = new Map<string, InboxConversationContext>();
  if (inboxConversationIds.length > 0) {
    const { data: conversations, error: convError } = await sb
      .from('social_conversations')
      .select(
        'id, participant_name, conversation_type, platform, inquiry_check_in, inquiry_check_out'
      )
      .in('id', inboxConversationIds);
    if (convError) return jsonError(req, convError.message, 500);
    for (const conv of conversations ?? []) {
      conversationById.set(conv.id, conv);
    }
  }

  const bookingById = new Map<string, BookingGuestContext>();
  if (bookingIds.length > 0) {
    const { data: bookings, error: bookingError } = await sb
      .from('guest_submissions')
      .select('id, primary_guest_name, check_in_date, check_out_date')
      .in('id', bookingIds);
    if (bookingError) return jsonError(req, bookingError.message, 500);
    for (const booking of bookings ?? []) {
      bookingById.set(booking.id, booking);
    }
  }

  const notifications = collapsedPage.map((row) => {
    const { notification_reads, ...rest } = row;
    const enriched = enrichNotificationRowForDisplay(
      {
        type: rest.type,
        title: rest.title,
        metadata: rest.metadata ?? {},
        conversation_id: rest.conversation_id,
        booking_id: rest.booking_id,
      },
      conversationById,
      bookingById
    );
    const inboxUnread =
      rest.type === 'inbox_new_message' &&
      rest.conversation_id &&
      inboxUnreadConversations.has(rest.conversation_id);
    return {
      ...rest,
      title: enriched.title,
      metadata: enriched.metadata,
      isRead: inboxUnread ? false : !isUnread(row),
    };
  });

  const { data: unreadRows, error: unreadError } = await sb
    .from('notifications')
    .select('id, type, conversation_id, notification_reads!left(id)')
    .eq('organization_id', ctx.orgId)
    .eq('notification_reads.user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(UNREAD_COUNT_CAP);
  if (unreadError) return jsonError(req, unreadError.message, 500);

  // Must include type + conversation_id so inbox rows collapse one-per-conversation
  // (legacy per-message rows) — same rule as the list payload above.
  const unreadSummary = summarizeNotificationsUnread((unreadRows ?? []) as NotificationRow[]);

  return jsonSuccess(req, {
    notifications,
    nextCursor,
    unreadCount: unreadSummary.unreadCount,
    unreadSummary: {
      inbox: unreadSummary.unreadInbox,
      bookings: unreadSummary.unreadBookings,
      reviews: unreadSummary.unreadReviews,
    },
  });
});
