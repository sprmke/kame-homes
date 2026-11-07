import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  formatQuietHoursTime,
  NOTIFICATION_PREFERENCE_GROUP_LABELS,
  NOTIFICATION_PREFERENCE_GROUPS,
  normalizeNotificationPreferences,
} from '@/features/dashboard/notifications/lib/notificationPreferences';

/**
 * The UI list and the edge function list must be the same, or a group can be
 * muted in the browser and then ignored by `push-fanout` (or vice versa). There
 * is no shared package between Vite and Deno, so this test reads the server
 * source and compares the literal arrays.
 */
const SERVER_SOURCE = join(
  __dirname,
  '../../../../../../supabase/functions/_shared/notificationPreferences.ts'
);

function serverGroups(): string[] {
  const source = readFileSync(SERVER_SOURCE, 'utf8');
  const match = /NOTIFICATION_PREFERENCE_GROUPS\s*=\s*\[([\s\S]*?)\]\s*as const/.exec(source);
  if (!match) throw new Error('Could not find NOTIFICATION_PREFERENCE_GROUPS in the server module');
  return [...match[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
}

describe('notification preferences parity', () => {
  it('UI and edge group lists match', () => {
    expect([...NOTIFICATION_PREFERENCE_GROUPS]).toEqual(serverGroups());
  });

  it('every group has a UI label', () => {
    for (const group of NOTIFICATION_PREFERENCE_GROUPS) {
      expect(NOTIFICATION_PREFERENCE_GROUP_LABELS[group]?.label).toBeTruthy();
    }
  });

  it('defaults match the server defaults', () => {
    const source = readFileSync(SERVER_SOURCE, 'utf8');
    for (const [key, value] of Object.entries(DEFAULT_NOTIFICATION_PREFERENCES)) {
      if (key === 'mutedGroups') continue;
      expect(source).toContain(String(value));
    }
  });

  it('normalize tolerates missing and malformed rows', () => {
    expect(normalizeNotificationPreferences(null)).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
    expect(
      normalizeNotificationPreferences({
        mutedGroups: ['inbox', 'inbox', 'nope'],
        quietHoursEnabled: true,
        quietHoursStart: '21:30',
        quietHoursEnd: '07:00',
        quietHoursTimezone: 'Asia/Manila',
      })
    ).toEqual({
      mutedGroups: ['inbox'],
      quietHoursEnabled: true,
      quietHoursStart: '21:30',
      quietHoursEnd: '07:00',
      quietHoursTimezone: 'Asia/Manila',
    });
  });

  it('formatQuietHoursTime renders 12-hour time and leaves bad input alone', () => {
    expect(formatQuietHoursTime('22:00')).toBe('10:00 PM');
    expect(formatQuietHoursTime('07:30')).toBe('7:30 AM');
    expect(formatQuietHoursTime('00:15')).toBe('12:15 AM');
    expect(formatQuietHoursTime('12:00')).toBe('12:00 PM');
    expect(formatQuietHoursTime('soon')).toBe('soon');
  });
});
