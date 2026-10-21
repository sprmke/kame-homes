import { scopedOrgFunctionsUrl } from '@/features/dashboard/org/lib/adminApiScope';
import { getSessionJwt } from '@/features/dashboard/org/lib/edgeClient';

export type NotificationType =
  | 'booking_pending_review'
  | 'booking_ready_for_checkin'
  | 'booking_ready_for_checkout'
  | 'booking_sd_refund_due'
  | 'booking_gaf_auto_approved'
  | 'booking_pet_auto_approved'
  | 'booking_parking_matched'
  | 'inbox_new_message'
  | 'calendar_sync_failing'
  | 'calendar_conflict'
  | 'booking_external_imported'
  | 'booking_guest_form_completed'
  | 'smart_pricing_updated'
  | 'property_settings_copied'
  | 'analytics_review_updated'
  | 'review_received'
  | 'review_due'
  | 'review_response_received';

export type NotificationRecord = {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  booking_id: string | null;
  conversation_id: string | null;
  property_id: string | null;
  parking_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  isRead: boolean;
};

export type NotificationsPage = {
  notifications: NotificationRecord[];
  nextCursor: string | null;
  unreadCount: number;
};

/** Raw `notifications` row from postgres realtime (DB columns, not the list API DTO). */
export type NotificationRealtimeRow = {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  booking_id: string | null;
  conversation_id: string | null;
  property_id: string | null;
  parking_id: string | null;
  metadata?: Record<string, unknown>;
};

async function parseEdgeJson<T>(res: Response): Promise<T> {
  const json = (await res.json()) as { success?: boolean; error?: string; data?: T };
  if (!res.ok || !json.success) {
    throw new Error(json.error ?? 'Request failed');
  }
  return json.data as T;
}

export async function fetchNotifications(
  orgSlug: string | null,
  orgId: string | null,
  cursor?: string | null,
  limit?: number
): Promise<NotificationsPage> {
  const jwt = await getSessionJwt();
  const url = new URL(scopedOrgFunctionsUrl('/notifications-list', orgSlug, orgId));
  if (cursor) url.searchParams.set('cursor', cursor);
  if (limit != null) url.searchParams.set('limit', String(limit));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  return parseEdgeJson<NotificationsPage>(res);
}

export async function markNotificationRead(
  orgSlug: string | null,
  orgId: string | null,
  notificationId: string
): Promise<{ markedCount: number }> {
  const jwt = await getSessionJwt();
  const res = await fetch(scopedOrgFunctionsUrl('/notifications-mark-read', orgSlug, orgId), {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ notificationId }),
  });
  return parseEdgeJson<{ markedCount: number }>(res);
}

export async function markAllNotificationsRead(
  orgSlug: string | null,
  orgId: string | null
): Promise<{ markedCount: number }> {
  const jwt = await getSessionJwt();
  const res = await fetch(scopedOrgFunctionsUrl('/notifications-mark-read', orgSlug, orgId), {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ markAll: true }),
  });
  return parseEdgeJson<{ markedCount: number }>(res);
}
