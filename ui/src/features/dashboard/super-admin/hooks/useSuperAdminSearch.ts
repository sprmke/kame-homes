import { useQuery } from '@tanstack/react-query';

import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';

export type SuperAdminSearchHit = {
  type: 'organization' | 'property' | 'parking' | 'ticket';
  label: string;
  sublabel: string | null;
  href: string;
};

export function useSuperAdminSearch(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: ['super-admin', 'search', q],
    enabled: q.length >= 2,
    queryFn: () =>
      callEdgeFunction<{ query: string; results: SuperAdminSearchHit[] }>(
        `super-admin-search?q=${encodeURIComponent(q)}`
      ).then((d) => d.results),
    staleTime: 10_000,
  });
}
