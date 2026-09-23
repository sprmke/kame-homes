import { describe, expect, it } from 'vitest';

import { propertyMediaItems, propertyGalleryMediaItems, pickRandomPropertyPhoto } from '@/features/dashboard/marketing/lib/polotno/propertyMedia';

describe('propertyMediaItems', () => {

  it('propertyMediaItems is exported', () => {
    expect(typeof propertyMediaItems).toBe('function');
  });

});

describe('propertyGalleryMediaItems', () => {

  it('propertyGalleryMediaItems is exported', () => {
    expect(typeof propertyGalleryMediaItems).toBe('function');
  });

});

describe('pickRandomPropertyPhoto', () => {

  it('pickRandomPropertyPhoto is exported', () => {
    expect(typeof pickRandomPropertyPhoto).toBe('function');
  });

});
