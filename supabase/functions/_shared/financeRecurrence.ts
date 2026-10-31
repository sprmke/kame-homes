/**
 * Shared recurrence helpers for finance + maintenance — keep in sync with
 * ui/src/features/finance/lib/recurrence.ts (twice_monthly slot logic).
 */

export type RecurrenceInterval =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'twice_monthly'
  | 'every_2_months'
  | 'quarterly'
  | 'every_6_months'
  | 'yearly';

export type RecurrenceEditScope = 'this' | 'this_and_future' | 'all';

const INTERVALS: ReadonlySet<string> = new Set([
  'daily',
  'weekly',
  'monthly',
  'twice_monthly',
  'every_2_months',
  'quarterly',
  'every_6_months',
  'yearly',
]);

export function isRecurrenceInterval(v: unknown): v is RecurrenceInterval {
  return typeof v === 'string' && INTERVALS.has(v);
}

export function isRecurrenceEditScope(v: unknown): v is RecurrenceEditScope {
  return v === 'this' || v === 'this_and_future' || v === 'all';
}

function parseIso(iso: string): { y: number; m: number; d: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error('invalid_date');
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

function formatIso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function twiceMonthlySlots(
  primaryDay: number,
  y: number,
  m: number
): { first: number; second: number } {
  const dim = daysInMonth(y, m);
  const first = Math.min(primaryDay, dim);
  const second = Math.min(primaryDay + 15, dim);
  return { first, second };
}

function addTwiceMonthly(iso: string, primaryDay: number): string {
  const { y, m, d } = parseIso(iso);
  const { first, second } = twiceMonthlySlots(primaryDay, y, m);
  if (d === first && second > first) {
    return formatIso(y, m, second);
  }
  let nm = m + 1;
  let ny = y;
  if (nm > 12) {
    nm = 1;
    ny += 1;
  }
  const { first: nextFirst } = twiceMonthlySlots(primaryDay, ny, nm);
  return formatIso(ny, nm, nextFirst);
}

function subtractTwiceMonthly(iso: string, primaryDay: number): string {
  const { y, m, d } = parseIso(iso);
  const { first, second } = twiceMonthlySlots(primaryDay, y, m);
  if (d === second && second > first) {
    return formatIso(y, m, first);
  }
  let nm = m - 1;
  let ny = y;
  if (nm < 1) {
    nm = 12;
    ny -= 1;
  }
  const { first: prevFirst, second: prevSecond } = twiceMonthlySlots(primaryDay, ny, nm);
  return formatIso(ny, nm, prevSecond > prevFirst ? prevSecond : prevFirst);
}

export function addRecurrenceInterval(
  iso: string,
  interval: RecurrenceInterval,
  primaryDay?: number
): string {
  const { y, m, d } = parseIso(iso);
  const anchorDay = primaryDay ?? d;
  switch (interval) {
    case 'daily': {
      const t = Date.UTC(y, m - 1, d + 1);
      const nd = new Date(t);
      return formatIso(nd.getUTCFullYear(), nd.getUTCMonth() + 1, nd.getUTCDate());
    }
    case 'weekly': {
      const t = Date.UTC(y, m - 1, d + 7);
      const nd = new Date(t);
      return formatIso(nd.getUTCFullYear(), nd.getUTCMonth() + 1, nd.getUTCDate());
    }
    case 'monthly': {
      let nm = m + 1;
      let ny = y;
      if (nm > 12) {
        nm = 1;
        ny += 1;
      }
      const nd = Math.min(anchorDay, daysInMonth(ny, nm));
      return formatIso(ny, nm, nd);
    }
    case 'twice_monthly':
      return addTwiceMonthly(iso, anchorDay);
    case 'every_2_months': {
      let nm = m + 2;
      let ny = y;
      while (nm > 12) {
        nm -= 12;
        ny += 1;
      }
      const nd = Math.min(anchorDay, daysInMonth(ny, nm));
      return formatIso(ny, nm, nd);
    }
    case 'quarterly': {
      let nm = m + 3;
      let ny = y;
      while (nm > 12) {
        nm -= 12;
        ny += 1;
      }
      const nd = Math.min(anchorDay, daysInMonth(ny, nm));
      return formatIso(ny, nm, nd);
    }
    case 'every_6_months': {
      let nm = m + 6;
      let ny = y;
      while (nm > 12) {
        nm -= 12;
        ny += 1;
      }
      const nd = Math.min(anchorDay, daysInMonth(ny, nm));
      return formatIso(ny, nm, nd);
    }
    case 'yearly':
      return formatIso(y + 1, m, Math.min(anchorDay, daysInMonth(y + 1, m)));
  }
}

function subtractRecurrenceInterval(
  iso: string,
  interval: RecurrenceInterval,
  primaryDay?: number
): string {
  const { y, m, d } = parseIso(iso);
  const anchorDay = primaryDay ?? d;
  switch (interval) {
    case 'daily': {
      const t = Date.UTC(y, m - 1, d - 1);
      const nd = new Date(t);
      return formatIso(nd.getUTCFullYear(), nd.getUTCMonth() + 1, nd.getUTCDate());
    }
    case 'weekly': {
      const t = Date.UTC(y, m - 1, d - 7);
      const nd = new Date(t);
      return formatIso(nd.getUTCFullYear(), nd.getUTCMonth() + 1, nd.getUTCDate());
    }
    case 'monthly': {
      let nm = m - 1;
      let ny = y;
      if (nm < 1) {
        nm = 12;
        ny -= 1;
      }
      const nd = Math.min(anchorDay, daysInMonth(ny, nm));
      return formatIso(ny, nm, nd);
    }
    case 'twice_monthly':
      return subtractTwiceMonthly(iso, anchorDay);
    case 'every_2_months': {
      let nm = m - 2;
      let ny = y;
      while (nm < 1) {
        nm += 12;
        ny -= 1;
      }
      const nd = Math.min(anchorDay, daysInMonth(ny, nm));
      return formatIso(ny, nm, nd);
    }
    case 'quarterly': {
      let nm = m - 3;
      let ny = y;
      while (nm < 1) {
        nm += 12;
        ny -= 1;
      }
      const nd = Math.min(anchorDay, daysInMonth(ny, nm));
      return formatIso(ny, nm, nd);
    }
    case 'every_6_months': {
      let nm = m - 6;
      let ny = y;
      while (nm < 1) {
        nm += 12;
        ny -= 1;
      }
      const nd = Math.min(anchorDay, daysInMonth(ny, nm));
      return formatIso(ny, nm, nd);
    }
    case 'yearly':
      return formatIso(y - 1, m, Math.min(anchorDay, daysInMonth(y - 1, m)));
  }
}

function defaultRecurrenceUntil(start: string, interval: RecurrenceInterval): string {
  const { y, m, d } = parseIso(start);
  switch (interval) {
    case 'daily':
      return formatIso(y, m, Math.min(d + 90, daysInMonth(y, m))); // approx 3 months via loop below
    case 'weekly': {
      const t = Date.UTC(y, m - 1, d + 52 * 7);
      const nd = new Date(t);
      return formatIso(nd.getUTCFullYear(), nd.getUTCMonth() + 1, nd.getUTCDate());
    }
    case 'monthly':
    case 'twice_monthly':
    case 'every_2_months':
    case 'quarterly': {
      let nm = m + 24;
      let ny = y;
      while (nm > 12) {
        nm -= 12;
        ny += 1;
      }
      return formatIso(ny, nm, Math.min(d, daysInMonth(ny, nm)));
    }
    case 'every_6_months':
    case 'yearly':
      return formatIso(y + 5, m, Math.min(d, daysInMonth(y + 5, m)));
  }
}

/** Default end date for daily — 90 occurrences from start. */
export function defaultRecurrenceUntilForInterval(
  start: string,
  interval: RecurrenceInterval
): string {
  if (interval === 'daily') {
    const dates = generateRecurrenceDates(start, interval, '2099-12-31', 90);
    return dates[dates.length - 1] ?? start;
  }
  return defaultRecurrenceUntil(start, interval);
}

export function generateRecurrenceDates(
  start: string,
  interval: RecurrenceInterval,
  until: string,
  maxCount = 500,
  seriesPrimaryDay?: number
): string[] {
  if (until < start) return [start];
  const primaryDay = seriesPrimaryDay ?? parseIso(start).d;
  const dates: string[] = [];
  let cur = start;
  while (cur <= until && dates.length < maxCount) {
    dates.push(cur);
    const next = addRecurrenceInterval(cur, interval, primaryDay);
    if (next <= cur) break;
    cur = next;
  }
  return dates;
}

/** Dates stepping backward from `anchor` down to `until` (inclusive). */
export function generateRecurrenceDatesBackward(
  anchor: string,
  interval: RecurrenceInterval,
  until: string,
  maxCount = 500,
  seriesPrimaryDay?: number
): string[] {
  if (until > anchor) return [];
  const primaryDay = seriesPrimaryDay ?? parseIso(anchor).d;
  const dates: string[] = [];
  let cur = subtractRecurrenceInterval(anchor, interval, primaryDay);
  while (cur >= until && dates.length < maxCount) {
    dates.unshift(cur);
    const prev = subtractRecurrenceInterval(cur, interval, primaryDay);
    if (prev >= cur) break;
    cur = prev;
  }
  return dates;
}

/** Signed day delta between two ISO dates (to − from). */
export function daysBetweenIso(from: string, to: string): number {
  const a = parseIso(from.slice(0, 10));
  const b = parseIso(to.slice(0, 10));
  const ta = Date.UTC(a.y, a.m - 1, a.d);
  const tb = Date.UTC(b.y, b.m - 1, b.d);
  return Math.round((tb - ta) / 86_400_000);
}

export function addDaysToIso(iso: string, days: number): string {
  const { y, m, d } = parseIso(iso.slice(0, 10));
  const nd = new Date(Date.UTC(y, m - 1, d + days));
  return formatIso(nd.getUTCFullYear(), nd.getUTCMonth() + 1, nd.getUTCDate());
}
