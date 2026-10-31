import { describe, expect, it } from 'vitest';

import {
  defaultOrgListingViewMode,
  ORG_LISTING_DENSE_VIEW_MIN_COUNT,
  resolveOrgListingViewMode,
} from '@/features/dashboard/org/lib/orgListingViewMode';

describe('defaultOrgListingViewMode', () => {
  it('uses list view below the dense threshold', () => {
    expect(ORG_LISTING_DENSE_VIEW_MIN_COUNT).toBe(5);
    expect(defaultOrgListingViewMode(0)).toBe('list');
    expect(defaultOrgListingViewMode(1)).toBe('list');
    expect(defaultOrgListingViewMode(4)).toBe('list');
  });

  it('uses table view at the threshold on desktop', () => {
    expect(defaultOrgListingViewMode(5)).toBe('table');
    expect(defaultOrgListingViewMode(12)).toBe('table');
  });

  it('uses grid view at the threshold when table is hidden', () => {
    expect(defaultOrgListingViewMode(5, { hideTable: true })).toBe('grid');
    expect(defaultOrgListingViewMode(12, { hideTable: true })).toBe('grid');
  });
});

describe('resolveOrgListingViewMode', () => {
  it('coerces table to grid when table is hidden', () => {
    expect(resolveOrgListingViewMode('table', { hideTable: true })).toBe('grid');
    expect(resolveOrgListingViewMode('list', { hideTable: true })).toBe('list');
    expect(resolveOrgListingViewMode('table')).toBe('table');
  });
});
