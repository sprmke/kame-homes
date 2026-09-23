import { describe, expect, it } from 'vitest';

import { sortHostAnnouncementsByPriority, hostAnnouncementScopeLabel, hostAnnouncementIdentityKey, groupHostAnnouncementsForFeed, summarizeHostAnnouncements, HOST_ANNOUNCEMENT_FEED_PAGE_SIZE } from '@/features/dashboard/announcements/lib/hostAnnouncementPresentation';

describe('sortHostAnnouncementsByPriority', () => {

  it('sortHostAnnouncementsByPriority is exported', () => {
    expect(typeof sortHostAnnouncementsByPriority).toBe('function');
  });

});

describe('hostAnnouncementScopeLabel', () => {

  it('hostAnnouncementScopeLabel is exported', () => {
    expect(typeof hostAnnouncementScopeLabel).toBe('function');
  });

});

describe('hostAnnouncementIdentityKey', () => {

  it('hostAnnouncementIdentityKey is exported', () => {
    expect(typeof hostAnnouncementIdentityKey).toBe('function');
  });

});

describe('groupHostAnnouncementsForFeed', () => {

  it('groupHostAnnouncementsForFeed is exported', () => {
    expect(typeof groupHostAnnouncementsForFeed).toBe('function');
  });

});

describe('summarizeHostAnnouncements', () => {

  it('summarizeHostAnnouncements is exported', () => {
    expect(typeof summarizeHostAnnouncements).toBe('function');
  });

});

describe('HOST_ANNOUNCEMENT_FEED_PAGE_SIZE', () => {
  it('is defined', () => {
    expect(HOST_ANNOUNCEMENT_FEED_PAGE_SIZE).toBeDefined();
  });
});
