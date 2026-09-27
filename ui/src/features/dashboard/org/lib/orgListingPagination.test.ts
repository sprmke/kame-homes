import { describe, expect, it } from 'vitest';

import {
  orgListingPaginationSlice,
  sliceOrgListingPage,
} from '@/features/dashboard/org/lib/orgListingPagination';

describe('orgListingPaginationSlice', () => {
  it('returns empty indices when there are no items', () => {
    expect(orgListingPaginationSlice(0, { page: 1, limit: 31 })).toMatchObject({
      page: 1,
      pageCount: 1,
      startIdx: 0,
      endIdx: 0,
    });
  });

  it('clamps page when past the last page', () => {
    const slice = orgListingPaginationSlice(40, { page: 9, limit: 31 });
    expect(slice.page).toBe(2);
    expect(slice.pageCount).toBe(2);
    expect(slice.startIdx).toBe(32);
    expect(slice.endIdx).toBe(40);
  });

  it('normalizes unsupported page sizes', () => {
    expect(orgListingPaginationSlice(10, { page: 1, limit: 7 }).limit).toBe(31);
  });
});

describe('sliceOrgListingPage', () => {
  it('returns the current page window', () => {
    const items = Array.from({ length: 40 }, (_, i) => i + 1);
    expect(sliceOrgListingPage(items, { page: 1, limit: 31 })).toEqual(items.slice(0, 31));
    expect(sliceOrgListingPage(items, { page: 2, limit: 31 })).toEqual(items.slice(31));
  });
});
