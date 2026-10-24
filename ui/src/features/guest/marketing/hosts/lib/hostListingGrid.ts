/** Matches `grid-cols-[repeat(auto-fill,minmax(15rem,1fr))]` on the host profile grids. */
export const HOST_LISTING_CARD_MIN_WIDTH_PX = 240;
export const HOST_LISTING_GRID_COLUMN_GAP_PX = 16;

export const HOST_LISTING_GRID_CLASS =
  'grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] sm:gap-x-4 sm:gap-y-8';

/** Max visible rows per paginated tab panel. */
export const HOST_LISTING_MAX_ROWS = 4;

export function hostListingColumnCount(widthPx: number): number {
  if (widthPx <= 0) return 1;
  return Math.max(
    1,
    Math.floor(
      (widthPx + HOST_LISTING_GRID_COLUMN_GAP_PX) /
        (HOST_LISTING_CARD_MIN_WIDTH_PX + HOST_LISTING_GRID_COLUMN_GAP_PX)
    )
  );
}

export function hostListingPageSize(widthPx: number, maxRows = HOST_LISTING_MAX_ROWS): number {
  return Math.max(1, hostListingColumnCount(widthPx) * maxRows);
}
