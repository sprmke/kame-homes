export const ORG_LISTING_DENSE_VIEW_MIN_COUNT = 5;

/** @deprecated Use ORG_LISTING_DENSE_VIEW_MIN_COUNT */
export const ORG_LISTING_GRID_VIEW_MIN_COUNT = ORG_LISTING_DENSE_VIEW_MIN_COUNT;

export type OrgListingViewMode = 'table' | 'grid' | 'list';

/**
 * Small catalogs stay as list rows. Five or more: table on desktop (scan + compare),
 * grid on phone/tablet where table is hidden.
 */
export function defaultOrgListingViewMode(
  itemCount: number,
  options?: { hideTable?: boolean }
): OrgListingViewMode {
  if (itemCount < ORG_LISTING_DENSE_VIEW_MIN_COUNT) return 'list';
  if (options?.hideTable) return 'grid';
  return 'table';
}

export function resolveOrgListingViewMode(
  mode: OrgListingViewMode,
  options?: { hideTable?: boolean }
): OrgListingViewMode {
  if (options?.hideTable && mode === 'table') return 'grid';
  return mode;
}
