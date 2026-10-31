import { useInfiniteQuery } from '@tanstack/react-query';

import {
  fetchActivityLog,
  type ActivityLogFilters,
} from '@/features/dashboard/activity/lib/activityApi';
import type { ActivityCursor } from '@/features/dashboard/activity/lib/activityCatalog';
import { useOrgSlugParam, useResolvedOrgId } from '@/features/dashboard/org/lib/adminApiScope';

export const ACTIVITY_LOG_KEY = 'activity-log';
const PAGE_SIZE = 40;

export function activityLogQueryKey(
  orgSlug: string | null,
  orgId: string | null,
  filters: ActivityLogFilters
) {
  return [ACTIVITY_LOG_KEY, orgSlug, orgId, filters] as const;
}

/** Org / property / parking activity feed. `filters.scope` + `propertyId` / `parkingId`
 *  narrow it; the server also enforces listing-scoped visibility. */
export function useActivityLog(filters: ActivityLogFilters = {}) {
  const orgSlug = useOrgSlugParam();
  const orgId = useResolvedOrgId();

  return useInfiniteQuery({
    queryKey: activityLogQueryKey(orgSlug, orgId, filters),
    queryFn: ({ pageParam }) =>
      fetchActivityLog({
        orgSlug,
        orgId,
        filters,
        cursor: pageParam as ActivityCursor | null,
        limit: PAGE_SIZE,
      }),
    initialPageParam: null as ActivityCursor | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: Boolean(orgSlug || orgId),
    staleTime: 15_000,
  });
}
