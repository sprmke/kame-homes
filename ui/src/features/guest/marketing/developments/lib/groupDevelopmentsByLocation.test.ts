import { describe, expect, it } from 'vitest';

import { findCityByLocationSlug, filterDevelopmentsByLocationSlug, groupDevelopmentsByLocation } from '@/features/guest/marketing/developments/lib/groupDevelopmentsByLocation';

describe('findCityByLocationSlug', () => {

  it('findCityByLocationSlug is exported', () => {
    expect(typeof findCityByLocationSlug).toBe('function');
  });

});

describe('filterDevelopmentsByLocationSlug', () => {

  it('filterDevelopmentsByLocationSlug is exported', () => {
    expect(typeof filterDevelopmentsByLocationSlug).toBe('function');
  });

});

describe('groupDevelopmentsByLocation', () => {

  it('groupDevelopmentsByLocation is exported', () => {
    expect(typeof groupDevelopmentsByLocation).toBe('function');
  });

});
