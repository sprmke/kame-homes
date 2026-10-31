/**
 * Finance period helpers — Manila timezone presets and URL query sync.
 */

import { format, parseISO, subDays } from 'date-fns';

import { checkInDateToIso } from '@/features/dashboard/bookings/lib/bookingsListSort';
import { parseAdminListView } from '@/features/dashboard/bookings/lib/listView';
import type { FinancePeriodBasis, FinanceQuery } from '@/features/dashboard/finance/lib/types';
import { DEFAULT_FINANCE_QUERY } from '@/features/dashboard/finance/lib/types';

import {
  detectManilaRangePreset,
  manilaRangeForPreset,
  manilaTodayIso,
  type ManilaRangePreset,
} from '@/lib/date/manilaPeriod';
import { ADMIN_DEFAULT_PAGE_SIZE, normalizeAdminPageLimit } from '@/lib/table/pagination';

/** Chart needs every stay in the period — not the paginated Stays table cap. */
export const FINANCE_CHART_BOOKINGS_LIMIT = 5000;

export type FinanceRangePreset = ManilaRangePreset;

export { manilaTodayIso };
export const rangeForPreset = manilaRangeForPreset;
export const detectPreset = detectManilaRangePreset;

export function parseFinanceQueryFromParams(params: URLSearchParams): FinanceQuery {
  const tabRaw = params.get('tab');
  const legacyView = parseAdminListView(params);
  const view: FinanceQuery['view'] =
    tabRaw === 'stays' || tabRaw === 'transactions' || tabRaw === 'overview'
      ? legacyView
      : legacyView;

  const sortRaw = params.get('sort');
  let sort: FinanceQuery['sort'] = DEFAULT_FINANCE_QUERY.sort;
  if (sortRaw === 'date:asc' || sortRaw === 'date:desc') {
    sort = sortRaw;
  } else if (sortRaw === 'amount:desc' || sortRaw === 'amount:asc') {
    sort = sortRaw;
  } else if (sortRaw === 'check_in_date:asc') {
    sort = 'date:asc';
  } else if (sortRaw === 'check_in_date:desc') {
    sort = 'date:desc';
  } else if (sortRaw === 'host_net:desc') {
    sort = 'amount:desc';
  } else if (sortRaw === 'host_net:asc') {
    sort = 'amount:asc';
  }

  const typeRaw = params.get('type');
  const typeFilter: FinanceQuery['typeFilter'] =
    typeRaw === 'income' || typeRaw === 'expense' ? typeRaw : 'all';

  const statusFilter = (params.get('status') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(
      (value): value is FinanceQuery['statusFilter'][number] =>
        value === 'completed' || value === 'pending' || value === 'canceled'
    );

  const categoryFilter = (params.get('categories') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    basis: DEFAULT_FINANCE_QUERY.basis,
    from: params.get('from'),
    to: params.get('to'),
    includeCancelled: DEFAULT_FINANCE_QUERY.includeCancelled,
    completedOnly: DEFAULT_FINANCE_QUERY.completedOnly,
    q: params.get('q') ?? '',
    page: Math.max(1, parseInt(params.get('page') ?? '1', 10)),
    limit: normalizeAdminPageLimit(
      parseInt(params.get('limit') ?? String(ADMIN_DEFAULT_PAGE_SIZE), 10)
    ),
    sort,
    view,
    typeFilter,
    statusFilter,
    categoryFilter,
  };
}

export function writeFinanceQueryToParams(
  query: FinanceQuery,
  preset?: FinanceRangePreset
): URLSearchParams {
  const p = new URLSearchParams();
  if (query.from) p.set('from', query.from);
  if (query.to) p.set('to', query.to);
  if (query.q.trim()) p.set('q', query.q.trim());
  if (query.page > 1) p.set('page', String(query.page));
  if (query.limit !== ADMIN_DEFAULT_PAGE_SIZE) {
    p.set('limit', String(query.limit));
  }
  if (query.sort !== DEFAULT_FINANCE_QUERY.sort) p.set('sort', query.sort);
  if (query.view !== 'table') p.set('view', query.view);
  if (query.typeFilter !== 'all') p.set('type', query.typeFilter);
  if (query.statusFilter.length > 0) {
    p.set('status', query.statusFilter.join(','));
  }
  if (query.categoryFilter.length > 0) {
    p.set('categories', query.categoryFilter.join(','));
  }
  if (preset && preset !== 'this_month') p.set('preset', preset);
  return p;
}

export function financeQueryToApiParams(query: FinanceQuery): URLSearchParams {
  const p = new URLSearchParams();
  p.set('basis', query.basis);
  if (query.from) p.set('from', query.from);
  if (query.to) p.set('to', query.to);
  if (query.includeCancelled) p.set('include_cancelled', 'true');
  if (query.completedOnly) p.set('completed_only', 'true');
  if (query.q.trim()) p.set('q', query.q.trim());
  return p;
}

export function ledgerSortToBookingsApiSort(
  sort: FinanceQuery['sort']
): 'check_in_date:asc' | 'check_in_date:desc' | 'host_net:desc' | 'host_net:asc' {
  switch (sort) {
    case 'date:asc':
      return 'check_in_date:asc';
    case 'amount:desc':
      return 'host_net:desc';
    case 'amount:asc':
      return 'host_net:asc';
    case 'date:desc':
    default:
      return 'check_in_date:desc';
  }
}
export function previousFinancePeriodRange(
  from: string | null,
  to: string | null
): { from: string | null; to: string | null } {
  if (!from || !to) return { from: null, to: null };
  const fromDate = parseISO(from);
  const toDate = parseISO(to);
  const lengthMs = toDate.getTime() - fromDate.getTime();
  const prevTo = subDays(fromDate, 1);
  const prevFrom = new Date(prevTo.getTime() - lengthMs);
  return {
    from: format(prevFrom, 'yyyy-MM-dd'),
    to: format(prevTo, 'yyyy-MM-dd'),
  };
}

/** YYYY-MM-DD in Asia/Manila for ISO timestamps (settled_at, status_updated_at). */
export function isoDateInManila(isoTimestamp: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(isoTimestamp));
}

function dateFromTimestamp(value: unknown): string {
  if (typeof value !== 'string' || value.length < 10) return '';
  if (value.includes('T')) return isoDateInManila(value);
  return value.slice(0, 10);
}

/** Keep in sync with supabase/functions/_shared/financePeriodFilter.ts#bookingDateForPeriod */
export type FinanceBookingDateInput = {
  status: string;
  check_in_date: string;
  check_out_date: string;
  pricing?: { settled_at?: unknown };
  status_updated_at?: string | null;
};

export function bookingDateForPeriod(
  row: FinanceBookingDateInput,
  basis: FinancePeriodBasis
): string {
  if (basis === 'completed') {
    if (row.status !== 'COMPLETED') return '';
    const settledDate = dateFromTimestamp(row.pricing?.settled_at);
    if (settledDate) return settledDate;
    return dateFromTimestamp(row.status_updated_at);
  }
  if (basis === 'check_out') {
    return checkInDateToIso(row.check_out_date);
  }
  return checkInDateToIso(row.check_in_date);
}
