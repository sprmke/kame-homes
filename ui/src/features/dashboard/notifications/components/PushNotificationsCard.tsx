import { BellRing, Smartphone } from 'lucide-react';

import { NotificationMasterSwitchRow } from '@/features/dashboard/notifications/components/NotificationMasterSwitchRow';
import { ChannelSwitchSkeleton } from '@/features/dashboard/notifications/components/NotificationsChannelPanels';
import { usePushNotifications } from '@/features/dashboard/notifications/hooks/usePushNotifications';
import {
  PUSH_PREPARING_MESSAGE,
  pushUnsupportedMessage,
} from '@/features/dashboard/notifications/lib/pushStatus';

export type PushNotificationsState = ReturnType<typeof usePushNotifications>;

const SUBSCRIBED_DESCRIPTION = 'Booking, message and workflow alerts arrive on this device.';

type RowProps = {
  /** Owned by the Manage sheet so it can also decide what to show underneath. */
  push: PushNotificationsState;
  /** Surface overrides, e.g. `bg-card` when the row sits on a page content area. */
  className?: string;
};

/**
 * Per-device OS push opt-in. Web Push works on desktop Chrome/Edge/Firefox and
 * Android; on iOS/iPadOS it needs the app installed to the Home Screen first
 * (`needsInstallFirst`).
 *
 * Uses the same master row as Telegram delivery so both tabs read as one page,
 * and skeletons until the browser state is read (the first render would
 * otherwise claim push is unsupported).
 */
export function PushNotificationsRow({ push, className }: RowProps) {
  const {
    supported,
    reason,
    needsInstallFirst,
    permission,
    subscribed,
    ready,
    preparing,
    busy,
    enable,
    disable,
  } = push;

  if (!ready) return <ChannelSwitchSkeleton />;

  const blocked = permission === 'denied';

  let description = SUBSCRIBED_DESCRIPTION;
  let descriptionClassName: string | undefined;

  if (busy) {
    /* Keep the row honest while subscribing/unsubscribing instead of freezing silently. */
    description = 'Updating…';
  } else if (preparing) {
    /* First-load worker activation is expected: neutral copy, no red, no action. */
    description = PUSH_PREPARING_MESSAGE;
  } else if (!supported) {
    /*
     * The switch is disabled in this state, so the row itself has to explain why.
     * `!` so the tone wins over the muted `text-card-description` token.
     */
    description = pushUnsupportedMessage(reason);
    descriptionClassName = '!text-destructive';
  } else if (needsInstallFirst) {
    description =
      'Add this app to your Home Screen, then turn notifications on from the installed app.';
  } else if (blocked) {
    description =
      'Push notifications are blocked. Allow them for this site in your browser settings.';
    descriptionClassName = '!text-destructive';
  } else if (!subscribed) {
    description = 'Get booking, message and workflow alerts on this device when the app is closed.';
  }

  return (
    <NotificationMasterSwitchRow
      icon={needsInstallFirst ? Smartphone : BellRing}
      title="Push notifications"
      description={description}
      checked={subscribed}
      descriptionClassName={descriptionClassName}
      className={className}
      disabled={busy || !supported || needsInstallFirst || blocked}
      onCheckedChange={(next) => {
        if (next) void enable();
        else void disable();
      }}
    />
  );
}

/** Self-contained variant for surfaces that only render the row. */
export function PushNotificationsCard() {
  const push = usePushNotifications();
  return <PushNotificationsRow push={push} />;
}
