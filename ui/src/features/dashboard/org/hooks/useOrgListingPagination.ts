import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  ORG_LISTING_DEFAULT_PAGE_SIZE,
  orgListingPaginationSlice,
  type OrgListingPaginationState,
} from '@/features/dashboard/org/lib/orgListingPagination';

import { normalizeAdminPageLimit } from '@/lib/table/pagination';

/**
 * Client-side page state for org inventory lists (filter → slice → paginate).
 * Resets to page 1 when the filter fingerprint or page size changes.
 */
export function useOrgListingPagination(totalFiltered: number, filterKey: string) {
  const [state, setState] = useState<OrgListingPaginationState>({
    page: 1,
    limit: ORG_LISTING_DEFAULT_PAGE_SIZE,
  });

  useEffect(() => {
    setState((current) => ({ ...current, page: 1 }));
  }, [filterKey]);

  const slice = useMemo(
    () => orgListingPaginationSlice(totalFiltered, state),
    [totalFiltered, state]
  );

  useEffect(() => {
    if (state.page !== slice.page) {
      setState((current) => ({ ...current, page: slice.page }));
    }
  }, [slice.page, state.page]);

  const setPage = useCallback((page: number) => {
    setState((current) => ({ ...current, page: Math.max(1, page) }));
  }, []);

  const setLimit = useCallback((limit: number) => {
    setState({ page: 1, limit: normalizeAdminPageLimit(limit) });
  }, []);

  return {
    page: slice.page,
    limit: slice.limit,
    pageCount: slice.pageCount,
    startIdx: slice.startIdx,
    endIdx: slice.endIdx,
    pageItems: slice.pageItems,
    setPage,
    setLimit,
  };
}
