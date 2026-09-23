import { describe, expect, it } from 'vitest';

import { HOST_ANNOUNCEMENTS_PAGE_SUBTITLE } from '@/features/dashboard/announcements/lib/hostAnnouncementCopy';

describe('HOST_ANNOUNCEMENTS_PAGE_SUBTITLE', () => {
  it('is defined', () => {
    expect(HOST_ANNOUNCEMENTS_PAGE_SUBTITLE).toBeDefined();
  });
});
