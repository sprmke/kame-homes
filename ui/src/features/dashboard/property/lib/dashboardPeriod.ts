/**
 * Dashboard chart period — uses the same `from` / `to` URL params as Bookings & Finance.
 */

import { endOfMonth, startOfMonth } from 'date-fns';

import { toIsoDate } from '@/lib/date/navigation';

export type DashboardPeriod = {
  from: string;
  to: string;
};

function manilaReferenceDate(reference = new Date()): Date {
  return new Date(reference.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
}

/** Default chart window: current calendar month (Asia/Manila). */
export function defaultDashboardPeriod(reference = new Date()): DashboardPeriod {
  const manila = manilaReferenceDate(reference);
  return {
    from: toIsoDate(startOfMonth(manila)),
    to: toIsoDate(endOfMonth(manila)),
  };
}

export function resolveDashboardPeriod(params: URLSearchParams): DashboardPeriod {
  const from = params.get('from');
  const to = params.get('to');
  if (from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return { from, to };
  }
  return defaultDashboardPeriod();
}

export function writeDashboardPeriodParams(
  period: DashboardPeriod,
  base?: URLSearchParams
): URLSearchParams {
  const p = new URLSearchParams(base ?? undefined);
  p.set('from', period.from);
  p.set('to', period.to);
  return p;
}
