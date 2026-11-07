import { useNotificationPreferences } from '@/features/dashboard/notifications/hooks/useNotificationPreferences';
import {
  NOTIFICATION_PREFERENCE_GROUPS,
  NOTIFICATION_PREFERENCE_GROUP_LABELS,
  type NotificationPreferenceGroup,
} from '@/features/dashboard/notifications/lib/notificationPreferences';
import { NOTIFICATIONS_HELP_COPY } from '@/features/dashboard/notifications/lib/notificationsHelpCopy';

import { InfoHint } from '@/components/help/InfoHint';
import { NeedsConnectionHint } from '@/components/pwa/NeedsConnectionHint';
import { Switch } from '@/components/ui/switch';
import { useConnectivity } from '@/hooks/useConnectivity';

/**
 * What gets sent as an OS push. Absence of a row in `notification_preferences`
 * means "everything on", so every switch starts on for a new user. Rendered
 * inside the manage sheet, so it carries no card chrome of its own.
 */
export function NotificationPreferencesCard() {
  const { preferences, loading, saving, update } = useNotificationPreferences();
  const { connected, reason } = useConnectivity();
  const disabled = !connected || saving;

  const toggleGroup = (group: NotificationPreferenceGroup, enabled: boolean) => {
    const next = enabled
      ? preferences.mutedGroups.filter((g) => g !== group)
      : [...preferences.mutedGroups, group];
    const label = NOTIFICATION_PREFERENCE_GROUP_LABELS[group].label;
    update({ mutedGroups: next }, `${label} notifications ${enabled ? 'on' : 'off'}`);
  };

  if (loading) {
    return (
      <div>
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
    <div>
      <p className="text-foreground flex items-center gap-1 text-[13px] font-semibold leading-tight sm:text-sm">
        Push preferences
        <InfoHint
          label="Push preferences"
          text={NOTIFICATIONS_HELP_COPY.pushPreferences.hint}
          variant="section"
        />
      </p>

      <ul className="mt-2 divide-y">
        {NOTIFICATION_PREFERENCE_GROUPS.map((group) => {
          const enabled = !preferences.mutedGroups.includes(group);
          const copy = NOTIFICATION_PREFERENCE_GROUP_LABELS[group];
          return (
            <li key={group} className="flex items-center justify-between gap-3 py-2">
              <span className="text-foreground flex items-center gap-1 text-[13px] sm:text-sm">
                {copy.label}
                <InfoHint label={copy.label} text={copy.hint} />
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

      <NeedsConnectionHint reason={disabled && !connected ? reason : null} className="mt-2" />
    </div>
  );
}
