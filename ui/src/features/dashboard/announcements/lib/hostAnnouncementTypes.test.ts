import { describe, expect, it } from 'vitest';

import { createHostAnnouncementId, hostAnnouncementBodyPlainText, ensureHostAnnouncementBodyHtml, emptyHostAnnouncement, parseHostAnnouncementDrafts, validateHostAnnouncements } from '@/features/dashboard/announcements/lib/hostAnnouncementTypes';

describe('createHostAnnouncementId', () => {

  it('createHostAnnouncementId is exported', () => {
    expect(typeof createHostAnnouncementId).toBe('function');
  });

});

describe('hostAnnouncementBodyPlainText', () => {

  it('hostAnnouncementBodyPlainText is exported', () => {
    expect(typeof hostAnnouncementBodyPlainText).toBe('function');
  });

});

describe('ensureHostAnnouncementBodyHtml', () => {

  it('ensureHostAnnouncementBodyHtml is exported', () => {
    expect(typeof ensureHostAnnouncementBodyHtml).toBe('function');
  });

});

describe('emptyHostAnnouncement', () => {

  it('emptyHostAnnouncement is exported', () => {
    expect(typeof emptyHostAnnouncement).toBe('function');
  });

});

describe('parseHostAnnouncementDrafts', () => {

  it('parseHostAnnouncementDrafts is exported', () => {
    expect(typeof parseHostAnnouncementDrafts).toBe('function');
  });

});

describe('validateHostAnnouncements', () => {

  it('validateHostAnnouncements is exported', () => {
    expect(typeof validateHostAnnouncements).toBe('function');
  });

});
