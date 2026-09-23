import { describe, expect, it } from 'vitest';

import { formatAmenityLabel, formatAmenityLabels } from '@/features/guest/search/lib/amenityLabels';

describe('formatAmenityLabel', () => {

  it('formatAmenityLabel is exported', () => {
    expect(typeof formatAmenityLabel).toBe('function');
  });

});

describe('formatAmenityLabels', () => {

  it('formatAmenityLabels is exported', () => {
    expect(typeof formatAmenityLabels).toBe('function');
  });

});
