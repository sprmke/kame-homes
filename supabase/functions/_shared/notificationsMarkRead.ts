/**
 * Mark notifications read for one user — shared by `notifications-mark-read` and the assistant's
 * `propose_mark_notifications_read`. Callers resolve access first (`resolveNotificationsAccess`).
 * Marking an inbox notification also marks its sibling rows for the same conversation.
 */

import { createServiceClient } from './orgAuth.ts';

/** Guardrail against an unbounded scan — matches the notifications-list unread cap. */
export const MARK_ALL_CAP = 500;

export class NotificationMarkReadError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

export async function markNotificationsRead(
  ctx: { orgId: string; propertyId?: string | null; parkingId?: string | null },
  userId: string,
  input: { markAll: true } | { notificationId: string }
): Promise<{ markedCount: number }> {
  const sb = createServiceClient();

  if ('markAll' in input) {
    let idsQuery = sb
      .from('notifications')
      .select('id, notification_reads!left(id)')
      .eq('organization_id', ctx.orgId)
      .eq('notification_reads.user_id', userId)
      .order('created_at', { ascending: false })
      .limit(MARK_ALL_CAP);
    if (ctx.propertyId) idsQuery = idsQuery.eq('property_id', ctx.propertyId);
    if (ctx.parkingId) idsQuery = idsQuery.eq('parking_id', ctx.parkingId);

    const { data: rows, error } = await idsQuery;
    if (error) throw new NotificationMarkReadError(error.message, 500);

    const unreadIds = (
      (rows ?? []) as { id: string; notification_reads: { id: string }[] | null }[]
    )
      .filter(
        (row) => !Array.isArray(row.notification_reads) || row.notification_reads.length === 0
      )
      .map((row) => row.id);

    if (unreadIds.length > 0) {
      const { error: insertError } = await sb.from('notification_reads').upsert(
        unreadIds.map((id) => ({ notification_id: id, user_id: userId })),
        { onConflict: 'notification_id,user_id', ignoreDuplicates: true }
      );
      if (insertError) throw new NotificationMarkReadError(insertError.message, 500);
    }
    return { markedCount: unreadIds.length };
  }

  const { data: notification, error: notifError } = await sb
    .from('notifications')
    .select('id, organization_id, type, conversation_id')
    .eq('id', input.notificationId)
    .maybeSingle();
  if (notifError) throw new NotificationMarkReadError(notifError.message, 500);
  if (!notification || notification.organization_id !== ctx.orgId) {
    throw new NotificationMarkReadError('Notification not found', 404);
  }

  const idsToMark = [input.notificationId];
  if (notification.type === 'inbox_new_message' && notification.conversation_id) {
    const { data: siblingRows, error: siblingError } = await sb
      .from('notifications')
      .select('id')
      .eq('organization_id', ctx.orgId)
      .eq('type', 'inbox_new_message')
      .eq('conversation_id', notification.conversation_id);
    if (siblingError) throw new NotificationMarkReadError(siblingError.message, 500);
    for (const row of siblingRows ?? []) {
      if (row.id !== input.notificationId) idsToMark.push(row.id);
    }
  }

  const { error: insertError } = await sb.from('notification_reads').upsert(
    idsToMark.map((id) => ({ notification_id: id, user_id: userId })),
    { onConflict: 'notification_id,user_id', ignoreDuplicates: true }
  );
  if (insertError) throw new NotificationMarkReadError(insertError.message, 500);
  return { markedCount: idsToMark.length };
}
