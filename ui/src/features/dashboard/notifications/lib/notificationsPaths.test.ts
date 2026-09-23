import { describe, expect, it } from 'vitest';

import { resolveNotificationPath, notificationsHubActivityHash, useNotificationsHubPath, IN_APP_NOTIFICATIONS_SECTION_ID, IN_APP_NOTIFICATIONS_NAV_GROUP_LABEL } from '@/features/dashboard/notifications/lib/notificationsPaths';

describe('resolveNotificationPath', () => {

  it('resolveNotificationPath is exported', () => {
    expect(typeof resolveNotificationPath).toBe('function');
  });

});

describe('notificationsHubActivityHash', () => {

  it('notificationsHubActivityHash is exported', () => {
    expect(typeof notificationsHubActivityHash).toBe('function');
  });

});

describe('useNotificationsHubPath', () => {

  it('useNotificationsHubPath is exported', () => {
    expect(typeof useNotificationsHubPath).toBe('function');
  });

});

describe('IN_APP_NOTIFICATIONS_SECTION_ID', () => {
  it('is defined', () => {
    expect(IN_APP_NOTIFICATIONS_SECTION_ID).toBeDefined();
  });
});

describe('IN_APP_NOTIFICATIONS_NAV_GROUP_LABEL', () => {
  it('is defined', () => {
    expect(IN_APP_NOTIFICATIONS_NAV_GROUP_LABEL).toBeDefined();
  });
});
