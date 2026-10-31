import { useCallback } from 'react';

import { useSearchParams } from 'react-router-dom';

import { ADMIN_DEFAULT_PAGE_SIZE, normalizeAdminPageLimit } from '@/lib/table/pagination';

/** Shared URL page/limit setters for super-admin list pages. */
export function useAdminListPaginationParams() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
  const limit = normalizeAdminPageLimit(
    Number(searchParams.get('limit') ?? String(ADMIN_DEFAULT_PAGE_SIZE))
  );

  const setPage = useCallback(
    (nextPage: number) =>
      setSearchParams(
        (prev) => {
          const sp = new URLSearchParams(prev);
          if (nextPage <= 1) sp.delete('page');
          else sp.set('page', String(nextPage));
          return sp;
        },
        { replace: true }
      ),
    [setSearchParams]
  );

  const setLimit = useCallback(
    (nextLimit: number) =>
      setSearchParams(
        (prev) => {
          const sp = new URLSearchParams(prev);
          if (nextLimit === ADMIN_DEFAULT_PAGE_SIZE) sp.delete('limit');
          else sp.set('limit', String(nextLimit));
          sp.delete('page');
          return sp;
        },
        { replace: true }
      ),
    [setSearchParams]
  );

  return { searchParams, setSearchParams, page, limit, setPage, setLimit };
}
