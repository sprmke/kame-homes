/**
 * Host Analytics — deterministic metrics service.
 * Plan: docs/workflow/in-progress/host-analytics-module.md
 *
 * Computes on-read from guest_submissions + guest_reviews + inbox_thread_metrics for a single
 * property. No rollup table (per the plan's "compute on read until proven necessary" decision).
 * Styled after dashboardService.ts (date/bucket helpers mirrored, not imported, to keep this
 * module self-contained and avoid touching that file).
 */

import { createServiceClient } from './orgAuth.ts';
import { checkInDateToIso, manilaTodayIso } from './bookingsListSort.ts';
import {
  bookingRateForDisplay,
  computeBookingFinancials,
  dashboardNetProfitKpi,
} from './bookingFinance.ts';
import { canonicalAnalyticsChannel } from './analyticsChannel.ts';
import { bucketGuestOrigin } from './guestOriginBucketing.ts';
import { buildNewBookingsPoints, resolveActivityWindow } from './bookingPace.ts';
import { resolvePropertyEntitlements } from './planEntitlements.ts';
import { isFeatureEnabled } from './planFeatures.ts';

// ─── date helpers (mirrors dashboardService.ts conventions) ────────────────

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

function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso}T12:00:00`);
  const b = new Date(`${toIso}T12:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function calculatePercentageChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 10000) / 100;
}

function previousPeriodRange(from: string, to: string): AnalyticsPeriod {
  const length = daysInclusive(from, to);
  const prevTo = addDaysIso(from, -1);
  const prevFrom = addDaysIso(prevTo, -(length - 1));
  return { from: prevFrom, to: prevTo };
}

function lastYearPeriodRange(from: string, to: string): AnalyticsPeriod {
  const shift = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    const date = new Date(y - 1, m - 1, d, 12);
    return date.toISOString().slice(0, 10);
  };
  return { from: shift(from), to: shift(to) };
}

function occupiedNightIsoDatesForRow(
  checkInIso: string,
  checkOutIso: string,
  numberOfNights: number
): string[] {
  if (checkInIso && checkOutIso && checkInIso < checkOutIso) {
    const nights: string[] = [];
    let cursor = checkInIso;
    while (cursor < checkOutIso) {
      nights.push(cursor);
      cursor = addDaysIso(cursor, 1);
      if (nights.length > 400) break;
    }
    return nights;
  }
  if (!checkInIso) return [];
  const nights = Math.max(1, Math.floor(numberOfNights) || 1);
  return Array.from({ length: nights }, (_, index) => addDaysIso(checkInIso, index));
}

function countOccupiedNightsInRange(
  checkInIso: string,
  checkOutIso: string,
  numberOfNights: number,
  from: string,
  to: string
): number {
  return occupiedNightIsoDatesForRow(checkInIso, checkOutIso, numberOfNights).filter(
    (iso) => iso >= from && iso <= to
  ).length;
}

function stayNightCount(numberOfNights: number): number {
  if (!Number.isFinite(numberOfNights) || numberOfNights < 1) return 1;
  return Math.floor(numberOfNights);
}

function bookingRateLodgingInRange(
  row: Record<string, unknown>,
  numberOfNights: number,
  nightsInRange: number
): number {
  if (nightsInRange === 0) return 0;
  const bookingRate = bookingRateForDisplay(row) ?? 0;
  const perNight = bookingRate / stayNightCount(numberOfNights);
  return roundMoney(perNight * nightsInRange);
}

const CANCELLED = new Set(['CANCELLED']);
const SETTLED_STATUSES = new Set(['COMPLETED', 'CANCELLED']);

// ─── types ──────────────────────────────────────────────────────────────────

export type AnalyticsPeriod = { from: string; to: string };

export type AnalyticsKpi = {
  value: number;
  changePctVsPrior: number | null;
  changePctVsLastYear: number | null;
};

export type ForwardOccupancyState = 'underbooked' | 'building' | 'strong' | 'fully_booked';
export type BalanceCollectionState = 'clear' | 'attention_needed' | 'at_risk';

export type AnalyticsBundle = {
  period: AnalyticsPeriod;
  priorPeriod: AnalyticsPeriod;
  lastYearPeriod: AnalyticsPeriod;
  kpis: {
    occupancyRate: AnalyticsKpi;
    adr: AnalyticsKpi;
    revpar: AnalyticsKpi;
    grossRevenue: AnalyticsKpi;
    netProfit: AnalyticsKpi;
    reservations: AnalyticsKpi;
    nightsBooked: AnalyticsKpi;
    avgLeadTimeDays: AnalyticsKpi;
    cancellationRate: AnalyticsKpi;
    avgRating: AnalyticsKpi;
    repeatGuestRate: AnalyticsKpi;
    avgResponseMinutes: AnalyticsKpi;
    responseWithin24hRate: AnalyticsKpi;
  };
  trend: Array<{ bucketStart: string; occupancyRate: number; adr: number; revenue: number }>;
  distributions: {
    lengthOfStay: Array<{ bucket: string; count: number }>;
    leadTime: Array<{ bucket: string; count: number }>;
    channelMix: Array<{ channel: string; count: number; revenue: number }>;
    guestAge: Array<{ bucket: string; count: number }>;
    guestOrigins: Array<{ origin: string; count: number; pct: number }>;
    partySize: Array<{ bucket: string; count: number }>;
  };
  forward: {
    windowDays: number;
    nightsBooked: number;
    nightsAvailable: number;
    occupancyOnBooks: number;
    revenueOnBooks: number;
    gapNights: Array<{ date: string }>;
  };
  bookingPace: Array<{
    monthStart: string;
    /** New bookings created in this bucket (not cumulative). */
    reservations: number;
    revenue: number;
    reservationsLastYear: number;
    revenueLastYear: number;
  }>;
  pickup: { last7Days: number; last30Days: number };
  stateAssessment: {
    forwardOccupancyState30d: ForwardOccupancyState;
    forwardOccupancyState60d: ForwardOccupancyState;
    balanceCollectionState: BalanceCollectionState;
    unpaidBalanceUpcomingTotal: number;
    unpaidBalanceUpcomingCount: number;
  };
  sufficiency: { sampleSize: number; enough: boolean };
  publicPage: {
    pageViews: number;
    uniqueVisitors: number;
    topReferrers: Array<{ referrer: string; count: number }>;
  };
};

// ─── row normalization ─────────────────────────────────────────────────────

type NormalizedRow = {
  raw: Record<string, unknown>;
  status: string;
  checkInIso: string;
  checkOutIso: string;
  numberOfNights: number;
  partySize: number;
  createdAtIso: string;
  guestEmail: string;
  bookingSource: string;
  ages: number[];
};

function normalizeRow(raw: Record<string, unknown>): NormalizedRow {
  const checkInIso = checkInDateToIso(String(raw.check_in_date ?? ''));
  const checkOutIso = checkInDateToIso(String(raw.check_out_date ?? ''));
  const createdAt = typeof raw.created_at === 'string' ? raw.created_at : '';
  const ages = [
    raw.primary_guest_age,
    raw.guest2_age,
    raw.guest3_age,
    raw.guest4_age,
    raw.guest5_age,
  ]
    .map((a) => (typeof a === 'number' ? a : Number(a)))
    .filter((a) => Number.isFinite(a) && a > 0);
  const adults = Number(raw.number_of_adults ?? 0) || 0;
  const children = Number(raw.number_of_children ?? 0) || 0;
  return {
    raw,
    status: String(raw.status ?? ''),
    checkInIso,
    checkOutIso,
    numberOfNights: Number(raw.number_of_nights ?? 0) || 0,
    partySize: Math.max(0, adults + children),
    createdAtIso: createdAt ? createdAt.slice(0, 10) : '',
    guestEmail: typeof raw.guest_email === 'string' ? raw.guest_email.trim().toLowerCase() : '',
    bookingSource: canonicalAnalyticsChannel(
      typeof raw.booking_source === 'string' ? raw.booking_source : null
    ),
    ages,
  };
}

// ─── KPI snapshot ───────────────────────────────────────────────────────────

type PeriodSnapshot = {
  occupiedNights: number;
  ratedRevenue: number;
  ratedNights: number;
  netProfit: number;
  reservations: number;
  cancelled: number;
  settled: number;
  totalLeadTimeDays: number;
  leadTimeSamples: number;
  periodDays: number;
};

function computePeriodSnapshot(rows: NormalizedRow[], from: string, to: string): PeriodSnapshot {
  const snapshot: PeriodSnapshot = {
    occupiedNights: 0,
    ratedRevenue: 0,
    ratedNights: 0,
    netProfit: 0,
    reservations: 0,
    cancelled: 0,
    settled: 0,
    totalLeadTimeDays: 0,
    leadTimeSamples: 0,
    periodDays: daysInclusive(from, to),
  };

  for (const row of rows) {
    if (!row.checkInIso) continue;
    const checkInInRange = row.checkInIso >= from && row.checkInIso <= to;

    if (!CANCELLED.has(row.status)) {
      const nightsInRange = countOccupiedNightsInRange(
        row.checkInIso,
        row.checkOutIso,
        row.numberOfNights,
        from,
        to
      );
      snapshot.occupiedNights += nightsInRange;
      if (nightsInRange > 0) {
        snapshot.ratedRevenue = roundMoney(
          snapshot.ratedRevenue +
            bookingRateLodgingInRange(row.raw, row.numberOfNights, nightsInRange)
        );
        snapshot.ratedNights += nightsInRange;
      }
    }

    if (checkInInRange) {
      if (!CANCELLED.has(row.status)) {
        snapshot.reservations += 1;
        snapshot.netProfit = roundMoney(snapshot.netProfit + dashboardNetProfitKpi(row.raw));
        if (row.createdAtIso) {
          const leadTime = daysBetween(row.createdAtIso, row.checkInIso);
          if (leadTime >= 0) {
            snapshot.totalLeadTimeDays += leadTime;
            snapshot.leadTimeSamples += 1;
          }
        }
      }
      if (SETTLED_STATUSES.has(row.status)) {
        snapshot.settled += 1;
        if (row.status === 'CANCELLED') snapshot.cancelled += 1;
      }
    }
  }

  return snapshot;
}

function kpiFromSnapshots(
  extract: (s: PeriodSnapshot) => number,
  current: PeriodSnapshot,
  prior: PeriodSnapshot,
  lastYear: PeriodSnapshot
): AnalyticsKpi {
  const value = extract(current);
  return {
    value,
    changePctVsPrior: calculatePercentageChange(value, extract(prior)),
    changePctVsLastYear: calculatePercentageChange(value, extract(lastYear)),
  };
}

// ─── main entry point ───────────────────────────────────────────────────────

export type ComputeAnalyticsBundleParams = {
  propertyId: string;
  from: string;
  to: string;
};

export async function computeAnalyticsBundle(
  params: ComputeAnalyticsBundleParams
): Promise<AnalyticsBundle> {
  const { propertyId, from, to } = params;
  const priorPeriod = previousPeriodRange(from, to);
  const lastYearPeriod = lastYearPeriodRange(from, to);
  const today = manilaTodayIso();

  const forwardWindowDays = 90;
  const forwardTo = addDaysIso(today, forwardWindowDays - 1);
  const baselineFrom = addDaysIso(today, -90);

  // Widest possible window across everything the bundle needs, in one query.
  const queryFromCandidates = [priorPeriod.from, lastYearPeriod.from, baselineFrom, from];
  const queryToCandidates = [to, forwardTo, today];
  const queryFrom = queryFromCandidates.sort()[0];
  const queryTo = queryToCandidates.sort().slice(-1)[0];

  const supabase = createServiceClient();

  const { data: bookingRows, error: bookingsError } = await supabase
    .from('guest_submissions')
    .select(
      'status, check_in_date, check_out_date, number_of_nights, created_at, guest_email, ' +
        'booking_source, primary_guest_age, guest2_age, guest3_age, guest4_age, guest5_age, ' +
        'number_of_adults, number_of_children, ' +
        'booking_rate, down_payment, balance, security_deposit, guest_additional_fee, pet_fee, ' +
        'parking_rate_guest, parking_rate_paid, has_pets, need_parking, guest_balance_paid_amount, ' +
        'sd_additional_expense_items, sd_additional_profit_items, sd_additional_expenses, ' +
        'sd_additional_profits, next_stay_voucher_code, next_stay_voucher_amount, guest_address, nationality'
    )
    .eq('property_id', propertyId)
    // check_in_date is legacy mixed-format TEXT, unsafe to range-filter in SQL — order by
    // created_at desc so a cap (if a property ever exceeds it) drops old history, not
    // recent/forward-looking bookings.
    .order('created_at', { ascending: false })
    .limit(5000);

  if (bookingsError) throw new Error(bookingsError.message);

  const rows = (bookingRows ?? []).map(normalizeRow).filter((r) => r.checkInIso);
  const inWindow = rows.filter((r) => r.checkInIso >= queryFrom && r.checkInIso <= queryTo);

  // For an all-time sample-size gate we need slightly more than the query window, but a 5000
  // row per-property cap already covers realistic property lifetimes at this stage.
  const allNonCancelledEver = rows.filter((r) => !CANCELLED.has(r.status));

  const currentSnapshot = computePeriodSnapshot(inWindow, from, to);
  const priorSnapshot = computePeriodSnapshot(inWindow, priorPeriod.from, priorPeriod.to);
  const lastYearSnapshot = computePeriodSnapshot(inWindow, lastYearPeriod.from, lastYearPeriod.to);

  const kpis = buildKpis({
    current: currentSnapshot,
    prior: priorSnapshot,
    lastYear: lastYearSnapshot,
    rowsInPeriod: inWindow.filter((r) => r.checkInIso >= from && r.checkInIso <= to),
    propertyId,
    from,
    to,
    priorPeriod,
    lastYearPeriod,
    supabase,
  });

  const trend = buildTrend(inWindow, from, to);
  const distributions = await buildDistributions(inWindow, from, to);
  const forward = buildForward(rows, today, forwardTo, forwardWindowDays);
  const bookingPace = buildBookingPace(rows, from, to, today);
  const pickup = buildPickup(rows, today);
  const stateAssessment = buildStateAssessment(rows, today, currentSnapshot, priorSnapshot);

  const publicPage = buildPublicPageMetrics(supabase, propertyId, from, to);

  const [resolvedKpis, resolvedDistributions, resolvedPublicPage] = await Promise.all([
    kpis,
    distributions,
    publicPage,
  ]);

  return {
    period: { from, to },
    priorPeriod,
    lastYearPeriod,
    kpis: resolvedKpis,
    trend,
    distributions: resolvedDistributions,
    forward,
    bookingPace,
    pickup,
    stateAssessment,
    sufficiency: {
      sampleSize: allNonCancelledEver.length,
      enough: allNonCancelledEver.length >= 10,
    },
    publicPage: resolvedPublicPage,
  };
}

// ─── public page performance (Phase 2b) ────────────────────────────────────

async function buildPublicPageMetrics(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  propertyId: string,
  from: string,
  to: string
): Promise<AnalyticsBundle['publicPage']> {
  const { data, error } = await supabase
    .from('property_page_views')
    .select('session_id, referrer_host, is_bot')
    .eq('property_id', propertyId)
    .gte('viewed_at', `${from}T00:00:00Z`)
    .lte('viewed_at', `${to}T23:59:59Z`)
    .eq('is_bot', false)
    .limit(20000);
  if (error) throw new Error(error.message);

  type ViewRow = { session_id: string; referrer_host: string | null };
  const rows = (data ?? []) as ViewRow[];

  const uniqueSessions = new Set(rows.map((r) => r.session_id));
  const referrerCounts = new Map<string, number>();
  for (const row of rows) {
    const referrer = row.referrer_host || 'Direct';
    referrerCounts.set(referrer, (referrerCounts.get(referrer) ?? 0) + 1);
  }

  const topReferrers = [...referrerCounts.entries()]
    .map(([referrer, count]) => ({ referrer, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return {
    pageViews: rows.length,
    uniqueVisitors: uniqueSessions.size,
    topReferrers,
  };
}

// ─── KPI assembly (incl. queries that don't fit the single bookings load) ──

async function buildKpis(args: {
  current: PeriodSnapshot;
  prior: PeriodSnapshot;
  lastYear: PeriodSnapshot;
  rowsInPeriod: NormalizedRow[];
  propertyId: string;
  from: string;
  to: string;
  priorPeriod: AnalyticsPeriod;
  lastYearPeriod: AnalyticsPeriod;
  // deno-lint-ignore no-explicit-any
  supabase: any;
}): Promise<AnalyticsBundle['kpis']> {
  const {
    current,
    prior,
    lastYear,
    rowsInPeriod,
    propertyId,
    from,
    to,
    priorPeriod,
    lastYearPeriod,
    supabase,
  } = args;

  const occupancyRate = kpiFromSnapshots(
    (s) => (s.periodDays > 0 ? roundMoney((s.occupiedNights / s.periodDays) * 100) : 0),
    current,
    prior,
    lastYear
  );
  const adr = kpiFromSnapshots(
    (s) => (s.ratedNights > 0 ? roundMoney(s.ratedRevenue / s.ratedNights) : 0),
    current,
    prior,
    lastYear
  );
  const revpar = kpiFromSnapshots(
    (s) => (s.periodDays > 0 ? roundMoney(s.ratedRevenue / s.periodDays) : 0),
    current,
    prior,
    lastYear
  );
  const grossRevenue = kpiFromSnapshots((s) => s.ratedRevenue, current, prior, lastYear);
  const netProfit = kpiFromSnapshots((s) => s.netProfit, current, prior, lastYear);
  const reservations = kpiFromSnapshots((s) => s.reservations, current, prior, lastYear);
  const nightsBooked = kpiFromSnapshots((s) => s.occupiedNights, current, prior, lastYear);
  const avgLeadTimeDays = kpiFromSnapshots(
    (s) => (s.leadTimeSamples > 0 ? roundMoney(s.totalLeadTimeDays / s.leadTimeSamples) : 0),
    current,
    prior,
    lastYear
  );
  const cancellationRate = kpiFromSnapshots(
    (s) => (s.settled > 0 ? roundMoney((s.cancelled / s.settled) * 100) : 0),
    current,
    prior,
    lastYear
  );

  const [avgRating, repeatGuestRate, responsiveness] = await Promise.all([
    computeAvgRatingKpi(supabase, propertyId, { from, to }, priorPeriod, lastYearPeriod),
    computeRepeatGuestRateKpi(rowsInPeriod, priorPeriod, lastYearPeriod, propertyId, supabase),
    computeResponsivenessKpis(supabase, propertyId, { from, to }, priorPeriod, lastYearPeriod),
  ]);

  return {
    occupancyRate,
    adr,
    revpar,
    grossRevenue,
    netProfit,
    reservations,
    nightsBooked,
    avgLeadTimeDays,
    cancellationRate,
    avgRating,
    repeatGuestRate,
    avgResponseMinutes: responsiveness.avgResponseMinutes,
    responseWithin24hRate: responsiveness.responseWithin24hRate,
  };
}

async function computeAvgRatingKpi(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  propertyId: string,
  period: AnalyticsPeriod,
  priorPeriod: AnalyticsPeriod,
  lastYearPeriod: AnalyticsPeriod
): Promise<AnalyticsKpi> {
  const { data, error } = await supabase
    .from('guest_reviews')
    .select('star_rating, created_at')
    .eq('property_id', propertyId)
    .gte('created_at', `${lastYearPeriod.from}T00:00:00Z`)
    .lte('created_at', `${period.to}T23:59:59Z`)
    .limit(2000);
  if (error) throw new Error(error.message);

  const avgFor = (rangeFrom: string, rangeTo: string) => {
    const inRange = (data ?? []).filter((r: { created_at: string }) => {
      const iso = r.created_at.slice(0, 10);
      return iso >= rangeFrom && iso <= rangeTo;
    });
    if (inRange.length === 0) return 0;
    const sum = inRange.reduce((acc: number, r: { star_rating: number }) => acc + r.star_rating, 0);
    return roundMoney(sum / inRange.length);
  };

  const value = avgFor(period.from, period.to);
  return {
    value,
    changePctVsPrior: calculatePercentageChange(value, avgFor(priorPeriod.from, priorPeriod.to)),
    changePctVsLastYear: calculatePercentageChange(
      value,
      avgFor(lastYearPeriod.from, lastYearPeriod.to)
    ),
  };
}

async function computeRepeatGuestRateKpi(
  rowsInPeriod: NormalizedRow[],
  _priorPeriod: AnalyticsPeriod,
  _lastYearPeriod: AnalyticsPeriod,
  propertyId: string,
  // deno-lint-ignore no-explicit-any
  supabase: any
): Promise<AnalyticsKpi> {
  const emailsInPeriod = [...new Set(rowsInPeriod.map((r) => r.guestEmail).filter(Boolean))];
  if (emailsInPeriod.length === 0) {
    return { value: 0, changePctVsPrior: null, changePctVsLastYear: null };
  }

  const { data, error } = await supabase
    .from('guest_submissions')
    .select('guest_email, check_in_date')
    .eq('property_id', propertyId)
    .in('guest_email', emailsInPeriod)
    .limit(5000);
  if (error) throw new Error(error.message);

  const earliestCheckInByEmail = new Map<string, string>();
  for (const row of data ?? []) {
    const email = typeof row.guest_email === 'string' ? row.guest_email.trim().toLowerCase() : '';
    const iso = checkInDateToIso(String(row.check_in_date ?? ''));
    if (!email || !iso) continue;
    const existing = earliestCheckInByEmail.get(email);
    if (!existing || iso < existing) earliestCheckInByEmail.set(email, iso);
  }

  let repeatCount = 0;
  for (const row of rowsInPeriod) {
    if (!row.guestEmail) continue;
    const earliest = earliestCheckInByEmail.get(row.guestEmail);
    if (earliest && earliest < row.checkInIso) repeatCount += 1;
  }

  const value = roundMoney((repeatCount / rowsInPeriod.length) * 100);
  return { value, changePctVsPrior: null, changePctVsLastYear: null };
}

async function computeResponsivenessKpis(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  propertyId: string,
  period: AnalyticsPeriod,
  priorPeriod: AnalyticsPeriod,
  lastYearPeriod: AnalyticsPeriod
): Promise<{ avgResponseMinutes: AnalyticsKpi; responseWithin24hRate: AnalyticsKpi }> {
  const { data, error } = await supabase
    .from('inbox_thread_metrics')
    .select(
      'first_guest_message_at, first_host_reply_at, responded_within_24h, conversation:social_conversations!inner(property_id)'
    )
    .eq('conversation.property_id', propertyId)
    .gte('first_guest_message_at', `${lastYearPeriod.from}T00:00:00Z`)
    .lte('first_guest_message_at', `${period.to}T23:59:59Z`)
    .limit(5000);
  if (error) throw new Error(error.message);

  type ThreadRow = {
    first_guest_message_at: string;
    first_host_reply_at: string | null;
    responded_within_24h: boolean | null;
  };

  const rows = (data ?? []) as ThreadRow[];

  const computeFor = (rangeFrom: string, rangeTo: string) => {
    const inRange = rows.filter((r) => {
      const iso = r.first_guest_message_at.slice(0, 10);
      return iso >= rangeFrom && iso <= rangeTo;
    });
    const replied = inRange.filter((r) => r.first_host_reply_at);
    const avgMinutes =
      replied.length > 0
        ? roundMoney(
            replied.reduce((acc, r) => {
              const mins =
                (new Date(r.first_host_reply_at as string).getTime() -
                  new Date(r.first_guest_message_at).getTime()) /
                60000;
              return acc + Math.max(0, mins);
            }, 0) / replied.length
          )
        : 0;
    const eligible = inRange.filter((r) => r.responded_within_24h !== null);
    const within24h = eligible.filter((r) => r.responded_within_24h === true);
    const rate = eligible.length > 0 ? roundMoney((within24h.length / eligible.length) * 100) : 0;
    return { avgMinutes, rate };
  };

  const current = computeFor(period.from, period.to);
  const prior = computeFor(priorPeriod.from, priorPeriod.to);
  const lastYear = computeFor(lastYearPeriod.from, lastYearPeriod.to);

  return {
    avgResponseMinutes: {
      value: current.avgMinutes,
      changePctVsPrior: calculatePercentageChange(current.avgMinutes, prior.avgMinutes),
      changePctVsLastYear: calculatePercentageChange(current.avgMinutes, lastYear.avgMinutes),
    },
    responseWithin24hRate: {
      value: current.rate,
      changePctVsPrior: calculatePercentageChange(current.rate, prior.rate),
      changePctVsLastYear: calculatePercentageChange(current.rate, lastYear.rate),
    },
  };
}

// ─── trend series ───────────────────────────────────────────────────────────

function trendBucketDayCount(
  bucketStart: string,
  from: string,
  to: string,
  daily: boolean
): number {
  if (daily) return 1;
  const [y, m] = bucketStart.split('-').map(Number);
  const monthEnd = new Date(y, m, 0).toISOString().slice(0, 10);
  const start = bucketStart < from ? from : bucketStart;
  const end = monthEnd > to ? to : monthEnd;
  return daysInclusive(start, end);
}

function buildTrend(rows: NormalizedRow[], from: string, to: string): AnalyticsBundle['trend'] {
  const daily = daysInclusive(from, to) <= 62;
  const buckets = new Map<string, { nights: Set<string>; revenueByNight: Map<string, number> }>();

  const bucketKey = (iso: string) => (daily ? iso : `${iso.slice(0, 7)}-01`);

  let cursor = from;
  while (cursor <= to) {
    buckets.set(bucketKey(cursor), { nights: new Set(), revenueByNight: new Map() });
    cursor = addDaysIso(cursor, 1);
  }

  for (const row of rows) {
    if (CANCELLED.has(row.status) || !row.checkInIso) continue;
    const nightIsoDates = occupiedNightIsoDatesForRow(
      row.checkInIso,
      row.checkOutIso,
      row.numberOfNights
    );
    const perNightRate = (bookingRateForDisplay(row.raw) ?? 0) / stayNightCount(row.numberOfNights);
    for (const iso of nightIsoDates) {
      if (iso < from || iso > to) continue;
      const key = bucketKey(iso);
      const bucket = buckets.get(key);
      if (!bucket) continue;
      bucket.nights.add(iso);
      const prev = bucket.revenueByNight.get(iso) ?? 0;
      bucket.revenueByNight.set(iso, roundMoney(Math.max(prev, perNightRate)));
    }
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bucketStart, { nights, revenueByNight }]) => {
      const occupied = nights.size;
      const denom = trendBucketDayCount(bucketStart, from, to, daily);
      const revenue = [...revenueByNight.values()].reduce((sum, n) => roundMoney(sum + n), 0);
      const occupancyRate = denom > 0 ? roundMoney(Math.min(100, (occupied / denom) * 100)) : 0;
      return {
        bucketStart,
        occupancyRate,
        adr: occupied > 0 ? roundMoney(revenue / occupied) : 0,
        revenue,
      };
    });
}

// ─── distributions ──────────────────────────────────────────────────────────

const LOS_BUCKETS: Array<{ label: string; max: number }> = [
  { label: '1 night', max: 1 },
  { label: '2-3 nights', max: 3 },
  { label: '4-6 nights', max: 6 },
  { label: '7-13 nights', max: 13 },
  { label: '14+ nights', max: Infinity },
];

const LEAD_TIME_BUCKETS: Array<{ label: string; max: number }> = [
  { label: '0-3 days', max: 3 },
  { label: '4-7 days', max: 7 },
  { label: '8-14 days', max: 14 },
  { label: '15-30 days', max: 30 },
  { label: '31-60 days', max: 60 },
  { label: '61+ days', max: Infinity },
];

const PARTY_SIZE_BUCKETS: Array<{ label: string; max: number }> = [
  { label: '1', max: 1 },
  { label: '2', max: 2 },
  { label: '3', max: 3 },
  { label: '4', max: 4 },
  { label: '5+', max: Infinity },
];

const AGE_BUCKETS: Array<{ label: string; min: number; max: number }> = [
  { label: 'Under 18', min: 0, max: 17 },
  { label: '18-24', min: 18, max: 24 },
  { label: '25-34', min: 25, max: 34 },
  { label: '35-44', min: 35, max: 44 },
  { label: '45-54', min: 45, max: 54 },
  { label: '55-64', min: 55, max: 64 },
  { label: '65+', min: 65, max: Infinity },
];

function bucketFor(value: number, table: Array<{ label: string; max: number }>): string {
  for (const entry of table) {
    if (value <= entry.max) return entry.label;
  }
  return table[table.length - 1].label;
}

async function buildDistributions(
  rows: NormalizedRow[],
  from: string,
  to: string
): Promise<AnalyticsBundle['distributions']> {
  const inPeriod = rows.filter(
    (r) => !CANCELLED.has(r.status) && r.checkInIso >= from && r.checkInIso <= to
  );

  const losCounts = new Map<string, number>();
  const leadTimeCounts = new Map<string, number>();
  const partySizeCounts = new Map<string, number>();
  const channelCounts = new Map<string, { count: number; revenue: number }>();
  const ageCounts = new Map<string, number>();
  let unknownAgeGuests = 0;
  const originCounts = new Map<string, number>();

  for (const row of inPeriod) {
    const losBucket = bucketFor(row.numberOfNights, LOS_BUCKETS);
    losCounts.set(losBucket, (losCounts.get(losBucket) ?? 0) + 1);

    if (row.partySize > 0) {
      const paxBucket = bucketFor(row.partySize, PARTY_SIZE_BUCKETS);
      partySizeCounts.set(paxBucket, (partySizeCounts.get(paxBucket) ?? 0) + 1);
    }

    if (row.createdAtIso) {
      const lead = daysBetween(row.createdAtIso, row.checkInIso);
      if (lead >= 0) {
        const key = bucketFor(lead, LEAD_TIME_BUCKETS);
        leadTimeCounts.set(key, (leadTimeCounts.get(key) ?? 0) + 1);
      }
    }

    const channel = channelCounts.get(row.bookingSource) ?? { count: 0, revenue: 0 };
    channel.count += 1;
    channel.revenue = roundMoney(channel.revenue + (bookingRateForDisplay(row.raw) ?? 0));
    channelCounts.set(row.bookingSource, channel);

    if (row.ages.length === 0) {
      unknownAgeGuests += 1;
    } else {
      for (const age of row.ages) {
        const key = bucketFor(age, AGE_BUCKETS);
        ageCounts.set(key, (ageCounts.get(key) ?? 0) + 1);
      }
    }

    const origin = bucketGuestOrigin(
      typeof row.raw.guest_address === 'string' ? row.raw.guest_address : null,
      typeof row.raw.nationality === 'string' ? row.raw.nationality : null
    );
    originCounts.set(origin, (originCounts.get(origin) ?? 0) + 1);
  }

  if (unknownAgeGuests > 0) {
    ageCounts.set('Unknown', (ageCounts.get('Unknown') ?? 0) + unknownAgeGuests);
  }

  const totalOriginGuests = [...originCounts.values()].reduce((a, b) => a + b, 0);

  return {
    lengthOfStay: [...losCounts.entries()].map(([bucket, count]) => ({ bucket, count })),
    leadTime: [...leadTimeCounts.entries()].map(([bucket, count]) => ({ bucket, count })),
    partySize: [...partySizeCounts.entries()].map(([bucket, count]) => ({ bucket, count })),
    channelMix: [...channelCounts.entries()].map(([channel, v]) => ({ channel, ...v })),
    guestAge: [...ageCounts.entries()].map(([bucket, count]) => ({ bucket, count })),
    guestOrigins: [...originCounts.entries()]
      .map(([origin, count]) => ({
        origin,
        count,
        pct: totalOriginGuests > 0 ? roundMoney((count / totalOriginGuests) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count),
  };
}

// ─── forward-looking (Phase 2) ──────────────────────────────────────────────

function buildForward(
  rows: NormalizedRow[],
  today: string,
  forwardTo: string,
  windowDays: number
): AnalyticsBundle['forward'] {
  const bookedIso = new Set<string>();
  let revenueOnBooks = 0;

  for (const row of rows) {
    if (CANCELLED.has(row.status) || !row.checkInIso) continue;
    const perNightRate = (bookingRateForDisplay(row.raw) ?? 0) / stayNightCount(row.numberOfNights);
    for (const iso of occupiedNightIsoDatesForRow(
      row.checkInIso,
      row.checkOutIso,
      row.numberOfNights
    )) {
      if (iso < today || iso > forwardTo) continue;
      if (!bookedIso.has(iso)) {
        bookedIso.add(iso);
        revenueOnBooks = roundMoney(revenueOnBooks + perNightRate);
      }
    }
  }

  const gapNights: Array<{ date: string }> = [];
  let cursor = today;
  while (cursor <= forwardTo) {
    if (!bookedIso.has(cursor)) gapNights.push({ date: cursor });
    cursor = addDaysIso(cursor, 1);
  }

  return {
    windowDays,
    nightsBooked: bookedIso.size,
    nightsAvailable: windowDays,
    occupancyOnBooks: roundMoney((bookedIso.size / windowDays) * 100),
    revenueOnBooks,
    gapNights: gapNights.slice(0, 60),
  };
}

// ─── booking pace + pickup (Phase 2) ────────────────────────────────────────

function monthStartIso(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

function monthEndIso(monthStart: string): string {
  const [y, m] = monthStart.split('-').map(Number);
  return new Date(y, m, 0).toISOString().slice(0, 10);
}

function addMonthStart(monthStart: string): string {
  const [y, m] = monthStart.split('-').map(Number);
  return new Date(y, m, 1).toISOString().slice(0, 10);
}

function shiftYearIso(iso: string, years: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y + years, m - 1, d, 12).toISOString().slice(0, 10);
}

/**
 * New bookings created during the selected range (daily or weekly buckets),
 * vs the same calendar dates last year. Non-cumulative — shows when demand arrived.
 */
function buildBookingPace(
  rows: NormalizedRow[],
  from: string,
  to: string,
  today: string
): AnalyticsBundle['bookingPace'] {
  const { rangeFrom, rangeTo } = resolveActivityWindow(from, to, today);
  const lyFrom = shiftYearIso(rangeFrom, -1);
  const lyTo = shiftYearIso(rangeTo, -1);

  const toPaceBooking = (row: NormalizedRow) => ({
    createdAtIso: row.createdAtIso,
    revenue: bookingRateForDisplay(row.raw) ?? 0,
  });

  const current = rows
    .filter(
      (row) =>
        !CANCELLED.has(row.status) &&
        row.createdAtIso &&
        row.createdAtIso >= rangeFrom &&
        row.createdAtIso <= rangeTo
    )
    .map(toPaceBooking);

  const lastYear = rows
    .filter(
      (row) =>
        !CANCELLED.has(row.status) &&
        row.createdAtIso &&
        row.createdAtIso >= lyFrom &&
        row.createdAtIso <= lyTo
    )
    .map(toPaceBooking);

  return buildNewBookingsPoints(current, lastYear, rangeFrom, rangeTo);
}

function buildPickup(rows: NormalizedRow[], today: string): AnalyticsBundle['pickup'] {
  const since7 = addDaysIso(today, -7);
  const since30 = addDaysIso(today, -30);
  let last7Days = 0;
  let last30Days = 0;

  for (const row of rows) {
    if (CANCELLED.has(row.status) || !row.createdAtIso || row.checkInIso < today) continue;
    if (row.createdAtIso >= since30) last30Days += 1;
    if (row.createdAtIso >= since7) last7Days += 1;
  }

  return { last7Days, last30Days };
}

// ─── state assessment ───────────────────────────────────────────────────────

/**
 * Occupancy-state thresholds — calibrated per property against its own trailing baseline, not
 * a fixed global number (a beach property's "strong" occupancy differs from a city condo's).
 * Shared by buildStateAssessment (property page) and computePropertyPortfolioRow (org rollup)
 * so a future threshold tune only has one place to change.
 */
const FULLY_BOOKED_THRESHOLD = 0.85;

function classifyForwardOccupancyState(rate: number, trailingRate: number): ForwardOccupancyState {
  if (rate >= FULLY_BOOKED_THRESHOLD) return 'fully_booked';
  if (rate >= Math.max(trailingRate * 1.1, 0.6)) return 'strong';
  if (rate >= Math.max(trailingRate * 0.7, 0.3)) return 'building';
  return 'underbooked';
}

function computeTrailingOccupancyRate(rows: NormalizedRow[], today: string): number {
  const trailingFrom = addDaysIso(today, -90);
  const trailingSnapshot = computePeriodSnapshot(rows, trailingFrom, addDaysIso(today, -1));
  return trailingSnapshot.periodDays > 0
    ? trailingSnapshot.occupiedNights / trailingSnapshot.periodDays
    : 0;
}

function computeForwardOccupancyRate(
  rows: NormalizedRow[],
  today: string,
  windowDays: number
): number {
  const to = addDaysIso(today, windowDays - 1);
  const snapshot = computePeriodSnapshot(rows, today, to);
  return snapshot.periodDays > 0 ? snapshot.occupiedNights / snapshot.periodDays : 0;
}

function buildStateAssessment(
  rows: NormalizedRow[],
  today: string,
  currentSnapshot: PeriodSnapshot,
  _priorSnapshot: PeriodSnapshot
): AnalyticsBundle['stateAssessment'] {
  const trailingRate = computeTrailingOccupancyRate(rows, today);

  const forwardOccupancyState30d = classifyForwardOccupancyState(
    computeForwardOccupancyRate(rows, today, 30),
    trailingRate
  );
  const forwardOccupancyState60d = classifyForwardOccupancyState(
    computeForwardOccupancyRate(rows, today, 60),
    trailingRate
  );

  const balanceHorizon = addDaysIso(today, 13);
  let unpaidBalanceUpcomingTotal = 0;
  let unpaidBalanceUpcomingCount = 0;
  let atRisk = false;

  for (const row of rows) {
    if (CANCELLED.has(row.status) || row.status === 'COMPLETED') continue;
    if (!row.checkInIso || row.checkInIso < today || row.checkInIso > balanceHorizon) continue;
    const fin = computeBookingFinancials(row.raw);
    if (fin.guestUnpaid != null && fin.guestUnpaid > 0) {
      unpaidBalanceUpcomingTotal = roundMoney(unpaidBalanceUpcomingTotal + fin.guestUnpaid);
      unpaidBalanceUpcomingCount += 1;
      if (row.checkInIso <= addDaysIso(today, 3)) atRisk = true;
    }
  }

  const balanceCollectionState: BalanceCollectionState =
    unpaidBalanceUpcomingCount === 0 ? 'clear' : atRisk ? 'at_risk' : 'attention_needed';

  void currentSnapshot;

  return {
    forwardOccupancyState30d,
    forwardOccupancyState60d,
    balanceCollectionState,
    unpaidBalanceUpcomingTotal,
    unpaidBalanceUpcomingCount,
  };
}

// ─── org portfolio row (Phase 5 — lighter-weight than the full bundle) ─────

export type PropertyPortfolioRow = {
  propertyId: string;
  occupancyRate: number;
  adr: number;
  revpar: number;
  grossRevenue: number;
  reservations: number;
  cancellationRate: number;
  forwardOccupancyState30d: ForwardOccupancyState;
  balanceCollectionState: BalanceCollectionState;
};

/**
 * A single property's portfolio-comparison row — only what the org leaderboard needs, skipping
 * the guest-review/inbox/page-view queries the full bundle makes. One bookings query per
 * property; kept intentionally light since the org page may call this for every property in
 * the org.
 */
export async function computePropertyPortfolioRow(
  propertyId: string,
  from: string,
  to: string
): Promise<PropertyPortfolioRow> {
  const today = manilaTodayIso();
  const supabase = createServiceClient();

  const { data: bookingRows, error } = await supabase
    .from('guest_submissions')
    .select(
      'status, check_in_date, check_out_date, number_of_nights, created_at, ' +
        'booking_rate, down_payment, balance, security_deposit, guest_additional_fee, pet_fee, ' +
        'parking_rate_guest, parking_rate_paid, has_pets, need_parking, guest_balance_paid_amount, ' +
        'sd_additional_expense_items, sd_additional_profit_items, sd_additional_expenses, ' +
        'sd_additional_profits, next_stay_voucher_code, next_stay_voucher_amount'
    )
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false })
    .limit(5000);
  if (error) throw new Error(error.message);

  const rows = (bookingRows ?? []).map(normalizeRow).filter((r) => r.checkInIso);
  const snapshot = computePeriodSnapshot(rows, from, to);

  const trailingRate = computeTrailingOccupancyRate(rows, today);
  const forwardOccupancyState30d = classifyForwardOccupancyState(
    computeForwardOccupancyRate(rows, today, 30),
    trailingRate
  );

  const balanceHorizon = addDaysIso(today, 13);
  let unpaidCount = 0;
  let atRisk = false;
  for (const row of rows) {
    if (CANCELLED.has(row.status) || row.status === 'COMPLETED') continue;
    if (!row.checkInIso || row.checkInIso < today || row.checkInIso > balanceHorizon) continue;
    const fin = computeBookingFinancials(row.raw);
    if (fin.guestUnpaid != null && fin.guestUnpaid > 0) {
      unpaidCount += 1;
      if (row.checkInIso <= addDaysIso(today, 3)) atRisk = true;
    }
  }
  const balanceCollectionState: BalanceCollectionState =
    unpaidCount === 0 ? 'clear' : atRisk ? 'at_risk' : 'attention_needed';

  return {
    propertyId,
    occupancyRate:
      snapshot.periodDays > 0
        ? roundMoney((snapshot.occupiedNights / snapshot.periodDays) * 100)
        : 0,
    adr: snapshot.ratedNights > 0 ? roundMoney(snapshot.ratedRevenue / snapshot.ratedNights) : 0,
    revpar: snapshot.periodDays > 0 ? roundMoney(snapshot.ratedRevenue / snapshot.periodDays) : 0,
    grossRevenue: snapshot.ratedRevenue,
    reservations: snapshot.reservations,
    cancellationRate:
      snapshot.settled > 0 ? roundMoney((snapshot.cancelled / snapshot.settled) * 100) : 0,
    forwardOccupancyState30d,
    balanceCollectionState,
  };
}

// ─── platform benchmark (Phase 5, optional) ────────────────────────────────

export type PlatformBenchmark = {
  available: boolean;
  sampleSize: number;
  medianOccupancyRate: number | null;
  medianAdr: number | null;
  occupancyPercentile: number | null;
  adrPercentile: number | null;
};

/** Below this many qualifying peers, no benchmark numbers are returned — a privacy floor so a
 *  "median" is never effectively one or two other hosts' real numbers. */
const BENCHMARK_MIN_SAMPLE = 8;
/** Bounded scan, same cost class as analytics-org-summary's already-shipped 200-property cap
 *  (one computePropertyPortfolioRow call per candidate). Only actually runs once per
 *  BENCHMARK_CACHE_TTL_HOURS platform-wide (see below), not once per request. */
const BENCHMARK_CANDIDATE_SCAN = 120;
const BENCHMARK_MAX_PEERS = 60;
/** Self-review finding (2026-09-09, second pass): the live scan is expensive (up to 120
 *  sequential candidates, 2 DB round trips each) and ran on every full-tier analytics-summary
 *  request with no caching. The peer set itself doesn't depend on the requesting property (it's
 *  a platform-wide "vs Kame median", not per-property), so it's cached in one global row and
 *  only recomputed when stale — every request within the TTL reads one cached row instead of
 *  re-scanning. Analytics is daily-grain by design (see the plan's "cache-friendly" framing), so
 *  a 24h TTL costs no real freshness. */
const BENCHMARK_CACHE_TTL_HOURS = 24;
const BENCHMARK_CACHE_ROW_ID = 'global';
/** Bounded wall-clock budget for the live rescan, mirroring the cron TIME_BUDGET_MS pattern —
 *  a slow candidate must not stall the analytics-summary response indefinitely. Whatever peers
 *  were found before the budget runs out are used as-is (still subject to BENCHMARK_MIN_SAMPLE). */
const BENCHMARK_TIME_BUDGET_MS = 8_000;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? roundMoney((sorted[mid - 1] + sorted[mid]) / 2)
    : roundMoney(sorted[mid]);
}

/** Share of peer values this property's own value beats or ties, as a 0-100 percentile. */
function percentileRank(ownValue: number, peerValues: number[]): number | null {
  if (peerValues.length === 0) return null;
  const notAbove = peerValues.filter((v) => v <= ownValue).length;
  return Math.round((notAbove / peerValues.length) * 100);
}

type BenchmarkPeerValues = { occupancyValues: number[]; adrValues: number[] };

/**
 * The expensive part: scans other analyticsInsights-entitled properties with real activity in
 * the period and returns their raw occupancy/ADR values — however many qualify, even fewer than
 * BENCHMARK_MIN_SAMPLE (the caller decides availability; this just reports what exists so a
 * genuinely-sparse result can still be cached and not re-scanned every request). Platform-wide,
 * not property-specific (the caller's own property is naturally excluded only when it happens to
 * be the one passed in — see the caching note above for why a cached run may include the current
 * requester at negligible weight, up to 1 of at most 60 values).
 */
async function scanBenchmarkPeers(
  excludePropertyId: string,
  from: string,
  to: string
): Promise<BenchmarkPeerValues> {
  const startedAt = Date.now();
  const empty: BenchmarkPeerValues = { occupancyValues: [], adrValues: [] };
  const supabase = createServiceClient();
  // Oldest-first, deliberately not newest-first: a property that has existed longer has had more
  // time to accumulate real bookings, so this ordering is biased toward candidates likely to
  // actually qualify (>0 reservations in the period) rather than newly-created, still-empty
  // listings — confirmed against live local data during this feature's build, where a
  // newest-first scan systematically missed every property with real booking history.
  const { data: candidates, error } = await supabase
    .from('properties')
    .select('id')
    .eq('status', 'ACTIVE')
    .neq('id', excludePropertyId)
    .order('created_at', { ascending: true })
    .limit(BENCHMARK_CANDIDATE_SCAN);
  if (error) throw new Error(error.message);
  if (!candidates || candidates.length === 0) return empty;

  const peerRows: PropertyPortfolioRow[] = [];
  for (const candidate of candidates) {
    if (peerRows.length >= BENCHMARK_MAX_PEERS) break;
    if (Date.now() - startedAt > BENCHMARK_TIME_BUDGET_MS) break;
    // One malformed/edge-case candidate (e.g. an org row deleted out from under a property)
    // must never poison the whole benchmark — skip just that candidate, not the entire scan.
    try {
      const entitlements = await resolvePropertyEntitlements(candidate.id);
      if (!isFeatureEnabled(entitlements, 'analyticsInsights')) continue;
      const row = await computePropertyPortfolioRow(candidate.id, from, to);
      if (row.reservations > 0) peerRows.push(row);
    } catch {
      continue;
    }
  }

  return {
    occupancyValues: peerRows.map((r) => r.occupancyRate),
    adrValues: peerRows.map((r) => r.adr).filter((v) => v > 0),
  };
}

/**
 * Reads the cached peer-values row if fresh; null when missing or stale (never rejected for a
 * low sample_size — a genuinely-sparse result is still worth caching so it isn't re-scanned on
 * every request; computePlatformBenchmark applies BENCHMARK_MIN_SAMPLE itself either way).
 */
async function readFreshBenchmarkCache(): Promise<BenchmarkPeerValues | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('platform_analytics_benchmark_cache')
    .select('computed_at, occupancy_values, adr_values')
    .eq('id', BENCHMARK_CACHE_ROW_ID)
    .maybeSingle();
  if (error || !data) return null;

  const ageHours = (Date.now() - new Date(data.computed_at).getTime()) / 3_600_000;
  if (ageHours > BENCHMARK_CACHE_TTL_HOURS) return null;

  return {
    occupancyValues: Array.isArray(data.occupancy_values) ? data.occupancy_values : [],
    adrValues: Array.isArray(data.adr_values) ? data.adr_values : [],
  };
}

/** Best-effort cache write — never blocks or fails the caller if it errors. */
async function writeBenchmarkCache(peers: BenchmarkPeerValues): Promise<void> {
  try {
    const supabase = createServiceClient();
    await supabase.from('platform_analytics_benchmark_cache').upsert({
      id: BENCHMARK_CACHE_ROW_ID,
      computed_at: new Date().toISOString(),
      sample_size: peers.occupancyValues.length,
      occupancy_values: peers.occupancyValues,
      adr_values: peers.adrValues,
      median_occupancy_rate: median(peers.occupancyValues),
      median_adr: median(peers.adrValues),
    });
  } catch {
    // Non-fatal — the freshly-computed result below still gets returned to this caller; the
    // next request just recomputes too instead of benefiting from a cache hit.
  }
}

/**
 * Privacy-guarded "vs Kame median" benchmark — a platform-wide comparison against other
 * analyticsInsights-entitled properties with real activity in the same period, never a named
 * comparison and never shown at all below BENCHMARK_MIN_SAMPLE peers. Deliberately excludes any
 * peer with zero reservations in the period (an idle listing would otherwise drag the median
 * toward zero without reflecting real market performance). The peer scan itself is cached (see
 * BENCHMARK_CACHE_TTL_HOURS) — this function is cheap on a cache hit, expensive only on the
 * (at most hourly-ish, platform-wide, not per-request) cache miss. Optional Phase 5 feature —
 * called from analytics-summary's preview-open GET (every `analytics:view` host).
 */
export async function computePlatformBenchmark(
  propertyId: string,
  from: string,
  to: string,
  ownOccupancyRate: number,
  ownAdr: number
): Promise<PlatformBenchmark> {
  const empty: PlatformBenchmark = {
    available: false,
    sampleSize: 0,
    medianOccupancyRate: null,
    medianAdr: null,
    occupancyPercentile: null,
    adrPercentile: null,
  };

  let peers = await readFreshBenchmarkCache();
  if (!peers) {
    peers = await scanBenchmarkPeers(propertyId, from, to);
    // Fire-and-forget from the caller's perspective — awaited here (not backgrounded) since Edge
    // Functions don't guarantee post-response execution without EdgeRuntime.waitUntil, and this
    // write is small (two JSON arrays capped at 60 numbers each).
    await writeBenchmarkCache(peers);
  }

  const { occupancyValues, adrValues } = peers;
  if (occupancyValues.length < BENCHMARK_MIN_SAMPLE) return empty;

  return {
    available: true,
    sampleSize: occupancyValues.length,
    medianOccupancyRate: median(occupancyValues),
    medianAdr: median(adrValues),
    occupancyPercentile: percentileRank(ownOccupancyRate, occupancyValues),
    adrPercentile: adrValues.length > 0 ? percentileRank(ownAdr, adrValues) : null,
  };
}
