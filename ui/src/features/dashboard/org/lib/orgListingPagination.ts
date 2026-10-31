import {
  ADMIN_DEFAULT_PAGE_SIZE,
  buildPageItems,
  normalizeAdminPageLimit,
  type PageItem,
} from '@/lib/table/pagination';

export type OrgListingPaginationState = {
  page: number;
  limit: number;
};

export type OrgListingPaginationSlice = {
  page: number;
  limit: number;
  pageCount: number;
  startIdx: number;
  endIdx: number;
  pageItems: PageItem[];
};

/** Clamp page + derive summary indices for a client-filtered list. */
export function orgListingPaginationSlice(
  totalFiltered: number,
  state: OrgListingPaginationState
): OrgListingPaginationSlice {
  const limit = normalizeAdminPageLimit(state.limit);
  const pageCount = Math.max(1, Math.ceil(totalFiltered / limit) || 1);
  const page = Math.min(Math.max(1, state.page), pageCount);
  const startIdx = totalFiltered === 0 ? 0 : (page - 1) * limit + 1;
  const endIdx = totalFiltered === 0 ? 0 : Math.min(page * limit, totalFiltered);

  return {
    page,
    limit,
    pageCount,
    startIdx,
    endIdx,
    pageItems: buildPageItems(page, pageCount),
  };
}

export function sliceOrgListingPage<T>(items: readonly T[], state: OrgListingPaginationState): T[] {
  const { page, limit } = orgListingPaginationSlice(items.length, state);
  const start = (page - 1) * limit;
  return items.slice(start, start + limit);
}

export const ORG_LISTING_DEFAULT_PAGE_SIZE = ADMIN_DEFAULT_PAGE_SIZE;
