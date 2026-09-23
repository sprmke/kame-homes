import { describe, expect, it } from 'vitest';

import { formatMapPinLabel, bboxToSearchParams, parseBboxFromSearchParams } from '@/features/guest/marketing/shared/lib/listingMapMarkers';

describe('formatMapPinLabel', () => {

  it('formatMapPinLabel is exported', () => {
    expect(typeof formatMapPinLabel).toBe('function');
  });

});

describe('bboxToSearchParams', () => {

  it('bboxToSearchParams is exported', () => {
    expect(typeof bboxToSearchParams).toBe('function');
  });

});

describe('parseBboxFromSearchParams', () => {

  it('parseBboxFromSearchParams is exported', () => {
    expect(typeof parseBboxFromSearchParams).toBe('function');
  });

});
