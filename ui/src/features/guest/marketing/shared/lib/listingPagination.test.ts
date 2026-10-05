import { describe, expect, it } from 'vitest';

import { listingTotalPages } from '@/features/guest/marketing/shared/lib/listingPagination';

describe('listingTotalPages', () => {
  it('rounds up partial pages', () => {
    expect(listingTotalPages(49, 24)).toBe(3);
    expect(listingTotalPages(48, 24)).toBe(2);
  });

  it('returns 1 for an empty or invalid total', () => {
    expect(listingTotalPages(0, 24)).toBe(1);
    expect(listingTotalPages(Number.NaN, 24)).toBe(1);
  });

  it('treats an invalid page size as 1 per page', () => {
    expect(listingTotalPages(10, 0)).toBe(10);
  });
});
