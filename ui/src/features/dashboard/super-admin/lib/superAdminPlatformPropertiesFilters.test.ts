import { describe, expect, it } from 'vitest';

import { superAdminPlatformPropertiesHasActiveFilters, superAdminPlatformPropertiesSummaryFromList } from '@/features/dashboard/super-admin/lib/superAdminPlatformPropertiesFilters';

describe('superAdminPlatformPropertiesHasActiveFilters', () => {

  it('superAdminPlatformPropertiesHasActiveFilters is exported', () => {
    expect(typeof superAdminPlatformPropertiesHasActiveFilters).toBe('function');
  });

});

describe('superAdminPlatformPropertiesSummaryFromList', () => {

  it('superAdminPlatformPropertiesSummaryFromList is exported', () => {
    expect(typeof superAdminPlatformPropertiesSummaryFromList).toBe('function');
  });

});
