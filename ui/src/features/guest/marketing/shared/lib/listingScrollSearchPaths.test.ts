import { describe, expect, it } from 'vitest';

import { getListingScrollSearchConfig, resolveListingSearchPreferType } from '@/features/guest/marketing/shared/lib/listingScrollSearchPaths';

describe('getListingScrollSearchConfig', () => {

  it('getListingScrollSearchConfig is exported', () => {
    expect(typeof getListingScrollSearchConfig).toBe('function');
  });

});

describe('resolveListingSearchPreferType', () => {

  it('resolveListingSearchPreferType is exported', () => {
    expect(typeof resolveListingSearchPreferType).toBe('function');
  });

});
