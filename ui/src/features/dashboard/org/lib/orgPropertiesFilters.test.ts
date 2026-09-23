import { describe, expect, it } from 'vitest';

import { filterOrgProperties, orgPropertiesHasActiveFilters } from '@/features/dashboard/org/lib/orgPropertiesFilters';

describe('filterOrgProperties', () => {

  it('filterOrgProperties is exported', () => {
    expect(typeof filterOrgProperties).toBe('function');
  });

});

describe('orgPropertiesHasActiveFilters', () => {

  it('orgPropertiesHasActiveFilters is exported', () => {
    expect(typeof orgPropertiesHasActiveFilters).toBe('function');
  });

});
