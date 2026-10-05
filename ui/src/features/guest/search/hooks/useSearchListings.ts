import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { publicSearchFetch } from '@/features/guest/search/lib/publicSearchFetch';
import { writeSearchParams } from '@/features/guest/search/lib/searchParams';
import type {
  SearchListingsQuery,
  SearchListingsResponse,
} from '@/features/guest/search/types/search';

export const SEARCH_LISTINGS_QUERY_KEY = ['search-listings'] as const;

async function fetchSearchListings(
  query: SearchListingsQuery,
  signal?: AbortSignal
): Promise<SearchListingsResponse> {
  const params = writeSearchParams(query);
  return publicSearchFetch<SearchListingsResponse>('search-listings', params, signal);
}

export function useSearchListings(query: SearchListingsQuery, enabled = true) {
  return useQuery({
    queryKey: [...SEARCH_LISTINGS_QUERY_KEY, query],
    queryFn: ({ signal }) => fetchSearchListings(query, signal),
    enabled,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    retry: 1,
  });
}
