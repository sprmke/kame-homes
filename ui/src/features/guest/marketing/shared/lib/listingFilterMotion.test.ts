import { describe, expect, it } from 'vitest';

import { useListingFilterMotion, useListingFilterMotionWidth } from '@/features/guest/marketing/shared/lib/listingFilterMotion';

describe('useListingFilterMotion', () => {

  it('useListingFilterMotion is exported', () => {
    expect(typeof useListingFilterMotion).toBe('function');
  });

});

describe('useListingFilterMotionWidth', () => {

  it('useListingFilterMotionWidth is exported', () => {
    expect(typeof useListingFilterMotionWidth).toBe('function');
  });

});
