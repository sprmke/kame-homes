import { useMemo } from 'react';

import { useQueries, useQuery } from '@tanstack/react-query';

import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';
import type { Organization, Property } from '@/features/dashboard/org/types';

export const ORGANIZATIONS_QUERY_KEY = ['organizations'] as const;

/** Org/property membership rarely changes mid-session — avoid refetching on every mount/focus. */
const ORG_STRUCTURE_STALE_TIME = 5 * 60_000;

type UseOrganizationsOptions = {
  enabled?: boolean;
};

export function useOrganizations(options?: UseOrganizationsOptions) {
  return useQuery({
    queryKey: ORGANIZATIONS_QUERY_KEY,
    queryFn: () => callEdgeFunction<{ organizations: Organization[] }>('list-organizations'),
    enabled: options?.enabled ?? true,
    staleTime: ORG_STRUCTURE_STALE_TIME,
  });
}

export function useProperties(orgSlug: string | undefined) {
  return useQuery({
    queryKey: ['properties', orgSlug] as const,
    enabled: Boolean(orgSlug),
    queryFn: () =>
      callEdgeFunction<{ properties: Property[] }>(
        `list-properties?orgSlug=${encodeURIComponent(orgSlug!)}`
      ),
    staleTime: ORG_STRUCTURE_STALE_TIME,
  });
}

/** Properties for every org — used by the sidebar context switcher. */
export function useAllOrgProperties(organizations: Organization[]) {
  const queries = useQueries({
    queries: organizations.map((org) => ({
      queryKey: ['properties', org.slug] as const,
      queryFn: () =>
        callEdgeFunction<{ properties: Property[] }>(
          `list-properties?orgSlug=${encodeURIComponent(org.slug)}`
        ),
      staleTime: ORG_STRUCTURE_STALE_TIME,
    })),
  });

  const byOrgSlug = useMemo(() => {
    const map = new Map<string, Property[]>();
    organizations.forEach((org, index) => {
      map.set(org.slug, queries[index]?.data?.properties ?? []);
    });
    return map;
  }, [organizations, queries]);

  const isLoading = organizations.length > 0 && queries.some((query) => query.isLoading);

  return { byOrgSlug, isLoading };
}
