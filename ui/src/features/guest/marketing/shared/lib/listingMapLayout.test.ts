import { describe, expect, it } from 'vitest';

import { listingMapCanvasClass, listingMapMinHeightClass } from '@/features/guest/marketing/shared/lib/listingMapLayout';

describe('listingMapCanvasClass', () => {
  it('is defined', () => {
    expect(listingMapCanvasClass).toBeDefined();
  });
});

describe('listingMapMinHeightClass', () => {
  it('is defined', () => {
    expect(listingMapMinHeightClass).toBeDefined();
  });
});
