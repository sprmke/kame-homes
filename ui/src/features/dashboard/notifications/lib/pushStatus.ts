import type { PushUnsupportedReason } from '@/lib/pwa/push';

/**
 * Shown while the background worker is still starting. This is a normal first
 * load, not an error, so it is muted and carries no action.
 */
export const PUSH_PREPARING_MESSAGE = 'Preparing push notifications on this device…';

/** Every unavailable state says the same two things: push is off, in-app still works. */
const IN_APP_STILL_WORKS = 'In-app notifications still arrive in Activity.';

/**
 * Plain-language reason push cannot be turned on. Shown in destructive red next
 * to a disabled switch, and always reassures that the in-app feed still works,
 * because "notifications" alone reads like everything is broken.
 */
export function pushUnsupportedMessage(reason?: PushUnsupportedReason | null): string {
  switch (reason) {
    case 'unsupported':
      return `This browser doesn't support push notifications. ${IN_APP_STILL_WORKS}`;
    case 'not-configured':
      return 'Push notifications are not available in this build.';
    case 'not-ready':
      return `Push notifications aren't available on this device right now. ${IN_APP_STILL_WORKS}`;
    default:
      return `Push notifications aren't available on this device. ${IN_APP_STILL_WORKS}`;
  }
}
