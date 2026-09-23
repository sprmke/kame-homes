import { describe, expect, it } from 'vitest';

import { parsePropertiesQuery, writePropertiesQuery, countActivePropertyFilters, clearPropertyFilters, toPropertyCard, PROPERTIES_SORTS } from '@/features/guest/marketing/properties/lib/propertiesQuery';

describe('parsePropertiesQuery', () => {

  it('parsePropertiesQuery is exported', () => {
    expect(typeof parsePropertiesQuery).toBe('function');
  });

});

describe('writePropertiesQuery', () => {

  it('writePropertiesQuery is exported', () => {
    expect(typeof writePropertiesQuery).toBe('function');
  });

});

describe('countActivePropertyFilters', () => {

  it('countActivePropertyFilters is exported', () => {
    expect(typeof countActivePropertyFilters).toBe('function');
  });

});

describe('clearPropertyFilters', () => {

  it('clearPropertyFilters is exported', () => {
    expect(typeof clearPropertyFilters).toBe('function');
  });

});

describe('toPropertyCard', () => {

  it('toPropertyCard is exported', () => {
    expect(typeof toPropertyCard).toBe('function');
  });

});

describe('PROPERTIES_SORTS', () => {
  it('is defined', () => {
    expect(PROPERTIES_SORTS).toBeDefined();
  });
});
