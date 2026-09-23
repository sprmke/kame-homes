import { describe, expect, it } from 'vitest';

import { normalizeCityPlace, toLocationSlug } from '@/features/guest/marketing/shared/lib/locationSlug';

describe('normalizeCityPlace', () => {

  it('normalizeCityPlace is exported', () => {
    expect(typeof normalizeCityPlace).toBe('function');
  });

});

describe('toLocationSlug', () => {

  it('toLocationSlug is exported', () => {
    expect(typeof toLocationSlug).toBe('function');
  });

});
