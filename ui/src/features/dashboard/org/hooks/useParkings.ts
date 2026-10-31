import { useMemo } from 'react';

import { useQueries, useQuery } from '@tanstack/react-query';

import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';
import type { Organization, Parking } from '@/features/dashboard/org/types';

export const PARKINGS_QUERY_KEY = ['parkings'] as const;

export function useParkings(orgSlug: string | undefined) {
  return useQuery({
    queryKey: [...PARKINGS_QUERY_KEY, orgSlug] as const,
    enabled: Boolean(orgSlug),
    queryFn: () =>
      callEdgeFunction<{ parkings: Parking[] }>(
        `list-parkings?orgSlug=${encodeURIComponent(orgSlug!)}`
      ),
  });
}

export function useAllOrgParkings(organizations: Organization[]) {
  const queries = useQueries({
    queries: organizations.map((org) => ({
      queryKey: [...PARKINGS_QUERY_KEY, org.slug] as const,
      queryFn: () =>
        callEdgeFunction<{ parkings: Parking[] }>(
          `list-parkings?orgSlug=${encodeURIComponent(org.slug)}`
        ),
    })),
  });

  const byOrgSlug = useMemo(() => {
    const map = new Map<string, Parking[]>();
    organizations.forEach((org, index) => {
      map.set(org.slug, queries[index]?.data?.parkings ?? []);
    });
    return map;
  }, [organizations, queries]);

  const isLoading = organizations.length > 0 && queries.some((query) => query.isLoading);

  return { byOrgSlug, isLoading };
}
