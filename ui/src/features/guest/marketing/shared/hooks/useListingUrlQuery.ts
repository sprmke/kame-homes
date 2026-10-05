import { useCallback, useMemo } from 'react';

import { useSearchParams } from 'react-router-dom';

type PagedQuery = { page: number };

type Options<Q extends PagedQuery> = {
  parse: (sp: URLSearchParams) => Q;
  write: (query: Q, current?: URLSearchParams) => URLSearchParams;
  /** Route-owned fields (e.g. `locationSlug` from `:location`) applied on every read. */
  scope: Partial<Q>;
  /** Values that keep route-owned fields out of the URL on write. */
  unscope: Partial<Q>;
};

/**
 * URL-backed listing query for scoped browse pages (location, development).
 * Filters, sort and page live in the URL so Back, refresh and shared links restore
 * them; route-owned scope comes from params and never leaks into the query string.
 */
export function useListingUrlQuery<Q extends PagedQuery>({
  parse,
  write,
  scope,
  unscope,
}: Options<Q>) {
  const [searchParams, setSearchParams] = useSearchParams();
  const scopeKey = JSON.stringify(scope);

  const query = useMemo(
    () => ({ ...parse(searchParams), ...scope }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scope is compared by value
    [parse, searchParams, scopeKey]
  );

  const writeScoped = useCallback(
    (next: Q, prev: URLSearchParams) => write({ ...next, ...unscope }, prev),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unscope is a static default
    [write]
  );

  /** Replace filters (resets to page 1, no history entry). */
  const setFilters = useCallback(
    (next: Q) => {
      setSearchParams((prev) => writeScoped({ ...next, page: 1 }, prev), { replace: true });
    },
    [setSearchParams, writeScoped]
  );

  /** Patch fields such as sort (resets to page 1, no history entry). */
  const patchQuery = useCallback(
    (partial: Partial<Q>) => {
      setSearchParams((prev) => writeScoped({ ...parse(prev), page: 1, ...partial }, prev), {
        replace: true,
      });
    },
    [parse, setSearchParams, writeScoped]
  );

  /** Page changes push history so Back returns to the previous page. */
  const goToPage = useCallback(
    (page: number) => {
      setSearchParams((prev) => writeScoped({ ...parse(prev), page }, prev));
    },
    [parse, setSearchParams, writeScoped]
  );

  const viewParam = searchParams.get('view');
  const setViewParam = useCallback(
    (view: string | null) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (view) next.set('view', view);
          else next.delete('view');
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  return { query, setFilters, patchQuery, goToPage, viewParam, setViewParam };
}
