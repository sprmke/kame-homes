import { Moon } from 'lucide-react';

import { useNotificationPreferences } from '@/features/dashboard/notifications/hooks/useNotificationPreferences';
import {
  NOTIFICATION_PREFERENCE_GROUPS,
  NOTIFICATION_PREFERENCE_GROUP_LABELS,
  type NotificationPreferenceGroup,
} from '@/features/dashboard/notifications/lib/notificationPreferences';

import { NeedsConnectionHint } from '@/components/pwa/NeedsConnectionHint';
import { Switch } from '@/components/ui/switch';
import { useConnectivity } from '@/hooks/useConnectivity';

/**
 * What gets sent as an OS push. Absence of a row in `notification_preferences`
 * means "everything on", so every switch starts on for a new user.
 */
export function NotificationPreferencesCard() {
  const { preferences, loading, saving, update } = useNotificationPreferences();
  const { connected, reason } = useConnectivity();
  const disabled = !connected || saving;

  const toggleGroup = (group: NotificationPreferenceGroup, enabled: boolean) => {
    const next = enabled
      ? preferences.mutedGroups.filter((g) => g !== group)
      : [...preferences.mutedGroups, group];
    update({ mutedGroups: next });
  };

  const invalidQuietWindow =
    preferences.quietHoursEnabled && preferences.quietHoursStart === preferences.quietHoursEnd;

  if (loading) {
    return (
      <div className="border-border bg-card rounded-xl border px-3 py-3 sm:p-4">
        <div className="bg-muted h-4 w-32 animate-pulse rounded" />
        <div className="mt-3 space-y-2.5">
          {[0, 1, 2].map((row) => (
            <div key={row} className="bg-muted/70 h-7 animate-pulse rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="border-border bg-card rounded-xl border px-3 py-3 sm:p-4">
      <p className="text-foreground text-[13px] font-semibold leading-tight sm:text-sm">
        Push preferences
      </p>

      <ul className="mt-2 divide-y">
        {NOTIFICATION_PREFERENCE_GROUPS.map((group) => {
          const enabled = !preferences.mutedGroups.includes(group);
          return (
            <li key={group} className="flex items-center justify-between gap-3 py-2">
              <span className="text-foreground text-[13px] sm:text-sm">
                {NOTIFICATION_PREFERENCE_GROUP_LABELS[group].label}
              </span>
              <Switch
                aria-label={NOTIFICATION_PREFERENCE_GROUP_LABELS[group].label}
                checked={enabled}
                disabled={disabled}
                onCheckedChange={(next) => toggleGroup(group, next)}
              />
            </li>
          );
        })}
      </ul>

      <div className="mt-1 border-t pt-2">
        <div className="flex items-center justify-between gap-3 py-1">
          <span className="text-foreground flex items-center gap-1.5 text-[13px] sm:text-sm">
            <Moon className="text-muted-foreground size-3.5" aria-hidden />
            Quiet hours
          </span>
          <Switch
            aria-label="Quiet hours"
            checked={preferences.quietHoursEnabled}
            disabled={disabled}
            onCheckedChange={(enabled) => update({ quietHoursEnabled: enabled })}
          />
        </div>

        {preferences.quietHoursEnabled ? (
          <div className="mt-1 flex items-center gap-2 pb-1">
            <label className="sr-only" htmlFor="quiet-hours-start">
              Quiet hours start
            </label>
            <input
              id="quiet-hours-start"
              type="time"
              value={preferences.quietHoursStart}
              disabled={disabled}
              onChange={(event) => {
                if (event.target.value) update({ quietHoursStart: event.target.value });
              }}
              className="border-input bg-background h-9 rounded-md border px-2 text-sm"
            />
            <span className="text-muted-foreground text-xs">to</span>
            <label className="sr-only" htmlFor="quiet-hours-end">
              Quiet hours end
            </label>
            <input
              id="quiet-hours-end"
              type="time"
              value={preferences.quietHoursEnd}
              disabled={disabled}
              onChange={(event) => {
                if (event.target.value) update({ quietHoursEnd: event.target.value });
              }}
              className="border-input bg-background h-9 rounded-md border px-2 text-sm"
            />
          </div>
        ) : null}

        {invalidQuietWindow ? (
          <p className="text-muted-foreground text-xs" role="status">
            Start and end match, so quiet hours are off.
          </p>
        ) : null}

        <NeedsConnectionHint reason={disabled && !connected ? reason : null} className="mt-1" />
      </div>
    </div>
  );
}
