import { describe, expect, it } from 'vitest';

import { filterOrgParkings, orgParkingsHasActiveFilters } from '@/features/dashboard/org/lib/orgParkingsFilters';

describe('filterOrgParkings', () => {

  it('filterOrgParkings is exported', () => {
    expect(typeof filterOrgParkings).toBe('function');
  });

});

describe('orgParkingsHasActiveFilters', () => {

  it('orgParkingsHasActiveFilters is exported', () => {
    expect(typeof orgParkingsHasActiveFilters).toBe('function');
  });

});
