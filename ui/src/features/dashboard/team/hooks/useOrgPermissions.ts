import { useQuery } from '@tanstack/react-query';

import { useOrgSlugParam } from '@/features/dashboard/org/lib/adminApiScope';
import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';
import type { OrgAccessPayload } from '@/features/dashboard/team/lib/orgPermissions';

export const ORG_ACCESS_QUERY_KEY = (orgSlug: string) => ['org-access', orgSlug] as const;

export function useOrgPermissions() {
  const orgSlug = useOrgSlugParam();

  return useQuery({
    queryKey: ORG_ACCESS_QUERY_KEY(orgSlug ?? ''),
    queryFn: () =>
      callEdgeFunction<OrgAccessPayload>(`org-access?org_slug=${encodeURIComponent(orgSlug!)}`),
    enabled: Boolean(orgSlug),
    staleTime: 60_000,
  });
}
