import { describe, expect, it } from 'vitest';

import { parseSearchParams, writeSearchParams, buildSearchHref } from '@/features/guest/search/lib/searchParams';

describe('parseSearchParams', () => {

  it('parseSearchParams is exported', () => {
    expect(typeof parseSearchParams).toBe('function');
  });

});

describe('writeSearchParams', () => {

  it('writeSearchParams is exported', () => {
    expect(typeof writeSearchParams).toBe('function');
  });

});

describe('buildSearchHref', () => {

  it('buildSearchHref is exported', () => {
    expect(typeof buildSearchHref).toBe('function');
  });

});
