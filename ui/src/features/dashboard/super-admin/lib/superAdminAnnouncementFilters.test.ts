import { describe, expect, it } from 'vitest';

import { filterSuperAdminAnnouncements, superAdminAnnouncementHasActiveFilters, superAdminAnnouncementSummaryFromList } from '@/features/dashboard/super-admin/lib/superAdminAnnouncementFilters';

describe('filterSuperAdminAnnouncements', () => {

  it('filterSuperAdminAnnouncements is exported', () => {
    expect(typeof filterSuperAdminAnnouncements).toBe('function');
  });

});

describe('superAdminAnnouncementHasActiveFilters', () => {

  it('superAdminAnnouncementHasActiveFilters is exported', () => {
    expect(typeof superAdminAnnouncementHasActiveFilters).toBe('function');
  });

});

describe('superAdminAnnouncementSummaryFromList', () => {

  it('superAdminAnnouncementSummaryFromList is exported', () => {
    expect(typeof superAdminAnnouncementSummaryFromList).toBe('function');
  });

});
