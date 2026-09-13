/**
 * Analytics period — uses the same `from` / `to` URL params and the same shared
 * `BookingDateRangeFilter` control as Bookings, Finance, and the property Dashboard.
 */

import { endOfMonth, startOfMonth } from 'date-fns';

import { toIsoDate } from '@/lib/date/navigation';

export type AnalyticsPeriodRange = {
  from: string;
  to: string;
};

function manilaReferenceDate(reference = new Date()): Date {
  return new Date(reference.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
}

/** Default window: current calendar month (Asia/Manila) — matches the Dashboard page. */
export function defaultAnalyticsPeriod(reference = new Date()): AnalyticsPeriodRange {
  const manila = manilaReferenceDate(reference);
  return {
    from: toIsoDate(startOfMonth(manila)),
    to: toIsoDate(endOfMonth(manila)),
  };
}

export function resolveAnalyticsPeriod(params: URLSearchParams): AnalyticsPeriodRange {
  const from = params.get('from');
  const to = params.get('to');
  if (from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return { from, to };
  }
  return defaultAnalyticsPeriod();
}

export function writeAnalyticsPeriodParams(
  period: AnalyticsPeriodRange,
  base?: URLSearchParams
): URLSearchParams {
  const p = new URLSearchParams(base ?? undefined);
  p.set('from', period.from);
  p.set('to', period.to);
  return p;
}

/** Inclusive calendar days in `from`..`to` (YYYY-MM-DD). Mirrors edge `daysInclusive`. */
export function inclusiveDayCount(from: string, to: string): number {
  const start = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}
