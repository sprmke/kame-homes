/**
 * Finance report period filtering — keep in sync with ui/src/features/finance/lib/financePeriod.ts
 */

import { checkInDateToIso } from './bookingsListSort.ts';

export type FinancePeriodBasis = 'check_in' | 'check_out' | 'completed';

const CANCELLED = new Set(['CANCELLED']);

function bookingDateForPeriod(row: Record<string, unknown>, basis: FinancePeriodBasis): string {
  if (basis === 'completed') {
    const settled = row.settled_at;
    if (typeof settled === 'string' && settled.length >= 10) {
      return settled.slice(0, 10);
    }
    if (row.status === 'COMPLETED') {
      const updated = row.status_updated_at;
      if (typeof updated === 'string' && updated.length >= 10) {
        return updated.slice(0, 10);
      }
    }
    return '';
  }
  if (basis === 'check_out') {
    return checkInDateToIso(String(row.check_out_date ?? ''));
  }
  return checkInDateToIso(String(row.check_in_date ?? ''));
}

export function passesFinancePeriodFilter(
  row: Record<string, unknown>,
  from: string | null,
  to: string | null,
  basis: FinancePeriodBasis
): boolean {
  if (basis === 'completed' && row.status !== 'COMPLETED') return false;
  const iso = bookingDateForPeriod(row, basis);
  if (!iso) return false;
  if (from && iso < from) return false;
  if (to && iso > to) return false;
  return true;
}

export function isCancelledBooking(row: Record<string, unknown>): boolean {
  return CANCELLED.has(String(row.status ?? ''));
}
