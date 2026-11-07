import { describe, expect, it } from 'vitest';

import {
  PUSH_PREPARING_MESSAGE,
  pushUnsupportedMessage,
} from '@/features/dashboard/notifications/lib/pushStatus';

describe('pushUnsupportedMessage', () => {
  it('names the browser limitation and reassures that in-app still works', () => {
    expect(pushUnsupportedMessage('unsupported')).toBe(
      "This browser doesn't support push notifications. In-app notifications still arrive in Activity."
    );
  });

  it('distinguishes a build without a VAPID key', () => {
    expect(pushUnsupportedMessage('not-configured')).toBe(
      'Push notifications are not available in this build.'
    );
  });

  it('states the limitation without asking for a reload', () => {
    expect(pushUnsupportedMessage('not-ready')).toBe(
      "Push notifications aren't available on this device right now. In-app notifications still arrive in Activity."
    );
  });

  it('has a neutral preparing line for the transient worker start', () => {
    expect(PUSH_PREPARING_MESSAGE).toBe('Preparing push notifications on this device…');
  });

  it('falls back when the state did not carry a reason', () => {
    const fallback =
      "Push notifications aren't available on this device. In-app notifications still arrive in Activity.";
    expect(pushUnsupportedMessage(null)).toBe(fallback);
    expect(pushUnsupportedMessage(undefined)).toBe(fallback);
  });
});
