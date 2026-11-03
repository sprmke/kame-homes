/**
 * notification-preferences — read and save the caller's OS push preferences.
 *
 * Per-user, not per-org: the row is keyed by `user_id` only (migration
 * 20261316129000_notification_preferences.sql). The Notifications page calls
 * this; `push-fanout` reads the same row with the service client.
 *
 * activity-log: N/A — a personal device preference, not organization data.
 */
import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import {
  loadNotificationPreferences,
  normalizeNotificationPreferences,
  parseNotificationPreferencesPayload,
} from '../_shared/notificationPreferences.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

const PREFERENCE_COLUMNS =
  'muted_groups, quiet_hours_enabled, quiet_hours_start, quiet_hours_end, quiet_hours_timezone';

serveAuthenticated('notification-preferences', async (req, user) => {
  const sb = createServiceClient();

  if (req.method === 'GET') {
    const preferences = await loadNotificationPreferences(sb, user.id);
    return jsonSuccess(req, { preferences });
  }

  if (req.method !== 'PUT') return jsonError(req, 'Method not allowed', 405);
  const parsed = parseNotificationPreferencesPayload(await readJsonBody(req));
  if (!parsed.ok) return jsonError(req, parsed.error);
  const value = parsed.value;

  const { data, error } = await sb
    .from('notification_preferences')
    .upsert(
      {
        user_id: user.id,
        muted_groups: value.mutedGroups,
        quiet_hours_enabled: value.quietHoursEnabled,
        // Postgres `time` accepts HH:MM; keep seconds explicit for clarity.
        quiet_hours_start: `${value.quietHoursStart}:00`,
        quiet_hours_end: `${value.quietHoursEnd}:00`,
        quiet_hours_timezone: value.quietHoursTimezone,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select(PREFERENCE_COLUMNS)
    .maybeSingle();

  if (error) return jsonError(req, error.message, 500);
  return jsonSuccess(req, {
    preferences: normalizeNotificationPreferences(data as Record<string, unknown> | null),
  });
});
