import { describe, expect, it } from 'vitest';

import { notificationIconFor, notificationInboxPlatform, formatNotificationInboxPlatformLabel, formatNotificationGuestName, formatNotificationDisplayTitle, formatNotificationStayLabel, LEGACY_INBOX_NOTIFICATION_TITLE } from '@/features/dashboard/notifications/lib/notificationsDisplay';

describe('notificationIconFor', () => {

  it('notificationIconFor is exported', () => {
    expect(typeof notificationIconFor).toBe('function');
  });

});

describe('notificationInboxPlatform', () => {

  it('notificationInboxPlatform is exported', () => {
    expect(typeof notificationInboxPlatform).toBe('function');
  });

});

describe('formatNotificationInboxPlatformLabel', () => {

  it('formatNotificationInboxPlatformLabel is exported', () => {
    expect(typeof formatNotificationInboxPlatformLabel).toBe('function');
  });

});

describe('formatNotificationGuestName', () => {

  it('formatNotificationGuestName is exported', () => {
    expect(typeof formatNotificationGuestName).toBe('function');
  });

});

describe('formatNotificationDisplayTitle', () => {

  it('formatNotificationDisplayTitle is exported', () => {
    expect(typeof formatNotificationDisplayTitle).toBe('function');
  });

});

describe('formatNotificationStayLabel', () => {

  it('formatNotificationStayLabel is exported', () => {
    expect(typeof formatNotificationStayLabel).toBe('function');
  });

});

describe('LEGACY_INBOX_NOTIFICATION_TITLE', () => {
  it('is defined', () => {
    expect(LEGACY_INBOX_NOTIFICATION_TITLE).toBeDefined();
  });
});

