import { describe, expect, it } from 'vitest';

import { hostListingColumnCount, hostListingPageSize, HOST_LISTING_CARD_MIN_WIDTH_PX, HOST_LISTING_GRID_COLUMN_GAP_PX, HOST_LISTING_GRID_CLASS, HOST_LISTING_MAX_ROWS } from '@/features/guest/marketing/hosts/lib/hostListingGrid';

describe('hostListingColumnCount', () => {

  it('hostListingColumnCount is exported', () => {
    expect(typeof hostListingColumnCount).toBe('function');
  });

});

describe('hostListingPageSize', () => {

  it('hostListingPageSize is exported', () => {
    expect(typeof hostListingPageSize).toBe('function');
  });

});

describe('HOST_LISTING_CARD_MIN_WIDTH_PX', () => {
  it('is defined', () => {
    expect(HOST_LISTING_CARD_MIN_WIDTH_PX).toBeDefined();
  });
});

describe('HOST_LISTING_GRID_COLUMN_GAP_PX', () => {
  it('is defined', () => {
    expect(HOST_LISTING_GRID_COLUMN_GAP_PX).toBeDefined();
  });
});

describe('HOST_LISTING_GRID_CLASS', () => {
  it('is defined', () => {
    expect(HOST_LISTING_GRID_CLASS).toBeDefined();
  });
});

describe('HOST_LISTING_MAX_ROWS', () => {
  it('is defined', () => {
    expect(HOST_LISTING_MAX_ROWS).toBeDefined();
  });
});
