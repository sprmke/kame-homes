import { describe, expect, it } from 'vitest';

import { subscribeHostAnnouncementRead, getHostAnnouncementReadRevision, readHostAnnouncementReadKeys, markHostAnnouncementRead, pruneHostAnnouncementReadKeys } from '@/features/dashboard/announcements/lib/hostAnnouncementReadState';

describe('subscribeHostAnnouncementRead', () => {

  it('subscribeHostAnnouncementRead is exported', () => {
    expect(typeof subscribeHostAnnouncementRead).toBe('function');
  });

});

describe('getHostAnnouncementReadRevision', () => {

  it('getHostAnnouncementReadRevision is exported', () => {
    expect(typeof getHostAnnouncementReadRevision).toBe('function');
  });

});

describe('readHostAnnouncementReadKeys', () => {

  it('readHostAnnouncementReadKeys is exported', () => {
    expect(typeof readHostAnnouncementReadKeys).toBe('function');
  });

});

describe('markHostAnnouncementRead', () => {

  it('markHostAnnouncementRead is exported', () => {
    expect(typeof markHostAnnouncementRead).toBe('function');
  });

});

describe('pruneHostAnnouncementReadKeys', () => {

  it('pruneHostAnnouncementReadKeys is exported', () => {
    expect(typeof pruneHostAnnouncementReadKeys).toBe('function');
  });

});
