/**
 * Kame Superhost criteria — rolling 365-day org metrics and assessment calendar.
 * Run: deno test --allow-env supabase/functions/_shared/superhostMetrics_test.ts
 */

import type { SupabaseClient } from './supabaseJs.ts';

import {
  calendarDaysBetween,
  manilaNowIso,
  manilaTodayYmd,
  normalizeBookingDateToYmd,
} from './calendarAvailabilityManila.ts';
import { selectInIdChunks } from './postgrestInChunks.ts';
import { countStayNights } from './utils.ts';

export const SUPERHOST_ROLLING_DAYS = 365;

export const SUPERHOST_THRESHOLDS = {
  minRating: 4.8,
  minReviews: 3,
  minResponseRate: 0.9,
  minResponseThreads: 5,
  maxCancellationRate: 0.01,
  minBookingsForCancellation: 10,
  minCompletedStays: 10,
  minStaysForNightPath: 3,
  minNightsForNightPath: 100,
} as const;

export type SuperhostCriterionSnapshot = {
  value: number;
  required: number;
  met: boolean;
  sampleSize: number;
};

export type SuperhostActivitySnapshot = SuperhostCriterionSnapshot & {
  metVia: 'ten_stays' | 'hundred_nights' | null;
  totalNights?: number;
};

export type SuperhostCriteriaSnapshot = {
  rating: SuperhostCriterionSnapshot;
  responseRate: SuperhostCriterionSnapshot;
  cancellationRate: SuperhostCriterionSnapshot;
  activity: SuperhostActivitySnapshot;
};

export type SuperhostMetricsInput = {
  reviews: { starRating: number; createdAt: string }[];
  inboxThreads: {
    firstGuestMessageAt: string;
    firstHostReplyAt: string | null;
    respondedWithin24h: boolean | null;
  }[];
  bookings: {
    id?: string;
    status: 'COMPLETED' | 'CANCELLED';
    checkOutDate: string;
    numberOfNights: number | null;
    checkInDate: string;
    /** OTA calendar sync auto-cancel (feed drop) — excluded from cancellation rate. */
    otaFeedDropCancel?: boolean;
  }[];
  asOfIso: string;
};

const QUARTER_STARTS = ['01-01', '04-01', '07-01', '10-01'] as const;

export function rollingWindowStartYmd(asOfYmd: string, days = SUPERHOST_ROLLING_DAYS): string {
  const [y, m, d] = asOfYmd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d - days));
  return dt.toISOString().slice(0, 10);
}

export function isTimestampInRollingWindow(
  iso: string,
  asOfIso: string,
  days = SUPERHOST_ROLLING_DAYS
): boolean {
  const asOfYmd = asOfIso.slice(0, 10);
  const startYmd = rollingWindowStartYmd(asOfYmd, days);
  const tsYmd = iso.slice(0, 10);
  return tsYmd >= startYmd && tsYmd <= asOfYmd;
}

export function isBookingCheckOutInWindow(
  checkOutDate: string,
  asOfYmd: string,
  days = SUPERHOST_ROLLING_DAYS
): boolean {
  const normalized = normalizeBookingDateToYmd(checkOutDate);
  if (!normalized) return false;
  const startYmd = rollingWindowStartYmd(asOfYmd, days);
  return normalized >= startYmd && normalized <= asOfYmd;
}

export function superhostAssessmentKeyFromYmd(ymd: string): string {
  const [yearStr, monthStr] = ymd.split('-');
  const month = Number(monthStr);
  const quarter = month <= 3 ? 1 : month <= 6 ? 2 : month <= 9 ? 3 : 4;
  return `${yearStr}-Q${quarter}`;
}

export function isSuperhostAssessmentDayYmd(ymd: string): boolean {
  const md = ymd.slice(5);
  return (QUARTER_STARTS as readonly string[]).includes(md);
}

/** Next quarter assessment at midnight Asia/Manila (ISO with +08:00). */
export function nextSuperhostAssessmentAtIso(fromYmd: string): string {
  const [yearStr, monthStr, dayStr] = fromYmd.split('-');
  let year = Number(yearStr);
  let month = Number(monthStr);
  const quarterStarts = [
    [1, 1],
    [4, 1],
    [7, 1],
    [10, 1],
  ] as const;

  for (const [qMonth, qDay] of quarterStarts) {
    if (month < qMonth || (month === qMonth && Number(dayStr) < qDay)) {
      return `${year}-${String(qMonth).padStart(2, '0')}-${String(qDay).padStart(2, '0')}T00:00:00+08:00`;
    }
  }
  year += 1;
  return `${year}-01-01T00:00:00+08:00`;
}

export function computeRatingMetric(
  reviews: SuperhostMetricsInput['reviews'],
  asOfIso: string
): SuperhostCriterionSnapshot {
  const inWindow = reviews.filter((r) => isTimestampInRollingWindow(r.createdAt, asOfIso));
  const sampleSize = inWindow.length;
  if (sampleSize === 0) {
    return {
      value: 0,
      required: SUPERHOST_THRESHOLDS.minRating,
      met: false,
      sampleSize: 0,
    };
  }
  const sum = inWindow.reduce((acc, r) => acc + r.starRating, 0);
  const value = Math.round((sum / sampleSize) * 100) / 100;
  return {
    value,
    required: SUPERHOST_THRESHOLDS.minRating,
    met: sampleSize >= SUPERHOST_THRESHOLDS.minReviews && value >= SUPERHOST_THRESHOLDS.minRating,
    sampleSize,
  };
}

export function computeResponseRateMetric(
  threads: SuperhostMetricsInput['inboxThreads'],
  asOfIso: string
): SuperhostCriterionSnapshot {
  const asOfMs = Date.parse(asOfIso);
  const eligible = threads.filter((t) => {
    if (!isTimestampInRollingWindow(t.firstGuestMessageAt, asOfIso)) return false;
    if (t.firstHostReplyAt) return true;
    const guestMs = Date.parse(t.firstGuestMessageAt);
    if (Number.isNaN(guestMs) || Number.isNaN(asOfMs)) return false;
    return asOfMs - guestMs >= 24 * 60 * 60 * 1000;
  });

  const sampleSize = eligible.length;
  if (sampleSize === 0) {
    return {
      value: 0,
      required: SUPERHOST_THRESHOLDS.minResponseRate,
      met: false,
      sampleSize: 0,
    };
  }

  const responded = eligible.filter((t) => t.respondedWithin24h === true).length;
  const value = Math.round((responded / sampleSize) * 1000) / 1000;
  return {
    value,
    required: SUPERHOST_THRESHOLDS.minResponseRate,
    met:
      sampleSize >= SUPERHOST_THRESHOLDS.minResponseThreads &&
      value >= SUPERHOST_THRESHOLDS.minResponseRate,
    sampleSize,
  };
}

export function computeCancellationRateMetric(
  bookings: SuperhostMetricsInput['bookings'],
  asOfYmd: string
): SuperhostCriterionSnapshot {
  const inWindow = bookings.filter(
    (b) =>
      !b.otaFeedDropCancel &&
      (b.status === 'COMPLETED' || b.status === 'CANCELLED') &&
      isBookingCheckOutInWindow(b.checkOutDate, asOfYmd)
  );
  const sampleSize = inWindow.length;
  if (sampleSize === 0) {
    return {
      value: 0,
      required: SUPERHOST_THRESHOLDS.maxCancellationRate,
      met: false,
      sampleSize: 0,
    };
  }
  const cancelled = inWindow.filter((b) => b.status === 'CANCELLED').length;
  const value = Math.round((cancelled / sampleSize) * 10000) / 10000;
  return {
    value,
    required: SUPERHOST_THRESHOLDS.maxCancellationRate,
    met:
      sampleSize >= SUPERHOST_THRESHOLDS.minBookingsForCancellation &&
      value < SUPERHOST_THRESHOLDS.maxCancellationRate,
    sampleSize,
  };
}

export function computeActivityMetric(
  bookings: SuperhostMetricsInput['bookings'],
  asOfYmd: string
): SuperhostActivitySnapshot {
  const completed = bookings.filter(
    (b) => b.status === 'COMPLETED' && isBookingCheckOutInWindow(b.checkOutDate, asOfYmd)
  );
  const sampleSize = completed.length;
  const totalNights = completed.reduce((acc, b) => {
    const nights =
      b.numberOfNights && b.numberOfNights > 0
        ? b.numberOfNights
        : countStayNights(b.checkInDate, b.checkOutDate);
    return acc + nights;
  }, 0);

  const metViaTen = sampleSize >= SUPERHOST_THRESHOLDS.minCompletedStays;
  const metViaNights =
    sampleSize >= SUPERHOST_THRESHOLDS.minStaysForNightPath &&
    totalNights >= SUPERHOST_THRESHOLDS.minNightsForNightPath;

  let metVia: SuperhostActivitySnapshot['metVia'] = null;
  if (metViaTen) metVia = 'ten_stays';
  else if (metViaNights) metVia = 'hundred_nights';

  const value = metViaTen ? sampleSize : metViaNights ? totalNights : sampleSize;
  const required =
    metViaNights && !metViaTen
      ? SUPERHOST_THRESHOLDS.minNightsForNightPath
      : SUPERHOST_THRESHOLDS.minCompletedStays;

  return {
    value,
    required,
    met: metViaTen || metViaNights,
    sampleSize,
    metVia,
    totalNights,
  };
}

export function computeSuperhostCriteria(input: SuperhostMetricsInput): SuperhostCriteriaSnapshot {
  const asOfYmd = input.asOfIso.slice(0, 10);
  return {
    rating: computeRatingMetric(input.reviews, input.asOfIso),
    responseRate: computeResponseRateMetric(input.inboxThreads, input.asOfIso),
    cancellationRate: computeCancellationRateMetric(input.bookings, asOfYmd),
    activity: computeActivityMetric(input.bookings, asOfYmd),
  };
}

export function allSuperhostCriteriaMet(criteria: SuperhostCriteriaSnapshot): boolean {
  return (
    criteria.rating.met &&
    criteria.responseRate.met &&
    criteria.cancellationRate.met &&
    criteria.activity.met
  );
}

export async function loadOtaFeedDropCancelledBookingIds(
  supabase: SupabaseClient,
  bookingIds: string[]
): Promise<Set<string>> {
  const excluded = new Set<string>();
  if (bookingIds.length === 0) return excluded;

  const rows = await selectInIdChunks(bookingIds, (chunk) =>
    supabase
      .from('calendar_sync_events')
      .select('booking_id, detail')
      .eq('action', 'booking_cancelled')
      .in('booking_id', chunk)
  );

  for (const row of rows) {
    const bookingId = row.booking_id as string | null;
    if (!bookingId) continue;
    const detail = row.detail;
    if (
      detail &&
      typeof detail === 'object' &&
      !Array.isArray(detail) &&
      (detail as Record<string, unknown>).reason === 'feed_drop'
    ) {
      excluded.add(bookingId);
    }
  }

  return excluded;
}

export async function loadOrgSuperhostMetricsInput(
  supabase: SupabaseClient,
  orgId: string,
  asOfIso = manilaNowIso()
): Promise<SuperhostMetricsInput> {
  const { data: properties, error: propError } = await supabase
    .from('properties')
    .select('id')
    .eq('organization_id', orgId);

  if (propError) throw new Error(propError.message);

  const propertyIds = (properties ?? []).map((p) => p.id as string).filter(Boolean);

  const reviewsPromise =
    propertyIds.length === 0
      ? Promise.resolve([] as { star_rating: number; created_at: string }[])
      : selectInIdChunks(propertyIds, (chunk) =>
          supabase.from('guest_reviews').select('star_rating, created_at').in('property_id', chunk)
        );

  const bookingsPromise =
    propertyIds.length === 0
      ? Promise.resolve(
          [] as {
            id: string;
            status: string;
            check_out_date: string;
            check_in_date: string;
            number_of_nights: number | null;
          }[]
        )
      : selectInIdChunks(propertyIds, (chunk) =>
          supabase
            .from('guest_submissions')
            .select('id, status, check_out_date, check_in_date, number_of_nights')
            .in('property_id', chunk)
            .in('status', ['COMPLETED', 'CANCELLED'])
        );

  const threadsPromise = supabase
    .from('inbox_thread_metrics')
    .select('first_guest_message_at, first_host_reply_at, responded_within_24h')
    .eq('organization_id', orgId)
    .then(({ data, error }) => {
      if (error) throw new Error(error.message);
      return data ?? [];
    });

  const [reviewRows, bookingRows, threadRows] = await Promise.all([
    reviewsPromise,
    bookingsPromise,
    threadsPromise,
  ]);

  const cancelledIds = bookingRows
    .filter((b) => b.status === 'CANCELLED')
    .map((b) => String(b.id))
    .filter(Boolean);
  const otaFeedDropIds = await loadOtaFeedDropCancelledBookingIds(supabase, cancelledIds);

  return {
    reviews: reviewRows.map((r) => ({
      starRating: Number(r.star_rating) || 0,
      createdAt: String(r.created_at),
    })),
    inboxThreads: threadRows.map((t) => ({
      firstGuestMessageAt: String(t.first_guest_message_at),
      firstHostReplyAt: t.first_host_reply_at ? String(t.first_host_reply_at) : null,
      respondedWithin24h:
        t.responded_within_24h === true ? true : t.responded_within_24h === false ? false : null,
    })),
    bookings: bookingRows.map((b) => ({
      id: String(b.id),
      status: b.status as 'COMPLETED' | 'CANCELLED',
      checkOutDate: String(b.check_out_date ?? ''),
      checkInDate: String(b.check_in_date ?? ''),
      numberOfNights: b.number_of_nights == null ? null : Number(b.number_of_nights),
      otaFeedDropCancel: otaFeedDropIds.has(String(b.id)),
    })),
    asOfIso,
  };
}

export async function loadAndComputeOrgSuperhostCriteria(
  supabase: SupabaseClient,
  orgId: string,
  asOfIso?: string
): Promise<SuperhostCriteriaSnapshot> {
  const input = await loadOrgSuperhostMetricsInput(supabase, orgId, asOfIso ?? manilaNowIso());
  return computeSuperhostCriteria(input);
}

export function superhostProgressSummary(asOfYmd = manilaTodayYmd()): {
  assessmentKey: string;
  nextAssessmentAt: string;
  isAssessmentDay: boolean;
} {
  return {
    assessmentKey: superhostAssessmentKeyFromYmd(asOfYmd),
    nextAssessmentAt: nextSuperhostAssessmentAtIso(asOfYmd),
    isAssessmentDay: isSuperhostAssessmentDayYmd(asOfYmd),
  };
}

/** Days until check-out within rolling window (for display helpers). */
export function nightsInRollingWindow(checkIn: string, checkOut: string, asOfYmd: string): number {
  const ci = normalizeBookingDateToYmd(checkIn);
  const co = normalizeBookingDateToYmd(checkOut);
  if (!ci || !co) return 0;
  const startYmd = rollingWindowStartYmd(asOfYmd);
  if (co <= startYmd || ci > asOfYmd) return 0;
  const effectiveIn = ci < startYmd ? startYmd : ci;
  const effectiveOut = co > asOfYmd ? asOfYmd : co;
  return calendarDaysBetween(effectiveIn, effectiveOut);
}
