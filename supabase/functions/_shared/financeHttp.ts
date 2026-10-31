import type { FinancePeriodBasis } from './financePeriodFilter.ts';

export function parseFinancePeriodBasis(raw: string | null): FinancePeriodBasis {
  if (raw === 'check_out' || raw === 'completed') return raw;
  return 'check_in';
}

export type FinanceListQueryParams = {
  from: string | null;
  to: string | null;
  basis: FinancePeriodBasis;
  includeCancelled: boolean;
  completedOnly: boolean;
  q?: string;
};

export function parseFinanceListQueryParams(url: URL): FinanceListQueryParams {
  const p = url.searchParams;
  const q = p.get('q');
  return {
    from: p.get('from'),
    to: p.get('to'),
    basis: parseFinancePeriodBasis(p.get('basis')),
    includeCancelled: p.get('include_cancelled') === 'true',
    completedOnly: p.get('completed_only') === 'true',
    ...(q ? { q } : {}),
  };
}

const BOOKINGS_SORT_VALUES = [
  'check_in_date:asc',
  'check_in_date:desc',
  'host_net:desc',
  'host_net:asc',
] as const;

export type FinanceBookingsSort = (typeof BOOKINGS_SORT_VALUES)[number];

export function parseFinanceBookingsSort(raw: string | null): FinanceBookingsSort {
  if (BOOKINGS_SORT_VALUES.includes(raw as FinanceBookingsSort)) {
    return raw as FinanceBookingsSort;
  }
  return 'check_in_date:desc';
}

export type FinanceExportType = 'overview' | 'stays' | 'operating' | 'combined';

export function parseFinanceExportType(raw: string | null): FinanceExportType {
  if (raw === 'transactions') return 'operating';
  if (raw === 'stays' || raw === 'operating' || raw === 'combined') return raw;
  return 'overview';
}
