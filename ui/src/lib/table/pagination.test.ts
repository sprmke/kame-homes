import { describe, expect, it } from 'vitest';

import {
  ADMIN_DEFAULT_PAGE_SIZE,
  ADMIN_PAGE_SIZES,
  buildPageItems,
  normalizeAdminPageLimit,
} from '@/lib/table/pagination';

describe('normalizeAdminPageLimit', () => {
  it('keeps allowed page sizes', () => {
    for (const size of ADMIN_PAGE_SIZES) {
      expect(normalizeAdminPageLimit(size)).toBe(size);
    }
  });

  it('falls back to default for unknown sizes', () => {
    expect(normalizeAdminPageLimit(999)).toBe(ADMIN_DEFAULT_PAGE_SIZE);
  });
});

describe('buildPageItems', () => {
  it('returns all pages when total <= 7', () => {
    expect(buildPageItems(1, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('includes ellipses for large page counts', () => {
    const items = buildPageItems(5, 20);
    expect(items[0]).toBe(1);
    expect(items).toContain('ellipsis');
    expect(items[items.length - 1]).toBe(20);
  });
});
