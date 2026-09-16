/**
 * New-bookings series for Analytics Trends.
 * Per day (or week): how many bookings were *created* in that bucket during the
 * selected range, vs the same calendar dates last year. Non-cumulative — hosts
 * can see when demand actually arrived.
 */

export type PaceBookingInput = {
  createdAtIso: string;
  revenue: number;
};

export type PacePoint = {
  /** Bucket start (YYYY-MM-DD). Field name kept for API compat. */
  monthStart: string;
  reservations: number;
  revenue: number;
  reservationsLastYear: number;
  revenueLastYear: number;
};

function addDaysIso(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysInclusive(from: string, to: string): number {
  const a = new Date(`${from}T12:00:00`);
  const b = new Date(`${to}T12:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1;
}

function shiftYearIso(iso: string, years: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y + years, m - 1, d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Inclusive range end for the chart — never past today. */
export function resolveActivityWindow(
  from: string,
  to: string,
  today: string
): { rangeFrom: string; rangeTo: string } {
  const rangeTo = to < today ? to : today;
  const rangeFrom = from > rangeTo ? rangeTo : from;
  return { rangeFrom, rangeTo };
}

function sumInBucket(
  bookings: PaceBookingInput[],
  bucketFrom: string,
  bucketTo: string
): { reservations: number; revenue: number } {
  let reservations = 0;
  let revenue = 0;
  for (const booking of bookings) {
    if (!booking.createdAtIso) continue;
    if (booking.createdAtIso < bucketFrom || booking.createdAtIso > bucketTo) continue;
    reservations += 1;
    revenue = roundMoney(revenue + booking.revenue);
  }
  return { reservations, revenue };
}

/**
 * Build daily (≤45 days) or weekly buckets of new bookings created in range.
 * Last-year series uses the same calendar dates shifted −1 year.
 */
export function buildNewBookingsPoints(
  current: PaceBookingInput[],
  lastYear: PaceBookingInput[],
  rangeFrom: string,
  rangeTo: string
): PacePoint[] {
  const span = daysInclusive(rangeFrom, rangeTo);
  const useDaily = span <= 45;
  const stepDays = useDaily ? 1 : 7;
  const points: PacePoint[] = [];

  let cursor = rangeFrom;
  while (cursor <= rangeTo) {
    const bucketTo = useDaily
      ? cursor
      : addDaysIso(cursor, stepDays - 1) > rangeTo
        ? rangeTo
        : addDaysIso(cursor, stepDays - 1);

    const now = sumInBucket(current, cursor, bucketTo);
    const lyFrom = shiftYearIso(cursor, -1);
    const lyTo = shiftYearIso(bucketTo, -1);
    const ly = sumInBucket(lastYear, lyFrom, lyTo);

    points.push({
      monthStart: cursor,
      reservations: now.reservations,
      revenue: now.revenue,
      reservationsLastYear: ly.reservations,
      revenueLastYear: ly.revenue,
    });

    cursor = addDaysIso(bucketTo, 1);
  }

  return points;
}
