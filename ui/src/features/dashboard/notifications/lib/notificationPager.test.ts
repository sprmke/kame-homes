import { describe, expect, it } from 'vitest';

import {
  INITIAL_NOTIFICATION_PAGER,
  notificationPagerCanGoNewer,
  notificationPagerCursor,
  notificationPagerGoNewer,
  notificationPagerGoOlder,
  notificationPagerPageNumber,
} from '@/features/dashboard/notifications/lib/notificationPager';

describe('notificationPager', () => {
  it('starts on the newest page with no cursor', () => {
    expect(notificationPagerCursor(INITIAL_NOTIFICATION_PAGER)).toBeNull();
    expect(notificationPagerPageNumber(INITIAL_NOTIFICATION_PAGER)).toBe(1);
    expect(notificationPagerCanGoNewer(INITIAL_NOTIFICATION_PAGER)).toBe(false);
  });

  it('walks older and back without losing cursors', () => {
    const page2 = notificationPagerGoOlder(INITIAL_NOTIFICATION_PAGER, 'cursor-a');
    expect(page2).toEqual({ cursors: [null, 'cursor-a'], pageIndex: 1 });

    const page3 = notificationPagerGoOlder(page2, 'cursor-b');
    expect(notificationPagerCursor(page3)).toBe('cursor-b');

    const backToPage2 = notificationPagerGoNewer(page3);
    expect(notificationPagerCursor(backToPage2)).toBe('cursor-a');

    const backToNewest = notificationPagerGoNewer(backToPage2);
    expect(notificationPagerCursor(backToNewest)).toBeNull();
    expect(notificationPagerPageNumber(backToNewest)).toBe(1);
    expect(notificationPagerCanGoNewer(backToNewest)).toBe(false);
  });

  it('does not move when the server has nothing older', () => {
    expect(notificationPagerGoOlder(INITIAL_NOTIFICATION_PAGER, null)).toBe(
      INITIAL_NOTIFICATION_PAGER
    );
    expect(notificationPagerGoOlder(INITIAL_NOTIFICATION_PAGER, undefined)).toBe(
      INITIAL_NOTIFICATION_PAGER
    );
  });

  it('drops forward cursors when walking older from a back-stepped page', () => {
    const page3 = notificationPagerGoOlder(
      notificationPagerGoOlder(INITIAL_NOTIFICATION_PAGER, 'cursor-a'),
      'cursor-b'
    );
    const freshPage3 = notificationPagerGoOlder(notificationPagerGoNewer(page3), 'cursor-c');
    expect(freshPage3).toEqual({ cursors: [null, 'cursor-a', 'cursor-c'], pageIndex: 2 });
  });
});
