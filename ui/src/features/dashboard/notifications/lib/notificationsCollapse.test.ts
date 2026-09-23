import { describe, expect, it } from 'vitest';

import { collapseInboxNotifications, countCollapsedUnread } from '@/features/dashboard/notifications/lib/notificationsCollapse';

describe('collapseInboxNotifications', () => {

  it('collapseInboxNotifications is exported', () => {
    expect(typeof collapseInboxNotifications).toBe('function');
  });

});

describe('countCollapsedUnread', () => {

  it('countCollapsedUnread is exported', () => {
    expect(typeof countCollapsedUnread).toBe('function');
  });

});
