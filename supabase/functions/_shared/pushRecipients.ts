/**
 * Who receives an OS push for a given notification.
 *
 * Scope rules mirror the in-app realtime rule (`user_can_access_org_notifications`
 * in 20261015120000_notifications.sql) **plus** the property- and parking-scoped
 * team tables. v1 only pushed to the org owner and org members, so a team member
 * who only has property or parking access got no OS notification at all even though
 * they could see the row in the bell (P1-4).
 *
 * RBAC: a property/parking member only gets a push for an area they can open. The
 * gate is `notifications:view` plus the section leaf implied by the notification
 * type, so a finance-scoped notification never reaches someone without finance
 * access.
 */
import { expandLegacyPropertyPermissionIds } from './legacyPermissionExpansion.ts';
import type { SupabaseClient } from './supabaseJs.ts';

import type { StoredPushSubscription } from './webPushService.ts';

export type NotificationRow = {
  id: string;
  organization_id: string;
  type: string;
  title: string;
  body: string | null;
  booking_id: string | null;
  conversation_id: string | null;
  property_id: string | null;
  parking_id: string | null;
  metadata: Record<string, unknown> | null;
};

/**
 * Section permission a notification type needs, or `null` when the type is
 * operational enough that `notifications:view` is the only gate.
 */
export function permissionForNotificationType(type: string): string | null {
  if (type.startsWith('inbox_')) return 'inbox:view';
  if (type.startsWith('booking_') || type === 'calendar_conflict') return 'bookings:view';
  if (type.startsWith('review_')) return 'reviews:view';
  if (type.startsWith('smart_pricing') || type.startsWith('calendar_sync')) return 'pricing:view';
  if (type.startsWith('analytics_')) return 'analytics:view';
  if (type.startsWith('finance_') || type.includes('refund') || type.includes('payment'))
    return 'finance:view';
  if (type.startsWith('maintenance_')) return 'maintenance:view';
  return null;
}

function expandPermissions(permissions: unknown): string[] {
  if (!Array.isArray(permissions)) return [];
  const values = permissions.filter((p): p is string => typeof p === 'string');
  return expandLegacyPropertyPermissionIds(values);
}

/** Does a member's permission list allow this notification? */
export function memberCanReceiveNotification(
  permissions: unknown,
  notificationType: string
): boolean {
  const expanded = expandPermissions(permissions);
  if (!expanded.includes('notifications:view')) return false;
  const required = permissionForNotificationType(notificationType);
  if (required && !expanded.includes(required)) return false;
  return true;
}

/** Distinct user ids that can see notifications for this org / property / parking. */
export async function resolveNotificationRecipientUserIds(
  sb: SupabaseClient,
  notification: Pick<NotificationRow, 'organization_id' | 'type' | 'property_id' | 'parking_id'>
): Promise<string[]> {
  const ids = new Set<string>();
  const organizationId = notification.organization_id;

  const { data: org } = await sb
    .from('organizations')
    .select('owner_id')
    .eq('id', organizationId)
    .maybeSingle();
  if (org?.owner_id) ids.add(org.owner_id as string);

  // Org-level members: unchanged from the realtime rule (full org visibility).
  const { data: members } = await sb
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', organizationId)
    .eq('status', 'active');
  for (const m of members ?? []) {
    if (m.user_id) ids.add(m.user_id as string);
  }

  const type = notification.type;

  if (notification.property_id) {
    const { data: propertyMembers } = await sb
      .from('property_members')
      .select('user_id, permissions')
      .eq('property_id', notification.property_id)
      .eq('status', 'active');
    for (const m of propertyMembers ?? []) {
      if (m.user_id && memberCanReceiveNotification(m.permissions, type)) {
        ids.add(m.user_id as string);
      }
    }
  }

  if (notification.parking_id) {
    const { data: parkingMembers } = await sb
      .from('parking_members')
      .select('user_id, permissions')
      .eq('parking_id', notification.parking_id)
      .eq('status', 'active');
    for (const m of parkingMembers ?? []) {
      if (m.user_id && memberCanReceiveNotification(m.permissions, type)) {
        ids.add(m.user_id as string);
      }
    }
  }

  return [...ids];
}

/** Active push subscriptions for a set of users. */
export async function loadPushSubscriptions(
  sb: SupabaseClient,
  userIds: string[]
): Promise<StoredPushSubscription[]> {
  if (userIds.length === 0) return [];
  const { data, error } = await sb
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
    .in('user_id', userIds)
    .is('disabled_at', null);
  if (error) {
    console.error('[pushRecipients] loadPushSubscriptions failed:', error.message);
    return [];
  }
  return (data ?? []) as StoredPushSubscription[];
}

/**
 * Unread notifications in this notification's scope for one user. Used for the
 * app-icon badge carried by the push payload, so the badge is right even when the
 * app is closed (6.3). Deliberately bounded: a badge does not need an exact count
 * past 99.
 */
export async function countUnreadForUser(
  sb: SupabaseClient,
  n: Pick<NotificationRow, 'organization_id' | 'property_id' | 'parking_id'>,
  userId: string
): Promise<number> {
  let query = sb
    .from('notifications')
    .select('id')
    .eq('organization_id', n.organization_id)
    .order('created_at', { ascending: false })
    .limit(200);
  if (n.property_id) query = query.eq('property_id', n.property_id);
  if (n.parking_id) query = query.eq('parking_id', n.parking_id);

  const { data: rows, error } = await query;
  if (error || !rows?.length) return 0;
  const ids = rows.map((row) => row.id as string);

  const { data: reads } = await sb
    .from('notification_reads')
    .select('notification_id')
    .eq('user_id', userId)
    .in('notification_id', ids);
  const readIds = new Set((reads ?? []).map((r) => r.notification_id as string));
  return ids.filter((id) => !readIds.has(id)).length;
}

/**
 * Best-effort click-through path for a notification, mirroring the client's
 * `resolveNotificationPath` (ui/.../notifications/lib/notificationsPaths.ts).
 * Falls back to `/app` (the launch resolver picks the viewer's tenant).
 */
export async function resolveNotificationClickPath(
  sb: SupabaseClient,
  n: NotificationRow
): Promise<string> {
  const { data: org } = await sb
    .from('organizations')
    .select('slug')
    .eq('id', n.organization_id)
    .maybeSingle();
  const orgSlug = org?.slug as string | undefined;
  if (!orgSlug) return '/app';

  if (n.property_id) {
    const { data: p } = await sb
      .from('properties')
      .select('slug')
      .eq('id', n.property_id)
      .maybeSingle();
    const slug = p?.slug as string | undefined;
    if (slug) {
      const base = `/org/${orgSlug}/property/${slug}`;
      if (n.booking_id) return `${base}/bookings/${n.booking_id}`;
      if (n.conversation_id) return `${base}/inbox`;
      return `${base}/notifications`;
    }
  }

  if (n.parking_id) {
    const { data: pk } = await sb
      .from('parkings')
      .select('slug')
      .eq('id', n.parking_id)
      .maybeSingle();
    const slug = pk?.slug as string | undefined;
    if (slug) {
      const base = `/org/${orgSlug}/parking/${slug}`;
      if (n.booking_id) return `${base}/bookings/${n.booking_id}`;
      if (n.conversation_id) return `${base}/inbox`;
      return `${base}/notifications`;
    }
  }

  return `/app`;
}

/** Failure cap before a subscription is retired (`disabled_at`). */
export const PUSH_FAILURE_RETIRE_AT = 5;

/** Next failure state for a subscription: count + whether it retires now. */
export function nextPushFailureState(failureCount: unknown): {
  failureCount: number;
  retire: boolean;
} {
  const next = (typeof failureCount === 'number' && failureCount > 0 ? failureCount : 0) + 1;
  return { failureCount: next, retire: next >= PUSH_FAILURE_RETIRE_AT };
}

/** Mark endpoints gone (404/410) as disabled; bump failure_count on transient errors. */
export async function reconcilePushFailures(
  sb: SupabaseClient,
  goneIds: string[],
  failedIds: string[]
): Promise<void> {
  try {
    if (goneIds.length > 0) {
      await sb
        .from('push_subscriptions')
        .update({ disabled_at: new Date().toISOString() })
        .in('id', goneIds);
    }
    if (failedIds.length > 0) {
      // No atomic increment via PostgREST — read, bump, retire at the cap.
      const { data } = await sb
        .from('push_subscriptions')
        .select('id, failure_count')
        .in('id', failedIds);
      for (const row of data ?? []) {
        const next = nextPushFailureState(row.failure_count);
        await sb
          .from('push_subscriptions')
          .update({
            failure_count: next.failureCount,
            disabled_at: next.retire ? new Date().toISOString() : null,
          })
          .eq('id', row.id);
      }
    }
  } catch (err) {
    console.error('[pushRecipients] reconcilePushFailures threw:', err);
  }
}
