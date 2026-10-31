/**
 * Maintenance period helpers — Manila timezone presets and URL query sync.
 */

import { parseAdminListView } from '@/features/dashboard/bookings/lib/listView';
import type { MaintenanceQuery } from '@/features/dashboard/maintenance/lib/types';
import { DEFAULT_MAINTENANCE_QUERY } from '@/features/dashboard/maintenance/lib/types';

import {
  detectManilaRangePreset,
  manilaRangeForPreset,
  manilaTodayIso,
  type ManilaRangePreset,
} from '@/lib/date/manilaPeriod';
import { ADMIN_DEFAULT_PAGE_SIZE, normalizeAdminPageLimit } from '@/lib/table/pagination';

export type MaintenanceRangePreset = ManilaRangePreset;

export { manilaTodayIso };
export const rangeForPreset = manilaRangeForPreset;
export const detectPreset = detectManilaRangePreset;

export function parseMaintenanceQueryFromParams(params: URLSearchParams): MaintenanceQuery {
  const sortRaw = params.get('sort');
  let sort: MaintenanceQuery['sort'] = DEFAULT_MAINTENANCE_QUERY.sort;
  if (
    sortRaw === 'date:asc' ||
    sortRaw === 'date:desc' ||
    sortRaw === 'label:asc' ||
    sortRaw === 'label:desc'
  ) {
    sort = sortRaw;
  }

  const statusFilter = (params.get('status') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(
      (value): value is MaintenanceQuery['statusFilter'][number] =>
        value === 'pending' || value === 'completed'
    );

  const categoryFilter = (params.get('categories') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const telegramRaw = params.get('telegram');
  const telegramFilter: MaintenanceQuery['telegramFilter'] =
    telegramRaw === 'enabled' || telegramRaw === 'disabled'
      ? telegramRaw
      : DEFAULT_MAINTENANCE_QUERY.telegramFilter;

  return {
    from: params.get('from'),
    to: params.get('to'),
    q: params.get('q') ?? '',
    page: Math.max(1, parseInt(params.get('page') ?? '1', 10)),
    limit: normalizeAdminPageLimit(
      parseInt(params.get('limit') ?? String(ADMIN_DEFAULT_PAGE_SIZE), 10)
    ),
    view: parseAdminListView(params),
    sort,
    statusFilter,
    categoryFilter,
    telegramFilter,
  };
}

export function writeMaintenanceQueryToParams(
  query: MaintenanceQuery,
  preset?: MaintenanceRangePreset
): URLSearchParams {
  const p = new URLSearchParams();
  if (query.from) p.set('from', query.from);
  if (query.to) p.set('to', query.to);
  if (query.q.trim()) p.set('q', query.q.trim());
  if (query.page > 1) p.set('page', String(query.page));
  if (query.limit !== ADMIN_DEFAULT_PAGE_SIZE) {
    p.set('limit', String(query.limit));
  }
  if (query.view !== DEFAULT_MAINTENANCE_QUERY.view) {
    p.set('view', query.view);
  }
  if (query.sort !== DEFAULT_MAINTENANCE_QUERY.sort) {
    p.set('sort', query.sort);
  }
  if (query.statusFilter.length > 0) {
    p.set('status', query.statusFilter.join(','));
  }
  if (query.categoryFilter.length > 0) {
    p.set('categories', query.categoryFilter.join(','));
  }
  if (query.telegramFilter !== DEFAULT_MAINTENANCE_QUERY.telegramFilter) {
    p.set('telegram', query.telegramFilter);
  }
  if (preset && preset !== 'this_month') p.set('preset', preset);
  return p;
}

export function maintenanceQueryToApiParams(query: MaintenanceQuery): URLSearchParams {
  const p = new URLSearchParams();
  if (query.from) p.set('from', query.from);
  if (query.to) p.set('to', query.to);
  if (query.q.trim()) p.set('q', query.q.trim());
  return p;
}
