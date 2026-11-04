/**
 * Per-user OS push preferences (type groups + quiet hours).
 *
 * Mirrors `supabase/functions/_shared/notificationPreferences.ts`: the group keys,
 * the default window, and the type-to-group mapping must stay identical. A Vitest
 * drift test reads the Deno source and fails when they diverge.
 *
 * Only the OS push is filtered. The in-app bell keeps every notification.
 */
import { scopedFunctionsUrl } from '@/features/dashboard/org/lib/adminApiScope';
import { getSessionJwt } from '@/features/dashboard/org/lib/edgeClient';

export const NOTIFICATION_PREFERENCE_GROUPS = [
  'bookings',
  'inbox',
  'reviews',
  'pricing',
  'finance',
  'maintenance',
  'analytics',
  'system',
] as const;

export type NotificationPreferenceGroup = (typeof NOTIFICATION_PREFERENCE_GROUPS)[number];

export type NotificationPreferences = {
  mutedGroups: NotificationPreferenceGroup[];
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  quietHoursTimezone: string;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  mutedGroups: [],
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  quietHoursTimezone: 'Asia/Manila',
};

export const NOTIFICATION_PREFERENCE_GROUP_LABELS: Record<
  NotificationPreferenceGroup,
  { label: string; hint: string }
> = {
  bookings: { label: 'Bookings', hint: 'New requests, check-ins, checkouts, refunds' },
  inbox: { label: 'Messages', hint: 'Guest messages and inbox replies' },
  reviews: { label: 'Reviews', hint: 'New reviews and review reminders' },
  pricing: { label: 'Pricing', hint: 'Smart pricing and calendar sync' },
  finance: { label: 'Finance', hint: 'Payouts, refunds, and payments' },
  maintenance: { label: 'Maintenance', hint: 'Guest-reported and status changes' },
  analytics: { label: 'Analytics', hint: 'Review rollups and weekly summaries' },
  system: { label: 'System', hint: 'Settings copies and platform announcements' },
};

export const NOTIFICATION_PREFERENCES_QUERY_KEY = ['notification-preferences'] as const;

type EdgeJson = {
  success?: boolean;
  error?: string;
  data?: { preferences?: unknown };
};

export function normalizeNotificationPreferences(raw: unknown): NotificationPreferences {
  const row = (raw ?? {}) as Record<string, unknown>;
  const muted = Array.isArray(row.mutedGroups)
    ? row.mutedGroups.filter((g): g is NotificationPreferenceGroup =>
        (NOTIFICATION_PREFERENCE_GROUPS as readonly string[]).includes(String(g))
      )
    : [];
  return {
    mutedGroups: [...new Set(muted)],
    quietHoursEnabled: row.quietHoursEnabled === true,
    quietHoursStart:
      typeof row.quietHoursStart === 'string' ? row.quietHoursStart : '22:00',
    quietHoursEnd: typeof row.quietHoursEnd === 'string' ? row.quietHoursEnd : '07:00',
    quietHoursTimezone:
      typeof row.quietHoursTimezone === 'string' ? row.quietHoursTimezone : 'Asia/Manila',
  };
}

async function parse(res: Response): Promise<NotificationPreferences> {
  const json = (await res.json().catch(() => ({}))) as EdgeJson;
  if (!res.ok || !json.success) throw new Error(json.error ?? 'Request failed');
  return normalizeNotificationPreferences(json.data?.preferences);
}

export async function fetchNotificationPreferences(): Promise<NotificationPreferences> {
  const jwt = await getSessionJwt();
  const res = await fetch(scopedFunctionsUrl('/notification-preferences', null), {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  return parse(res);
}

export async function saveNotificationPreferences(
  preferences: NotificationPreferences
): Promise<NotificationPreferences> {
  const jwt = await getSessionJwt();
  const res = await fetch(scopedFunctionsUrl('/notification-preferences', null), {
    method: 'PUT',
    headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(preferences),
  });
  return parse(res);
}
