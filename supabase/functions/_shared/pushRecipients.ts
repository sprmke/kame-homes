/**
 * Who receives an OS push for a given notification.
 *
 * Deliberately mirrors the in-app realtime rule (`user_can_access_org_notifications`
 * in 20261015120000_notifications.sql): **org owner + active organization_members**.
 * A property/parking-only team member gets neither realtime nor push today — a
 * known v1 gap tracked with the realtime one, to be closed together.
 */
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

/** Distinct user ids that can see notifications for this org. */
export async function resolveNotificationRecipientUserIds(
  sb: SupabaseClient,
  organizationId: string
): Promise<string[]> {
  const ids = new Set<string>();

  const { data: org } = await sb
    .from('organizations')
    .select('owner_id')
    .eq('id', organizationId)
    .maybeSingle();
  if (org?.owner_id) ids.add(org.owner_id as string);

  const { data: members } = await sb
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', organizationId)
    .eq('status', 'active');
  for (const m of members ?? []) {
    if (m.user_id) ids.add(m.user_id as string);
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
    .select('id, endpoint, p256dh, auth')
    .in('user_id', userIds)
    .is('disabled_at', null);
  if (error) {
    console.error('[pushRecipients] loadPushSubscriptions failed:', error.message);
    return [];
  }
  return (data ?? []) as StoredPushSubscription[];
}

/**
 * Best-effort click-through path for a notification, mirroring the client's
 * `resolveNotificationPath` (ui/.../notifications/lib/notificationsPaths.ts).
 * Falls back to `/` (which redirects to the viewer's last tenant).
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
  if (!orgSlug) return '/';

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

  return '/';
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
        const next = ((row.failure_count as number) ?? 0) + 1;
        await sb
          .from('push_subscriptions')
          .update({
            failure_count: next,
            disabled_at: next >= 5 ? new Date().toISOString() : null,
          })
          .eq('id', row.id);
      }
    }
  } catch (err) {
    console.error('[pushRecipients] reconcilePushFailures threw:', err);
  }
}
