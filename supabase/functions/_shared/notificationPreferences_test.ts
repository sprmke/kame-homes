/**
 * Pure preference logic for the push fan-out (Phase 6.2).
 *
 * Grouping, quiet-hours windows (including the midnight wrap and the
 * `start === end` guard), the bypass list, and normalization of Postgres rows.
 * DB-backed loaders are covered by the handler tests.
 */
import { assertEquals } from 'jsr:@std/assert@1';

import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  isWithinQuietHours,
  localMinutesOfDay,
  normalizeNotificationPreferences,
  normalizeTimeValue,
  notificationTypeGroup,
  shouldDeliverPush,
  type NotificationPreferences,
} from './notificationPreferences.ts';

function prefs(patch: Partial<NotificationPreferences> = {}): NotificationPreferences {
  return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...patch };
}

/** Asia/Manila is UTC+8, no DST — easy to reason about in fixtures. */
function manila(hour: number, minute = 0): Date {
  return new Date(Date.UTC(2026, 0, 15, hour - 8, minute));
}

Deno.test('notificationTypeGroup covers every shipped type', () => {
  assertEquals(notificationTypeGroup('booking_pending_review'), 'bookings');
  assertEquals(notificationTypeGroup('booking_external_imported'), 'bookings');
  assertEquals(notificationTypeGroup('calendar_conflict'), 'bookings');
  assertEquals(notificationTypeGroup('inbox_new_message'), 'inbox');
  assertEquals(notificationTypeGroup('review_received'), 'reviews');
  assertEquals(notificationTypeGroup('review_due'), 'reviews');
  assertEquals(notificationTypeGroup('smart_pricing_updated'), 'pricing');
  assertEquals(notificationTypeGroup('calendar_sync_failing'), 'pricing');
  assertEquals(notificationTypeGroup('booking_sd_refund_due'), 'bookings');
  assertEquals(notificationTypeGroup('finance_payout_ready'), 'finance');
  assertEquals(notificationTypeGroup('maintenance_guest_reported'), 'maintenance');
  assertEquals(notificationTypeGroup('analytics_review_updated'), 'analytics');
  assertEquals(notificationTypeGroup('property_settings_copied'), 'system');
  assertEquals(notificationTypeGroup('platform_announcement'), 'system');
});

Deno.test('quiet hours: overnight window wraps midnight', () => {
  const p = prefs({ quietHoursEnabled: true, quietHoursStart: '22:00', quietHoursEnd: '07:00' });
  assertEquals(isWithinQuietHours(manila(23), p), true);
  assertEquals(isWithinQuietHours(manila(2), p), true);
  assertEquals(isWithinQuietHours(manila(6, 59), p), true);
  assertEquals(isWithinQuietHours(manila(7), p), false);
  assertEquals(isWithinQuietHours(manila(12), p), false);
  assertEquals(isWithinQuietHours(manila(21, 59), p), false);
  assertEquals(isWithinQuietHours(manila(22), p), true);
});

Deno.test('quiet hours: daytime window does not wrap', () => {
  const p = prefs({ quietHoursEnabled: true, quietHoursStart: '09:00', quietHoursEnd: '17:00' });
  assertEquals(isWithinQuietHours(manila(8, 59), p), false);
  assertEquals(isWithinQuietHours(manila(9), p), true);
  assertEquals(isWithinQuietHours(manila(16, 59), p), true);
  assertEquals(isWithinQuietHours(manila(17), p), false);
});

Deno.test('quiet hours: disabled, equal endpoints, and invalid zones never silence', () => {
  assertEquals(isWithinQuietHours(manila(23), prefs({ quietHoursEnabled: false })), false);
  assertEquals(
    isWithinQuietHours(
      manila(23),
      prefs({ quietHoursEnabled: true, quietHoursStart: '22:00', quietHoursEnd: '22:00' })
    ),
    false
  );
  assertEquals(
    isWithinQuietHours(
      manila(23),
      prefs({
        quietHoursEnabled: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00',
        quietHoursTimezone: 'Not/AZone',
      })
    ),
    false
  );
});

Deno.test('quiet hours use the stored zone, not the server zone', () => {
  // 23:00 UTC is 07:00 the next day in Manila → outside 22:00-07:00.
  assertEquals(localMinutesOfDay(new Date(Date.UTC(2026, 0, 15, 23)), 'Asia/Manila'), 7 * 60);
  assertEquals(isWithinQuietHours(new Date(Date.UTC(2026, 0, 15, 23)), prefs({
    quietHoursEnabled: true,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
  })), false);
});

Deno.test('shouldDeliverPush: muted group wins over quiet hours', () => {
  const now = manila(23);
  const p = prefs({
    mutedGroups: ['reviews'],
    quietHoursEnabled: true,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
  });
  assertEquals(shouldDeliverPush('review_received', p, now), {
    deliver: false,
    reason: 'muted_group',
  });
  assertEquals(shouldDeliverPush('booking_pending_review', p, now), {
    deliver: false,
    reason: 'quiet_hours',
  });
  assertEquals(shouldDeliverPush('booking_pending_review', p, manila(12)), { deliver: true });
});

Deno.test('shouldDeliverPush: calendar failure bypasses quiet hours but not a mute', () => {
  const now = manila(2);
  const p = prefs({ quietHoursEnabled: true, quietHoursStart: '22:00', quietHoursEnd: '07:00' });
  assertEquals(shouldDeliverPush('calendar_sync_failing', p, now), { deliver: true });
  assertEquals(
    shouldDeliverPush('calendar_sync_failing', { ...p, mutedGroups: ['pricing'] }, now),
    { deliver: false, reason: 'muted_group' }
  );
});

Deno.test('normalizeNotificationPreferences tolerates missing and malformed rows', () => {
  assertEquals(normalizeNotificationPreferences(null), DEFAULT_NOTIFICATION_PREFERENCES);
  assertEquals(
    normalizeNotificationPreferences({
      muted_groups: ['inbox', 'inbox', 'nope'],
      quiet_hours_enabled: true,
      quiet_hours_start: '21:30:00',
      quiet_hours_end: '25:00',
      quiet_hours_timezone: '',
    }),
    {
      mutedGroups: ['inbox'],
      quietHoursEnabled: true,
      quietHoursStart: '21:30',
      quietHoursEnd: '07:00',
      quietHoursTimezone: 'Asia/Manila',
    }
  );
});

Deno.test('normalizeTimeValue rejects out-of-range values', () => {
  assertEquals(normalizeTimeValue('07:05', '00:00'), '07:05');
  assertEquals(normalizeTimeValue('07:05:00', '00:00'), '07:05');
  assertEquals(normalizeTimeValue('24:00', '00:00'), '00:00');
  assertEquals(normalizeTimeValue('7:05', '00:00'), '00:00');
  assertEquals(normalizeTimeValue(undefined, '09:00'), '09:00');
});

Deno.test('parseNotificationPreferencesPayload accepts defaults and full payloads', async () => {
  const { parseNotificationPreferencesPayload } = await import(
    './notificationPreferences.ts'
  );
  assertEquals(parseNotificationPreferencesPayload({}), {
    ok: true,
    value: {
      mutedGroups: [],
      quietHoursEnabled: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
      quietHoursTimezone: 'Asia/Manila',
    },
  });
  assertEquals(
    parseNotificationPreferencesPayload({
      mutedGroups: ['inbox', 'inbox', 'finance'],
      quietHoursEnabled: true,
      quietHoursStart: '21:30',
      quietHoursEnd: '06:15',
      quietHoursTimezone: 'Asia/Manila',
    }),
    {
      ok: true,
      value: {
        mutedGroups: ['inbox', 'finance'],
        quietHoursEnabled: true,
        quietHoursStart: '21:30',
        quietHoursEnd: '06:15',
        quietHoursTimezone: 'Asia/Manila',
      },
    }
  );
});

Deno.test('parseNotificationPreferencesPayload rejects unknown groups and bad times', async () => {
  const { parseNotificationPreferencesPayload } = await import(
    './notificationPreferences.ts'
  );
  assertEquals(parseNotificationPreferencesPayload({ mutedGroups: ['nope'] }).ok, false);
  assertEquals(parseNotificationPreferencesPayload({ mutedGroups: 'inbox' }).ok, false);
  assertEquals(parseNotificationPreferencesPayload({ quietHoursStart: '9:00' }).ok, false);
  assertEquals(parseNotificationPreferencesPayload({ quietHoursEnd: '24:00' }).ok, false);
  assertEquals(parseNotificationPreferencesPayload({ quietHoursTimezone: 'Mars/Base' }).ok, false);
});
