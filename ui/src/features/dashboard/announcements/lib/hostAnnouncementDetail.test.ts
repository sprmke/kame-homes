import { describe, expect, it } from 'vitest';

import { isLongHostAnnouncementBody, formatHostAnnouncementUpdatedAt, findHostAnnouncementById, HOST_ANNOUNCEMENT_LIST_BODY_MAX_CHARS } from '@/features/dashboard/announcements/lib/hostAnnouncementDetail';

describe('isLongHostAnnouncementBody', () => {

  it('isLongHostAnnouncementBody is exported', () => {
    expect(typeof isLongHostAnnouncementBody).toBe('function');
  });

});

describe('formatHostAnnouncementUpdatedAt', () => {

  it('formatHostAnnouncementUpdatedAt is exported', () => {
    expect(typeof formatHostAnnouncementUpdatedAt).toBe('function');
  });

});

describe('findHostAnnouncementById', () => {

  it('findHostAnnouncementById is exported', () => {
    expect(typeof findHostAnnouncementById).toBe('function');
  });

});

describe('HOST_ANNOUNCEMENT_LIST_BODY_MAX_CHARS', () => {
  it('is defined', () => {
    expect(HOST_ANNOUNCEMENT_LIST_BODY_MAX_CHARS).toBeDefined();
  });
});
