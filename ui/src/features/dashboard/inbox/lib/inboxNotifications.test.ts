import { describe, expect, it } from 'vitest';

import { inboxNotificationsSupported, inboxNotificationsEnabled, notifyInboxNewMessage } from '@/features/dashboard/inbox/lib/inboxNotifications';

describe('inboxNotificationsSupported', () => {

  it('inboxNotificationsSupported is exported', () => {
    expect(typeof inboxNotificationsSupported).toBe('function');
  });

});

describe('inboxNotificationsEnabled', () => {

  it('inboxNotificationsEnabled is exported', () => {
    expect(typeof inboxNotificationsEnabled).toBe('function');
  });

});

describe('notifyInboxNewMessage', () => {

  it('notifyInboxNewMessage is exported', () => {
    expect(typeof notifyInboxNewMessage).toBe('function');
  });

});
