import { describe, expect, it } from 'vitest';

import { placeLabelFromPropertyLocation, findPlaceByLocationSlug, filterPropertiesByLocationSlug, groupPropertiesByLocation } from '@/features/guest/marketing/properties/lib/groupPropertiesByLocation';

describe('placeLabelFromPropertyLocation', () => {

  it('placeLabelFromPropertyLocation is exported', () => {
    expect(typeof placeLabelFromPropertyLocation).toBe('function');
  });

});

describe('findPlaceByLocationSlug', () => {

  it('findPlaceByLocationSlug is exported', () => {
    expect(typeof findPlaceByLocationSlug).toBe('function');
  });

});

describe('filterPropertiesByLocationSlug', () => {

  it('filterPropertiesByLocationSlug is exported', () => {
    expect(typeof filterPropertiesByLocationSlug).toBe('function');
  });

});

describe('groupPropertiesByLocation', () => {

  it('groupPropertiesByLocation is exported', () => {
    expect(typeof groupPropertiesByLocation).toBe('function');
  });

});
