import type { ActivityLogFilters } from '@/features/dashboard/activity/lib/activityApi';

/** Groups with any selection — used for refine badge counts. */
export function activityRefineFilterCount(filters: ActivityLogFilters): number {
  let count = 0;
  if ((filters.category ?? []).length > 0) count += 1;
  if (filters.severity) count += 1;
  if (filters.dateFrom || filters.dateTo) count += 1;
  return count;
}

export function hasActivityFilters(filters: ActivityLogFilters): boolean {
  return (
    (filters.category ?? []).length > 0 ||
    Boolean(filters.severity) ||
    Boolean(filters.q) ||
    Boolean(filters.dateFrom) ||
    Boolean(filters.dateTo)
  );
}

export function clearActivityFilters(filters: ActivityLogFilters): ActivityLogFilters {
  return { scope: filters.scope };
}
