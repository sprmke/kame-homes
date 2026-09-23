import { describe, expect, it } from 'vitest';

import { useHasHostAnnouncementsArchiveScope, useHostAnnouncementsBasePath, hostAnnouncementsPathFromHelpSupport, hostAnnouncementDetailPath, isHostAnnouncementDetailPath } from '@/features/dashboard/announcements/lib/hostAnnouncementsPaths';

describe('useHasHostAnnouncementsArchiveScope', () => {

  it('useHasHostAnnouncementsArchiveScope is exported', () => {
    expect(typeof useHasHostAnnouncementsArchiveScope).toBe('function');
  });

});

describe('useHostAnnouncementsBasePath', () => {

  it('useHostAnnouncementsBasePath is exported', () => {
    expect(typeof useHostAnnouncementsBasePath).toBe('function');
  });

});

describe('hostAnnouncementsPathFromHelpSupport', () => {

  it('hostAnnouncementsPathFromHelpSupport is exported', () => {
    expect(typeof hostAnnouncementsPathFromHelpSupport).toBe('function');
  });

});

describe('hostAnnouncementDetailPath', () => {

  it('hostAnnouncementDetailPath is exported', () => {
    expect(typeof hostAnnouncementDetailPath).toBe('function');
  });

});

describe('isHostAnnouncementDetailPath', () => {

  it('isHostAnnouncementDetailPath is exported', () => {
    expect(typeof isHostAnnouncementDetailPath).toBe('function');
  });

});
