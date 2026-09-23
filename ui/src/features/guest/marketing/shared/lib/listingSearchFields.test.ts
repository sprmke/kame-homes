import { describe, expect, it } from 'vitest';

import { getListingSearchFields, getListingSearchWhereSegment, useListingSearchFields, useListingSearchWhereSegment } from '@/features/guest/marketing/shared/lib/listingSearchFields';

describe('getListingSearchFields', () => {

  it('getListingSearchFields is exported', () => {
    expect(typeof getListingSearchFields).toBe('function');
  });

});

describe('getListingSearchWhereSegment', () => {

  it('getListingSearchWhereSegment is exported', () => {
    expect(typeof getListingSearchWhereSegment).toBe('function');
  });

});

describe('useListingSearchFields', () => {

  it('useListingSearchFields is exported', () => {
    expect(typeof useListingSearchFields).toBe('function');
  });

});

describe('useListingSearchWhereSegment', () => {

  it('useListingSearchWhereSegment is exported', () => {
    expect(typeof useListingSearchWhereSegment).toBe('function');
  });

});
