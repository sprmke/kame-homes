import { useCallback } from 'react';

import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  EMPTY_PARKINGS_FACETS,
  writeParkingsQuery,
  type ParkingsFacets,
  type ParkingsListingQuery,
  type PublicParkingListItem,
} from '@/features/guest/marketing/parkings/lib/parkingsQuery';
import { publicListingFetch } from '@/features/guest/marketing/shared/lib/publicListingFetch';

export const PUBLIC_PARKINGS_QUERY_KEY = ['list-public-parkings'] as const;

export type PublicParkingsResult = {
  data: PublicParkingListItem[];
  total: number;
  facets: ParkingsFacets;
  page: number;
  pageSize: number;
};

async function fetchPublicParkings(
  query: ParkingsListingQuery,
  signal?: AbortSignal
): Promise<PublicParkingsResult> {
  const params = writeParkingsQuery(query);
  const result = await publicListingFetch<PublicParkingListItem, ParkingsFacets>(
    'list-public-parkings',
    params,
    signal
  );
  return {
    data: result.data,
    total: result.total,
    facets: {
      locations: result.facets.locations ?? EMPTY_PARKINGS_FACETS.locations,
      towers: result.facets.towers ?? EMPTY_PARKINGS_FACETS.towers,
      price: result.facets.price ?? EMPTY_PARKINGS_FACETS.price,
    },
    page: result.page,
    pageSize: result.pageSize,
  };
}

export function usePublicParkings(query: ParkingsListingQuery, enabled = true) {
  return useQuery({
    queryKey: [...PUBLIC_PARKINGS_QUERY_KEY, query],
    queryFn: ({ signal }) => fetchPublicParkings(query, signal),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    retry: 1,
    enabled,
  });
}

/** Warm the cache for another page of the same query (pager hover / focus). */
export function usePrefetchPublicParkings() {
  const queryClient = useQueryClient();
  return useCallback(
    (query: ParkingsListingQuery) =>
      void queryClient.prefetchQuery({
        queryKey: [...PUBLIC_PARKINGS_QUERY_KEY, query],
        queryFn: ({ signal }) => fetchPublicParkings(query, signal),
        staleTime: 30_000,
      }),
    [queryClient]
  );
}
