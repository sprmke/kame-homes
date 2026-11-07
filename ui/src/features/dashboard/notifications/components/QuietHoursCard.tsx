import { useId } from 'react';

import { useNotificationPreferences } from '@/features/dashboard/notifications/hooks/useNotificationPreferences';
import { formatQuietHoursTime } from '@/features/dashboard/notifications/lib/notificationPreferences';

import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useConnectivity } from '@/hooks/useConnectivity';

/**
 * Quiet hours is a schedule, not a notification group, so it sits in its own
 * section below Push preferences instead of as a ninth switch in that list.
 * Times are saved in the stored IANA zone; start === end means "no window".
 */
export function QuietHoursCard() {
  const fieldId = useId();
  const headingId = `${fieldId}-heading`;
  const startId = `${fieldId}-start`;
  const endId = `${fieldId}-end`;
  const { preferences, loading, saving, update } = useNotificationPreferences();
  const { connected } = useConnectivity();
  const disabled = !connected || saving;

  const invalidWindow =
    preferences.quietHoursEnabled && preferences.quietHoursStart === preferences.quietHoursEnd;

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-between gap-3">
          <div className="bg-muted h-4 w-28 animate-pulse rounded" />
          <div className="bg-muted h-6 w-11 animate-pulse rounded-full" />
        </div>
        <div className="bg-muted/70 mt-2 h-3 w-56 animate-pulse rounded" />
      </div>
    );
  }

  return (
    <section aria-labelledby={headingId}>
      <div className="flex items-center justify-between gap-3">
        <h3
          id={headingId}
          className="text-foreground text-[13px] font-semibold leading-tight sm:text-sm"
        >
          Quiet hours
        </h3>
        <Switch
          aria-label="Quiet hours"
          checked={preferences.quietHoursEnabled}
          disabled={disabled}
          onCheckedChange={(enabled) =>
            update({ quietHoursEnabled: enabled }, enabled ? 'Quiet hours on' : 'Quiet hours off')
          }
        />
      </div>

      <p className="text-card-description mt-0.5">
        {preferences.quietHoursEnabled && !invalidWindow
          ? `Phone push is paused from ${formatQuietHoursTime(preferences.quietHoursStart)} to ${formatQuietHoursTime(preferences.quietHoursEnd)}.`
          : 'Pause phone push alerts during a window.'}
      </p>

      {preferences.quietHoursEnabled ? (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="settings-field-label" htmlFor={startId}>
                From
              </label>
              <Input
                id={startId}
                type="time"
                value={preferences.quietHoursStart}
                disabled={disabled}
                aria-invalid={invalidWindow || undefined}
                onChange={(event) => {
                  if (event.target.value) update({ quietHoursStart: event.target.value });
                }}
              />
            </div>
            <div className="space-y-1.5">
              <label className="settings-field-label" htmlFor={endId}>
                To
              </label>
              <Input
                id={endId}
                type="time"
                value={preferences.quietHoursEnd}
                disabled={disabled}
                aria-invalid={invalidWindow || undefined}
                onChange={(event) => {
                  if (event.target.value) update({ quietHoursEnd: event.target.value });
                }}
              />
            </div>
          </div>

          {invalidWindow ? (
            <p className="text-destructive text-xs" role="alert">
              From and To can’t be the same time.
            </p>
          ) : (
            <p className="text-muted-foreground text-xs">
              Times use {preferences.quietHoursTimezone.replace(/_/g, ' ')}.
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}
