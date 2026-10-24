import { BellRing, Smartphone } from 'lucide-react';

import { usePushNotifications } from '@/features/dashboard/notifications/hooks/usePushNotifications';

import { Switch } from '@/components/ui/switch';

/**
 * Per-device OS push opt-in. Web Push works on desktop Chrome/Edge/Firefox and
 * Android; on iOS/iPadOS it needs the app installed to the Home Screen first
 * (`needsInstallFirst`).
 *
 * Collapses to a single row once this device is subscribed — the switch already
 * says it is on, so the explainer only earns its space when something is off.
 */
export function PushNotificationsCard() {
  const { supported, needsInstallFirst, permission, subscribed, busy, enable, disable } =
    usePushNotifications();

  const blocked = permission === 'denied';

  let status: string | null;
  if (needsInstallFirst) {
    status = 'Add this app to your Home Screen, then turn on notifications from the installed app.';
  } else if (!supported) {
    status = 'This browser doesn’t support push notifications.';
  } else if (blocked) {
    status = 'Notifications are blocked. Enable them for this site in your browser settings.';
  } else if (subscribed) {
    status = null;
  } else {
    status = 'Get booking, message, and workflow alerts on this device when the app is closed.';
  }

  return (
    <div className="border-border bg-card rounded-xl border px-3 py-3 sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-lg">
            {needsInstallFirst ? (
              <Smartphone className="size-3.5" />
            ) : (
              <BellRing className="size-3.5" />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-foreground text-[13px] font-semibold leading-tight sm:text-sm">
              Notifications on this device
            </p>
            {status ? <p className="text-card-description mt-0.5">{status}</p> : null}
          </div>
        </div>
        <Switch
          aria-label="Notifications on this device"
          checked={subscribed}
          disabled={busy || !supported || needsInstallFirst || blocked}
          onCheckedChange={(next) => {
            if (next) void enable();
            else void disable();
          }}
        />
      </div>
    </div>
  );
}
