/**
 * Per-user OS push preferences: muted type groups and quiet hours.
 *
 * Only the OS push is filtered. In-app `notifications` rows are the complete
 * record and stay visible in the bell, so a muted group still has its unread
 * badge; the user simply is not buzzed on their phone.
 *
 * Plan: docs/workflow/in-progress/pwa-v2-native-app-experience.md (Phase 6.2)
 */
import type { SupabaseClient } from './supabaseJs.ts';

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
  /** `HH:MM` in `quietHoursTimezone`. */
  quietHoursStart: string;
  /** `HH:MM` in `quietHoursTimezone`. */
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

/**
 * Operational alerts that must break through quiet hours. A silently failing
 * calendar sync is the one case where a 3am buzz is worth it.
 */
const QUIET_HOURS_BYPASS_TYPES = new Set(['calendar_sync_failing']);

/** Map a notification type onto one preference group. Unknown types are `system`. */
export function notificationTypeGroup(type: string): NotificationPreferenceGroup {
  if (type.startsWith('booking_') || type === 'calendar_conflict') return 'bookings';
  if (type.startsWith('inbox_')) return 'inbox';
  if (type.startsWith('review_')) return 'reviews';
  if (type.startsWith('smart_pricing') || type.startsWith('calendar_sync')) return 'pricing';
  if (type.startsWith('finance_') || type.includes('refund') || type.includes('payment')) {
    return 'finance';
  }
  if (type.startsWith('maintenance_')) return 'maintenance';
  if (type.startsWith('analytics_')) return 'analytics';
  return 'system';
}

function isGroup(value: unknown): value is NotificationPreferenceGroup {
  return (
    typeof value === 'string' &&
    (NOTIFICATION_PREFERENCE_GROUPS as readonly string[]).includes(value)
  );
}

/** Postgres `time` arrives as `HH:MM:SS`; accept `HH:MM` too. */
export function normalizeTimeValue(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
  if (!match) return fallback;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return fallback;
  return `${match[1]}:${match[2]}`;
}

export function isValidTimeValue(value: unknown): value is string {
  return normalizeTimeValue(value, '') !== '';
}

function minutesOfDay(value: string): number {
  const normalized = normalizeTimeValue(value, '00:00');
  const [hours, minutes] = normalized.split(':').map(Number);
  return hours * 60 + minutes;
}

/** Minutes since local midnight for `now` in `timeZone`, or `null` if the zone is invalid. */
export function localMinutesOfDay(now: Date, timeZone: string): number | null {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now);
    const hour = Number(parts.find((p) => p.type === 'hour')?.value);
    const minute = Number(parts.find((p) => p.type === 'minute')?.value);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    // Some ICU builds emit `24` for midnight.
    return ((hour % 24) * 60 + minute) % (24 * 60);
  } catch {
    return null;
  }
}

/**
 * Quiet hours window. `start > end` wraps midnight; `start === end` means "no
 * window" so a mis-set form can never silence push for the whole day. The start
 * is inclusive, the end exclusive.
 */
export function isWithinQuietHours(now: Date, prefs: NotificationPreferences): boolean {
  if (!prefs.quietHoursEnabled) return false;
  const start = minutesOfDay(prefs.quietHoursStart);
  const end = minutesOfDay(prefs.quietHoursEnd);
  if (start === end) return false;
  const current = localMinutesOfDay(now, prefs.quietHoursTimezone);
  if (current === null) return false;
  return start < end ? current >= start && current < end : current >= start || current < end;
}

/** Should this notification produce an OS push for a user with these preferences? */
export function shouldDeliverPush(
  type: string,
  prefs: NotificationPreferences,
  now: Date = new Date()
): { deliver: boolean; reason?: 'muted_group' | 'quiet_hours' } {
  const group = notificationTypeGroup(type);
  if (prefs.mutedGroups.includes(group)) return { deliver: false, reason: 'muted_group' };
  if (!QUIET_HOURS_BYPASS_TYPES.has(type) && isWithinQuietHours(now, prefs)) {
    return { deliver: false, reason: 'quiet_hours' };
  }
  return { deliver: true };
}

export function normalizeNotificationPreferences(
  row: Record<string, unknown> | null | undefined
): NotificationPreferences {
  if (!row) return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  const muted = Array.isArray(row.muted_groups) ? row.muted_groups.filter(isGroup) : [];
  return {
    mutedGroups: [...new Set(muted)],
    quietHoursEnabled: row.quiet_hours_enabled === true,
    quietHoursStart: normalizeTimeValue(
      row.quiet_hours_start,
      DEFAULT_NOTIFICATION_PREFERENCES.quietHoursStart
    ),
    quietHoursEnd: normalizeTimeValue(
      row.quiet_hours_end,
      DEFAULT_NOTIFICATION_PREFERENCES.quietHoursEnd
    ),
    quietHoursTimezone:
      typeof row.quiet_hours_timezone === 'string' && row.quiet_hours_timezone.trim()
        ? row.quiet_hours_timezone.trim()
        : DEFAULT_NOTIFICATION_PREFERENCES.quietHoursTimezone,
  };
}

/** Preferences for one user; defaults when they have never saved any. */
export async function loadNotificationPreferences(
  sb: SupabaseClient,
  userId: string
): Promise<NotificationPreferences> {
  const { data, error } = await sb
    .from('notification_preferences')
    .select('muted_groups, quiet_hours_enabled, quiet_hours_start, quiet_hours_end, quiet_hours_timezone')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.error('[notificationPreferences] load failed:', error.message);
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }
  return normalizeNotificationPreferences(data as Record<string, unknown> | null);
}

/** Preferences for a batch of users; missing users fall back to defaults. */export async function loadNotificationPreferencesForUsers(
  sb: SupabaseClient,
  userIds: string[]
): Promise<Map<string, NotificationPreferences>> {
  const map = new Map<string, NotificationPreferences>();
  for (const id of userIds) map.set(id, { ...DEFAULT_NOTIFICATION_PREFERENCES });
  if (userIds.length === 0) return map;

  const { data, error } = await sb
    .from('notification_preferences')
    .select('user_id, muted_groups, quiet_hours_enabled, quiet_hours_start, quiet_hours_end, quiet_hours_timezone')
    .in('user_id', userIds);
  if (error) {
    console.error('[notificationPreferences] batch load failed:', error.message);
    return map;
  }
  for (const row of data ?? []) {
    const id = (row as { user_id?: string }).user_id;
    if (id) map.set(id, normalizeNotificationPreferences(row as Record<string, unknown>));
  }
  return map;
}

const GROUP_SET = new Set<string>(NOTIFICATION_PREFERENCE_GROUPS);

function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: value.trim() });
    return true;
  } catch {
    return false;
  }
}

export type NotificationPreferencesPayload = {
  mutedGroups: NotificationPreferenceGroup[];
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  quietHoursTimezone: string;
};

/**
 * Validate a PUT body. Unknown groups are rejected (a typo must not silently
 * mute nothing), times must be `HH:MM`, and the zone must be a real IANA name.
 */
export function parseNotificationPreferencesPayload(
  body: Record<string, unknown>
): { ok: true; value: NotificationPreferencesPayload } | { ok: false; error: string } {
  const rawGroups = body.mutedGroups === undefined ? [] : body.mutedGroups;
  if (!Array.isArray(rawGroups)) return { ok: false, error: 'mutedGroups must be an array' };

  const mutedGroups: NotificationPreferenceGroup[] = [];
  for (const entry of rawGroups) {
    if (typeof entry !== 'string' || !GROUP_SET.has(entry)) {
      return { ok: false, error: `Unknown notification group: ${String(entry)}` };
    }
    const group = entry as NotificationPreferenceGroup;
    if (!mutedGroups.includes(group)) mutedGroups.push(group);
  }

  const start =
    body.quietHoursStart === undefined
      ? DEFAULT_NOTIFICATION_PREFERENCES.quietHoursStart
      : isValidTimeValue(body.quietHoursStart)
        ? body.quietHoursStart
        : null;
  if (!start) return { ok: false, error: 'quietHoursStart must be HH:MM' };

  const end =
    body.quietHoursEnd === undefined
      ? DEFAULT_NOTIFICATION_PREFERENCES.quietHoursEnd
      : isValidTimeValue(body.quietHoursEnd)
        ? body.quietHoursEnd
        : null;
  if (!end) return { ok: false, error: 'quietHoursEnd must be HH:MM' };

  const zone =
    body.quietHoursTimezone === undefined
      ? DEFAULT_NOTIFICATION_PREFERENCES.quietHoursTimezone
      : body.quietHoursTimezone;
  if (!isValidTimeZone(zone)) {
    return { ok: false, error: 'quietHoursTimezone must be a valid IANA zone' };
  }

  return {
    ok: true,
    value: {
      mutedGroups,
      quietHoursEnabled: body.quietHoursEnabled === true,
      quietHoursStart: start,
      quietHoursEnd: end,
      quietHoursTimezone: zone.trim(),
    },
  };
}
