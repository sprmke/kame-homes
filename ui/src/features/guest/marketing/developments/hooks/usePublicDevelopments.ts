import { useCallback } from 'react';

import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  EMPTY_DEVELOPMENTS_FACETS,
  writeDevelopmentsQuery,
  type DevelopmentsFacets,
  type DevelopmentsListingQuery,
  type PublicDevelopmentListItem,
} from '@/features/guest/marketing/developments/lib/developmentsQuery';
import { publicListingFetch } from '@/features/guest/marketing/shared/lib/publicListingFetch';

export const PUBLIC_DEVELOPMENTS_QUERY_KEY = ['list-public-developments'] as const;

export type PublicDevelopmentsResult = {
  data: PublicDevelopmentListItem[];
  total: number;
  facets: DevelopmentsFacets;
  page: number;
  pageSize: number;
};

export async function fetchPublicDevelopments(
  query: DevelopmentsListingQuery,
  signal?: AbortSignal
): Promise<PublicDevelopmentsResult> {
  const params = writeDevelopmentsQuery(query);
  const result = await publicListingFetch<PublicDevelopmentListItem, DevelopmentsFacets>(
    'list-public-developments',
    params,
    signal
  );
  return {
    data: result.data,
    total: result.total,
    facets: {
      types: result.facets.types ?? EMPTY_DEVELOPMENTS_FACETS.types,
      cities: result.facets.cities ?? EMPTY_DEVELOPMENTS_FACETS.cities,
      price: result.facets.price ?? EMPTY_DEVELOPMENTS_FACETS.price,
      developers: result.facets.developers ?? EMPTY_DEVELOPMENTS_FACETS.developers,
    },
    page: result.page,
    pageSize: result.pageSize,
  };
}

export function usePublicDevelopments(query: DevelopmentsListingQuery, enabled = true) {
  return useQuery({
    queryKey: [...PUBLIC_DEVELOPMENTS_QUERY_KEY, query],
    queryFn: ({ signal }) => fetchPublicDevelopments(query, signal),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    retry: 1,
    enabled,
  });
}

/** Warm the cache for another page of the same query (pager hover / focus). */
export function usePrefetchPublicDevelopments() {
  const queryClient = useQueryClient();
  return useCallback(
    (query: DevelopmentsListingQuery) =>
      void queryClient.prefetchQuery({
        queryKey: [...PUBLIC_DEVELOPMENTS_QUERY_KEY, query],
        queryFn: ({ signal }) => fetchPublicDevelopments(query, signal),
        staleTime: 30_000,
      }),
    [queryClient]
  );
}
