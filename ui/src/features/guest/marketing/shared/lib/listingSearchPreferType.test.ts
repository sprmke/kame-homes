import { describe, expect, it } from 'vitest';

import { getListingSearchPreferType, preferTypeToSuggestionKind, orderSuggestionKinds } from '@/features/guest/marketing/shared/lib/listingSearchPreferType';

describe('getListingSearchPreferType', () => {

  it('getListingSearchPreferType is exported', () => {
    expect(typeof getListingSearchPreferType).toBe('function');
  });

});

describe('preferTypeToSuggestionKind', () => {

  it('preferTypeToSuggestionKind is exported', () => {
    expect(typeof preferTypeToSuggestionKind).toBe('function');
  });

});

describe('orderSuggestionKinds', () => {

  it('orderSuggestionKinds is exported', () => {
    expect(typeof orderSuggestionKinds).toBe('function');
  });

});
