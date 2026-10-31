import { useInfiniteQuery } from '@tanstack/react-query';

import {
  fetchActivityLog,
  type ActivityLogFilters,
} from '@/features/dashboard/activity/lib/activityApi';
import type { ActivityCursor } from '@/features/dashboard/activity/lib/activityCatalog';

const PAGE_SIZE = 50;

/**
 * Org `activity_log` feed for the super-admin org hub (`/admin/orgs/:orgSlug`
 * → Activity → "Org activity" toggle). Calls `list-activity-log` with an explicit
 * `orgId`; a super-admin resolves as `platform_admin` there and sees every row.
 * Distinct from `useActivityLog`, which reads the org slug from the dashboard route.
 */
export function useSuperAdminOrgActivity(orgId: string | null, filters: ActivityLogFilters = {}) {
  return useInfiniteQuery({
    queryKey: ['super-admin', 'org-activity', orgId, filters],
    queryFn: ({ pageParam }) =>
      fetchActivityLog({
        orgSlug: null,
        orgId,
        filters,
        cursor: pageParam as ActivityCursor | null,
        limit: PAGE_SIZE,
      }),
    initialPageParam: null as ActivityCursor | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: Boolean(orgId),
    staleTime: 15_000,
  });
}
