import { describe, expect, it } from 'vitest';

import { getListingSearchDefaultLocation, useListingSearchDefaultLocation } from '@/features/guest/marketing/shared/lib/listingSearchDefaultLocation';

describe('getListingSearchDefaultLocation', () => {

  it('getListingSearchDefaultLocation is exported', () => {
    expect(typeof getListingSearchDefaultLocation).toBe('function');
  });

});

describe('useListingSearchDefaultLocation', () => {

  it('useListingSearchDefaultLocation is exported', () => {
    expect(typeof useListingSearchDefaultLocation).toBe('function');
  });

});
