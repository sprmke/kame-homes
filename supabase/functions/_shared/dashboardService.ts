/**
 * Admin dashboard aggregates — pipeline counts, attention items, period KPIs.
 * Keep response shape in sync with `ui/src/features/dashboard/lib/types.ts`.
 */

import { createClient } from './supabaseJs.ts';
import {
  bookingRateForDisplay,
  computeBookingFinancials,
  dashboardNetProfitKpi,
} from './bookingFinance.ts';
import { checkInDateToIso, manilaTodayIso } from './bookingsListSort.ts';

export type DashboardAttentionSeverity = 'critical' | 'warning' | 'info';

export type DashboardAttentionItem = {
  id: string;
  label: string;
  count: number;
  href: string;
  severity: DashboardAttentionSeverity;
};

export type DashboardPipelineSlice = {
  status: string;
  count: number;
};

export type DashboardTrendWindow = {
  from: string;
  to: string;
  label: string;
};

export type DashboardUpcomingStay = {
  id: string;
  guestName: string;
  checkInIso: string;
  checkOutIso: string;
  status: string;
  nights: number;
  pax: number;
  needParking: boolean;
  hasPets: boolean;
  guestRequestsSurpriseDecor: boolean;
};

export type DashboardStats = {
  manilaDate: string;
  attention: DashboardAttentionItem[];
  pipeline: DashboardPipelineSlice[];
  trendWindow: DashboardTrendWindow;
  upcoming: DashboardUpcomingStay[];
  finance: {
    monthNet: number;
    monthStays: number;
    outstandingBalance: number;
    pipelineEstimate: number;
  };
  totals: {
    activeBookings: number;
    totalBookings: number;
    periodDays: number;
    checkInsToday: number;
    checkOutsToday: number;
    checkInsInPeriod: number;
  };
  kpis: {
    netProfit: { value: number; changePercent: number };
    totalBookings: { value: number; changePercent: number };
    checkInsInPeriod: { value: number; changePercent: number };
    occupancyRate: { value: number; changePoints: number };
    avgNightlyRate: { value: number; changePercent: number };
    nightsBooked: { value: number; periodDays: number };
  };
  /** Org dashboard — count of properties in scope. */
  propertyCount: number;
  /** Org dashboard — count of parking listings in scope (0 when none / property scope). */
  parkingCount: number;
  /** Org dashboard — time-series for revenue / bookings chart. */
  trendSeries: DashboardTrendPoint[];
  /** Org dashboard — latest stays with property / parking context. */
  recentBookings: DashboardRecentBooking[];
  /** Org dashboard — per-property KPIs for the selected period. */
  propertyPerformance: DashboardPropertyPerformance[];
  /** Org dashboard — per-parking KPIs for the selected period. */
  parkingPerformance: DashboardParkingPerformance[];
  /** Current status distribution (non-cancelled, org/property scope). */
  statusBreakdown: DashboardPipelineSlice[];
};

export type DashboardTrendPoint = {
  label: string;
  revenue: number;
  bookings: number;
};

export type DashboardRecentBooking = {
  id: string;
  guestName: string;
  bookingKind: 'property' | 'parking';
  propertyId: string;
  propertyName: string;
  propertySlug: string;
  parkingId: string;
  parkingName: string;
  parkingSlug: string;
  checkInIso: string;
  checkOutIso: string;
  status: string;
  amount: number;
};

export type DashboardPropertyPerformance = {
  id: string;
  name: string;
  slug: string;
  location: string | null;
  bookings: number;
  revenue: number;
  occupancy: number;
};

export type DashboardParkingPerformance = {
  id: string;
  name: string;
  slug: string;
  location: string | null;
  bookings: number;
  revenue: number;
  occupancy: number;
};

export type DashboardStatsParams = {
  propertyId?: string;
  parkingId?: string;
  orgId?: string;
  /** When set with `orgId`, limit property rollup to these ids (scoped org admin). */
  scopedPropertyIds?: string[];
  /** When set with `orgId`, limit parking rollup to these ids (scoped org admin). */
  scopedParkingIds?: string[];
  /** Inclusive period range (YYYY-MM-DD, Asia/Manila calendar days). */
  from?: string | null;
  to?: string | null;
};

const CANCELLED = new Set(['CANCELLED']);

const PIPELINE_STATUSES = [
  'PENDING_REVIEW',
  'PENDING_DOCUMENTS',
  'PENDING_GAF',
  'PENDING_PARKING_REQUEST',
  'PENDING_PET_REQUEST',
  'READY_FOR_CHECKIN',
  'READY_FOR_CHECKOUT',
  'PENDING_SD_REFUND',
] as const;

const DOCUMENTS_STATUSES = new Set([
  'PENDING_DOCUMENTS',
  'PENDING_GAF',
  'PENDING_PARKING_REQUEST',
  'PENDING_PET_REQUEST',
]);

const STATUS_BREAKDOWN_DISPLAY_STATUSES = [
  'PENDING_REVIEW',
  'PENDING_DOCUMENTS',
  'READY_FOR_CHECKIN',
  'READY_FOR_CHECKOUT',
  'PENDING_SD_REFUND',
  'COMPLETED',
] as const;

function statusForBreakdown(
  status: string
): (typeof STATUS_BREAKDOWN_DISPLAY_STATUSES)[number] | null {
  if (DOCUMENTS_STATUSES.has(status)) return 'PENDING_DOCUMENTS';
  if (
    STATUS_BREAKDOWN_DISPLAY_STATUSES.includes(
      status as (typeof STATUS_BREAKDOWN_DISPLAY_STATUSES)[number]
    )
  ) {
    return status as (typeof STATUS_BREAKDOWN_DISPLAY_STATUSES)[number];
  }
  return null;
}

type AssetMeta = {
  id: string;
  name: string;
  slug: string;
  location: string | null;
};

function monthBucketLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    timeZone: 'Asia/Manila',
  }).format(d);
}

function dayBucketLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Manila',
  }).format(d);
}

function buildTrendBuckets(from: string, to: string): { key: string; label: string }[] {
  const periodDays = daysInclusive(from, to);
  const useDaily = periodDays <= 45;
  const buckets: { key: string; label: string }[] = [];
  let cursor = from;
  while (cursor <= to) {
    if (useDaily) {
      buckets.push({ key: cursor, label: dayBucketLabel(cursor) });
      cursor = addDaysIso(cursor, 1);
    } else {
      const [y, m] = cursor.split('-').map(Number);
      const monthStart = `${y}-${String(m).padStart(2, '0')}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const monthEnd = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      const bucketEnd = monthEnd > to ? to : monthEnd;
      buckets.push({ key: monthStart, label: monthBucketLabel(monthStart) });
      if (bucketEnd >= to) break;
      cursor = addDaysIso(bucketEnd, 1);
    }
  }
  return buckets;
}

function bucketKeyForDate(iso: string, from: string, to: string): string | null {
  if (iso < from || iso > to) return null;
  const periodDays = daysInclusive(from, to);
  if (periodDays <= 45) return iso;
  const [y, m] = iso.split('-').map(Number);
  return `${y}-${String(m).padStart(2, '0')}-01`;
}

function propertyLocationFromRow(row: Record<string, unknown>): string | null {
  const settings = row.settings;
  if (settings && typeof settings === 'object' && !Array.isArray(settings)) {
    const s = settings as Record<string, unknown>;
    const city = String(s.city ?? '').trim();
    const province = String(s.province ?? '').trim();
    const joined = [city, province].filter(Boolean).join(', ');
    if (joined) return joined;
  }
  const address = String(row.address ?? '').trim();
  return address || null;
}

function parkingLocationFromRow(row: Record<string, unknown>): string | null {
  const residence = String(row.residence_name ?? '').trim();
  const tower = String(row.tower ?? '').trim();
  const level = String(row.level ?? '').trim();
  const slot = String(row.slot_label ?? '').trim();
  const parts = [residence, tower, level, slot].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysInclusive(from: string, to: string): number {
  const a = new Date(`${from}T12:00:00`);
  const b = new Date(`${to}T12:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1;
}

function previousPeriodRange(from: string, to: string): { from: string; to: string } {
  const length = daysInclusive(from, to);
  const prevTo = addDaysIso(from, -1);
  const prevFrom = addDaysIso(prevTo, -(length - 1));
  return { from: prevFrom, to: prevTo };
}

function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
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

function hostNetForDashboardKpi(row: Record<string, unknown>, _status: string): number {
  return dashboardNetProfitKpi(row);
}

type PeriodKpiSnapshot = {
  netProfit: number;
  occupiedNights: number;
  totalBookings: number;
  periodDays: number;
  /** Σ booking rate allocated to occupied nights in period (matches calendar Price pills). */
  ratedRevenue: number;
  ratedNights: number;
};

function computePeriodKpiSnapshot(
  rows: Record<string, unknown>[],
  from: string,
  to: string
): PeriodKpiSnapshot {
  let netProfit = 0;
  let occupiedNights = 0;
  let ratedRevenue = 0;
  let ratedNights = 0;
  const periodDays = daysInclusive(from, to);

  for (const row of rows) {
    const status = String(row.status ?? '');
    if (CANCELLED.has(status)) continue;

    const checkInIso = checkInDateToIso(String(row.check_in_date ?? ''));
    const checkOutIso = checkInDateToIso(String(row.check_out_date ?? ''));
    if (!checkInIso) continue;

    const numberOfNights = Number(row.number_of_nights ?? 0) || 0;
    const checkInInRange = checkInIso >= from && checkInIso <= to;

    const nightsInRange = countOccupiedNightsInRange(
      checkInIso,
      checkOutIso,
      numberOfNights,
      from,
      to
    );
    occupiedNights += nightsInRange;

    if (nightsInRange > 0) {
      ratedRevenue = roundMoney(
        ratedRevenue + bookingRateLodgingInRange(row, numberOfNights, nightsInRange)
      );
      ratedNights += nightsInRange;
    }

    if (checkInInRange) {
      const net = hostNetForDashboardKpi(row, status);
      netProfit = roundMoney(netProfit + net);
    }
  }

  return {
    netProfit,
    occupiedNights,
    totalBookings: occupiedNights,
    periodDays,
    ratedRevenue,
    ratedNights,
  };
}

function defaultTrendRange(today: string): { from: string; to: string } {
  const [y, m] = today.split('-').map(Number);
  const from = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
}

function trendRangeLabel(from: string, to: string): string {
  const start = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  const fmt = (d: Date, withYear: boolean) =>
    new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: withYear ? 'numeric' : undefined,
      year: withYear ? 'numeric' : undefined,
      timeZone: 'Asia/Manila',
    }).format(d);
  if (from === to) return fmt(end, true);
  const sameYear = start.getFullYear() === end.getFullYear();
  return `${fmt(start, !sameYear)} – ${fmt(end, true)}`;
}

function guestDisplayName(row: Record<string, unknown>): string {
  const fb = String(row.guest_facebook_name ?? '').trim();
  const primary = String(row.primary_guest_name ?? '').trim();
  return fb || primary || 'Guest';
}

function flagTrue(v: unknown): boolean {
  return v === true || v === 'true';
}

function bookingsLink(params: Record<string, string>): string {
  const sp = new URLSearchParams(params);
  return `/bookings?${sp.toString()}`;
}

export async function computeDashboardStats(
  params: DashboardStatsParams = {}
): Promise<DashboardStats> {
  const today = manilaTodayIso();
  const fallback = defaultTrendRange(today);
  const trendFrom =
    params.from && /^\d{4}-\d{2}-\d{2}$/.test(params.from) ? params.from : fallback.from;
  const trendTo = params.to && /^\d{4}-\d{2}-\d{2}$/.test(params.to) ? params.to : fallback.to;
  const from = trendFrom <= trendTo ? trendFrom : trendTo;
  const to = trendFrom <= trendTo ? trendTo : trendFrom;
  const trendLabel = trendRangeLabel(from, to);

  const supabase = getSupabase();

  let propertyIds: string[] | null = null;
  let parkingIds: string[] | null = null;
  const propertyMetaById = new Map<string, AssetMeta>();
  const parkingMetaById = new Map<string, AssetMeta>();

  if (params.orgId) {
    const [
      { data: propertyRows, error: propertiesError },
      { data: parkingRows, error: parkingsError },
    ] = await Promise.all([
      supabase
        .from('properties')
        .select('id, name, slug, address, settings')
        .eq('organization_id', params.orgId)
        .order('name', { ascending: true }),
      supabase
        .from('parkings')
        .select('id, name, slug, residence_name, tower, level, slot_label')
        .eq('organization_id', params.orgId)
        .order('name', { ascending: true }),
    ]);
    if (propertiesError) {
      throw new Error(`dashboard properties query failed: ${propertiesError.message}`);
    }
    if (parkingsError) {
      throw new Error(`dashboard parkings query failed: ${parkingsError.message}`);
    }
    const scopedPropertyFilter = params.scopedPropertyIds
      ? new Set(params.scopedPropertyIds)
      : null;
    const scopedParkingFilter = params.scopedParkingIds ? new Set(params.scopedParkingIds) : null;

    const filteredPropertyRows = (propertyRows ?? []).filter((row) =>
      scopedPropertyFilter ? scopedPropertyFilter.has(String(row.id)) : true
    );
    const filteredParkingRows = (parkingRows ?? []).filter((row) =>
      scopedParkingFilter ? scopedParkingFilter.has(String(row.id)) : true
    );

    propertyIds = filteredPropertyRows.map((row) => String(row.id));
    for (const row of filteredPropertyRows) {
      propertyMetaById.set(String(row.id), {
        id: String(row.id),
        name: String(row.name ?? 'Property'),
        slug: String(row.slug ?? ''),
        location: propertyLocationFromRow(row as Record<string, unknown>),
      });
    }
    parkingIds = filteredParkingRows.map((row) => String(row.id));
    for (const row of filteredParkingRows) {
      parkingMetaById.set(String(row.id), {
        id: String(row.id),
        name: String(row.name ?? 'Parking'),
        slug: String(row.slug ?? ''),
        location: parkingLocationFromRow(row as Record<string, unknown>),
      });
    }
  }

  let rows: Record<string, unknown>[];
  if (params.parkingId) {
    const { data, error } = await supabase
      .from('guest_submissions')
      .select('*')
      .eq('parking_id', params.parkingId);
    if (error) throw new Error(`dashboard parking bookings query failed: ${error.message}`);
    rows = (data ?? []) as Record<string, unknown>[];
  } else if (params.propertyId) {
    const { data, error } = await supabase
      .from('guest_submissions')
      .select('*')
      .eq('property_id', params.propertyId);
    if (error) throw new Error(`dashboard bookings query failed: ${error.message}`);
    rows = (data ?? []) as Record<string, unknown>[];
  } else if (propertyIds !== null || parkingIds !== null) {
    const propIds = propertyIds ?? [];
    const parkIds = parkingIds ?? [];
    if (propIds.length === 0 && parkIds.length === 0) {
      const periodDays = daysInclusive(from, to);
      return {
        manilaDate: today,
        attention: [],
        pipeline: PIPELINE_STATUSES.map((status) => ({ status, count: 0 })),
        trendWindow: { from, to, label: trendLabel },
        upcoming: [],
        finance: {
          monthNet: 0,
          monthStays: 0,
          outstandingBalance: 0,
          pipelineEstimate: 0,
        },
        totals: {
          activeBookings: 0,
          totalBookings: 0,
          periodDays,
          checkInsToday: 0,
          checkOutsToday: 0,
          checkInsInPeriod: 0,
        },
        kpis: {
          netProfit: { value: 0, changePercent: 0 },
          totalBookings: { value: 0, changePercent: 0 },
          checkInsInPeriod: { value: 0, changePercent: 0 },
          occupancyRate: { value: 0, changePoints: 0 },
          avgNightlyRate: { value: 0, changePercent: 0 },
          nightsBooked: { value: 0, periodDays },
        },
        propertyCount: 0,
        parkingCount: 0,
        trendSeries: buildTrendBuckets(from, to).map((bucket) => ({
          label: bucket.label,
          revenue: 0,
          bookings: 0,
        })),
        recentBookings: [],
        propertyPerformance: [],
        parkingPerformance: [],
        statusBreakdown: STATUS_BREAKDOWN_DISPLAY_STATUSES.map((status) => ({
          status,
          count: 0,
        })),
      };
    }
    // Scope by organization_id through an inner-joined embed for all-listings admins —
    // never build an `id.in.(...)` list of every property/parking id (URI length limits).
    // Scoped org admins use `.in()` on the already-filtered id sets (small).
    const scopedQueries: any[] = [];
    const useAssignedIdFilter =
      params.scopedPropertyIds !== undefined || params.scopedParkingIds !== undefined;
    if (propIds.length > 0) {
      scopedQueries.push(
        useAssignedIdFilter
          ? supabase.from('guest_submissions').select('*').in('property_id', propIds)
          : supabase
              .from('guest_submissions')
              .select('*, properties!inner(organization_id)')
              .eq('properties.organization_id', params.orgId as string)
      );
    }
    if (parkIds.length > 0) {
      scopedQueries.push(
        useAssignedIdFilter
          ? supabase.from('guest_submissions').select('*').in('parking_id', parkIds)
          : supabase
              .from('guest_submissions')
              // Disambiguate from guest_submissions.parking_pinned_id → parkings (broadcast flow).
              .select('*, parkings!guest_submissions_parking_id_fkey!inner(organization_id)')
              .eq('parkings.organization_id', params.orgId as string)
      );
    }
    const scopedResults = await Promise.all(scopedQueries);
    for (const { error } of scopedResults) {
      if (error) throw new Error(`dashboard bookings query failed: ${error.message}`);
    }
    let merged = scopedResults.flatMap(
      (result) => (result.data ?? []) as Record<string, unknown>[]
    );
    if (scopedResults.length > 1) {
      const seenIds = new Set<string>();
      merged = merged.filter((row) => {
        const id = String(row.id);
        if (seenIds.has(id)) return false;
        seenIds.add(id);
        return true;
      });
    }
    rows = merged;
  } else {
    const { data, error } = await supabase.from('guest_submissions').select('*');
    if (error) throw new Error(`dashboard bookings query failed: ${error.message}`);
    rows = (data ?? []) as Record<string, unknown>[];
  }

  const pipelineCounts = new Map<string, number>();
  for (const s of PIPELINE_STATUSES) pipelineCounts.set(s, 0);

  const statusBreakdownCounts = new Map<string, number>();
  for (const s of STATUS_BREAKDOWN_DISPLAY_STATUSES) {
    statusBreakdownCounts.set(s, 0);
  }

  let activeBookings = 0;
  let totalBookings = 0;
  let checkInsToday = 0;
  let checkOutsToday = 0;
  let pendingReview = 0;
  let pendingDocuments = 0;
  let pendingSdRefund = 0;
  let unpaidBalanceCount = 0;
  let periodNet = 0;
  let periodCompletedStays = 0;
  let outstandingBalance = 0;
  let pipelineEstimate = 0;

  const todayInRange = today >= from && today <= to;

  const periodStays: DashboardUpcomingStay[] = [];
  const recentBookingCandidates: DashboardRecentBooking[] = [];

  const trendBuckets = buildTrendBuckets(from, to);
  const trendRevenueByKey = new Map<string, number>();
  const trendBookingsByKey = new Map<string, number>();
  for (const bucket of trendBuckets) {
    trendRevenueByKey.set(bucket.key, 0);
    trendBookingsByKey.set(bucket.key, 0);
  }

  const performanceByProperty = new Map<
    string,
    { bookings: number; revenue: number; occupiedNights: number }
  >();
  const performanceByParking = new Map<
    string,
    { bookings: number; revenue: number; occupiedNights: number }
  >();

  for (const row of rows) {
    const status = String(row.status ?? '');
    if (CANCELLED.has(status)) continue;

    const checkInIso = checkInDateToIso(String(row.check_in_date ?? ''));
    const checkOutIso = checkInDateToIso(String(row.check_out_date ?? ''));
    if (!checkInIso) continue;

    const propertyId = String(row.property_id ?? '').trim();
    const parkingId = String(row.parking_id ?? '').trim();
    const bookingKind: 'property' | 'parking' = parkingId ? 'parking' : 'property';
    const numberOfNights = Number(row.number_of_nights ?? 0) || 0;
    const checkInInRange = checkInIso >= from && checkInIso <= to;
    const fin = computeBookingFinancials(row);
    const nightsInRange = countOccupiedNightsInRange(
      checkInIso,
      checkOutIso,
      numberOfNights,
      from,
      to
    );

    const performanceMap = bookingKind === 'parking' ? performanceByParking : performanceByProperty;
    const assetId = bookingKind === 'parking' ? parkingId : propertyId;

    if (assetId && nightsInRange > 0) {
      const perf = performanceMap.get(assetId) ?? {
        bookings: 0,
        revenue: 0,
        occupiedNights: 0,
      };
      perf.occupiedNights += nightsInRange;
      perf.revenue = roundMoney(
        perf.revenue + bookingRateLodgingInRange(row, numberOfNights, nightsInRange)
      );
      performanceMap.set(assetId, perf);

      for (const nightIso of occupiedNightIsoDatesForRow(checkInIso, checkOutIso, numberOfNights)) {
        const bucketKey = bucketKeyForDate(nightIso, from, to);
        if (!bucketKey || !trendRevenueByKey.has(bucketKey)) continue;
        const perNight = bookingRateLodgingInRange(row, numberOfNights, 1);
        trendRevenueByKey.set(
          bucketKey,
          roundMoney((trendRevenueByKey.get(bucketKey) ?? 0) + perNight)
        );
      }
    }

    if (checkInInRange) {
      const breakdownStatus = statusForBreakdown(status);
      if (breakdownStatus) {
        statusBreakdownCounts.set(
          breakdownStatus,
          (statusBreakdownCounts.get(breakdownStatus) ?? 0) + 1
        );
      }

      const bucketKey = bucketKeyForDate(checkInIso, from, to);
      if (bucketKey && trendBookingsByKey.has(bucketKey)) {
        trendBookingsByKey.set(bucketKey, (trendBookingsByKey.get(bucketKey) ?? 0) + 1);
      }

      if (assetId) {
        const perf = performanceMap.get(assetId) ?? {
          bookings: 0,
          revenue: 0,
          occupiedNights: 0,
        };
        perf.bookings += 1;
        performanceMap.set(assetId, perf);
      }

      totalBookings += 1;
      periodStays.push({
        id: String(row.id),
        guestName: guestDisplayName(row),
        checkInIso,
        checkOutIso,
        status,
        nights: numberOfNights,
        pax: Number(row.number_of_adults ?? 0) + (Number(row.number_of_children ?? 0) || 0),
        needParking: flagTrue(row.need_parking),
        hasPets: flagTrue(row.has_pets),
        guestRequestsSurpriseDecor: flagTrue(row.guest_requests_surprise_decor),
      });

      const propertyMeta = propertyMetaById.get(propertyId);
      const parkingMeta = parkingMetaById.get(parkingId);
      recentBookingCandidates.push({
        id: String(row.id),
        guestName: guestDisplayName(row),
        bookingKind,
        propertyId,
        propertyName: propertyMeta?.name ?? (bookingKind === 'property' ? 'Property' : ''),
        propertySlug: propertyMeta?.slug ?? '',
        parkingId,
        parkingName: parkingMeta?.name ?? (bookingKind === 'parking' ? 'Parking' : ''),
        parkingSlug: parkingMeta?.slug ?? '',
        checkInIso,
        checkOutIso,
        status,
        amount: bookingRateForDisplay(row) ?? 0,
      });

      if (status !== 'COMPLETED') {
        activeBookings += 1;
        if (pipelineCounts.has(status)) {
          pipelineCounts.set(status, (pipelineCounts.get(status) ?? 0) + 1);
        }
        if (fin.projectedNet != null) {
          pipelineEstimate += fin.projectedNet;
        }
      }

      if (status === 'PENDING_REVIEW') pendingReview += 1;
      if (DOCUMENTS_STATUSES.has(status)) pendingDocuments += 1;
      if (status === 'PENDING_SD_REFUND') pendingSdRefund += 1;

      if (fin.guestUnpaid != null && fin.guestUnpaid > 0 && status !== 'COMPLETED') {
        unpaidBalanceCount += 1;
        outstandingBalance += fin.guestUnpaid;
      }
    }

    if (todayInRange && checkInIso === today) checkInsToday += 1;
    if (todayInRange && checkOutIso === today) checkOutsToday += 1;

    if (status === 'COMPLETED' && checkInInRange) {
      periodNet = roundMoney(periodNet + fin.hostNet);
      periodCompletedStays += 1;
    }
  }

  periodStays.sort((a, b) => a.checkInIso.localeCompare(b.checkInIso));
  outstandingBalance = roundMoney(outstandingBalance);
  pipelineEstimate = roundMoney(pipelineEstimate);

  const attention: DashboardAttentionItem[] = [];
  const periodLink = { from, to };

  if (pendingReview > 0) {
    attention.push({
      id: 'pending-review',
      label: 'Pending review',
      count: pendingReview,
      href: bookingsLink({ status: 'PENDING_REVIEW', ...periodLink }),
      severity: 'critical',
    });
  }
  if (pendingDocuments > 0) {
    attention.push({
      id: 'pending-documents',
      label: 'Awaiting documents',
      count: pendingDocuments,
      href: bookingsLink({
        status: 'PENDING_DOCUMENTS,PENDING_GAF,PENDING_PARKING_REQUEST,PENDING_PET_REQUEST',
        ...periodLink,
      }),
      severity: 'warning',
    });
  }
  if (checkInsToday > 0) {
    attention.push({
      id: 'check-ins-today',
      label: 'Check-ins today',
      count: checkInsToday,
      href: bookingsLink({ from: today, to: today }),
      severity: 'critical',
    });
  }
  if (checkOutsToday > 0) {
    attention.push({
      id: 'check-outs-today',
      label: 'Check-outs today',
      count: checkOutsToday,
      href: bookingsLink({ from: today, to: today }),
      severity: 'warning',
    });
  }
  if (pendingSdRefund > 0) {
    attention.push({
      id: 'pending-sd-refund',
      label: 'SD refunds pending',
      count: pendingSdRefund,
      href: bookingsLink({ status: 'PENDING_SD_REFUND', ...periodLink }),
      severity: 'warning',
    });
  }
  if (unpaidBalanceCount > 0) {
    attention.push({
      id: 'unpaid-balance',
      label: 'Unpaid guest balance',
      count: unpaidBalanceCount,
      href: `/finance?from=${from}&to=${to}`,
      severity: 'info',
    });
  }

  const pipeline: DashboardPipelineSlice[] = PIPELINE_STATUSES.map((status) => ({
    status,
    count: pipelineCounts.get(status) ?? 0,
  }));

  const periodDays = daysInclusive(from, to);
  const prevRange = previousPeriodRange(from, to);
  const currentKpis = computePeriodKpiSnapshot(rows, from, to);
  const previousKpis = computePeriodKpiSnapshot(rows, prevRange.from, prevRange.to);

  let prevCheckInsInPeriod = 0;
  for (const row of rows) {
    const status = String(row.status ?? '');
    if (CANCELLED.has(status)) continue;
    const checkInIso = checkInDateToIso(String(row.check_in_date ?? ''));
    if (!checkInIso) continue;
    if (checkInIso >= prevRange.from && checkInIso <= prevRange.to) {
      prevCheckInsInPeriod += 1;
    }
  }

  const orgUnitCount = params.orgId ? Math.max(1, propertyMetaById.size + parkingMetaById.size) : 1;
  const occupancyRate =
    currentKpis.periodDays > 0
      ? Math.round((currentKpis.occupiedNights / (currentKpis.periodDays * orgUnitCount)) * 100)
      : 0;
  const prevOccupancyRate =
    previousKpis.periodDays > 0
      ? Math.round((previousKpis.occupiedNights / (previousKpis.periodDays * orgUnitCount)) * 100)
      : 0;
  const avgNightlyRate =
    currentKpis.ratedNights > 0
      ? Math.round(currentKpis.ratedRevenue / currentKpis.ratedNights)
      : 0;
  const prevAvgNightlyRate =
    previousKpis.ratedNights > 0
      ? Math.round(previousKpis.ratedRevenue / previousKpis.ratedNights)
      : 0;

  const trendSeries: DashboardTrendPoint[] = trendBuckets.map((bucket) => ({
    label: bucket.label,
    revenue: trendRevenueByKey.get(bucket.key) ?? 0,
    bookings: trendBookingsByKey.get(bucket.key) ?? 0,
  }));

  recentBookingCandidates.sort((a, b) => b.checkInIso.localeCompare(a.checkInIso));
  const recentBookings = recentBookingCandidates.slice(0, 5);

  const periodDaysForOccupancy = daysInclusive(from, to);
  const propertyPerformance: DashboardPropertyPerformance[] = [];
  const parkingPerformance: DashboardParkingPerformance[] = [];

  if (params.orgId) {
    for (const meta of propertyMetaById.values()) {
      const perf = performanceByProperty.get(meta.id) ?? {
        bookings: 0,
        revenue: 0,
        occupiedNights: 0,
      };
      propertyPerformance.push({
        id: meta.id,
        name: meta.name,
        slug: meta.slug,
        location: meta.location,
        bookings: perf.bookings,
        revenue: perf.revenue,
        occupancy:
          periodDaysForOccupancy > 0
            ? Math.round((perf.occupiedNights / periodDaysForOccupancy) * 100)
            : 0,
      });
    }
    propertyPerformance.sort((a, b) => b.revenue - a.revenue);

    for (const meta of parkingMetaById.values()) {
      const perf = performanceByParking.get(meta.id) ?? {
        bookings: 0,
        revenue: 0,
        occupiedNights: 0,
      };
      parkingPerformance.push({
        id: meta.id,
        name: meta.name,
        slug: meta.slug,
        location: meta.location,
        bookings: perf.bookings,
        revenue: perf.revenue,
        occupancy:
          periodDaysForOccupancy > 0
            ? Math.round((perf.occupiedNights / periodDaysForOccupancy) * 100)
            : 0,
      });
    }
    parkingPerformance.sort((a, b) => b.revenue - a.revenue);
  }

  const statusBreakdown: DashboardPipelineSlice[] = STATUS_BREAKDOWN_DISPLAY_STATUSES.map(
    (status) => ({
      status,
      count: statusBreakdownCounts.get(status) ?? 0,
    })
  );

  return {
    manilaDate: today,
    attention,
    pipeline,
    trendWindow: {
      from,
      to,
      label: trendLabel,
    },
    upcoming: periodStays,
    finance: {
      monthNet: periodNet,
      monthStays: periodCompletedStays,
      outstandingBalance,
      pipelineEstimate,
    },
    totals: {
      activeBookings,
      totalBookings,
      periodDays,
      checkInsToday,
      checkOutsToday,
      checkInsInPeriod: totalBookings,
    },
    kpis: {
      netProfit: {
        value: currentKpis.netProfit,
        changePercent: calculatePercentageChange(currentKpis.netProfit, previousKpis.netProfit),
      },
      totalBookings: {
        value: currentKpis.totalBookings,
        changePercent: calculatePercentageChange(
          currentKpis.totalBookings,
          previousKpis.totalBookings
        ),
      },
      checkInsInPeriod: {
        value: totalBookings,
        changePercent: calculatePercentageChange(totalBookings, prevCheckInsInPeriod),
      },
      occupancyRate: {
        value: occupancyRate,
        changePoints: occupancyRate - prevOccupancyRate,
      },
      avgNightlyRate: {
        value: avgNightlyRate,
        changePercent: calculatePercentageChange(avgNightlyRate, prevAvgNightlyRate),
      },
      nightsBooked: {
        value: currentKpis.occupiedNights,
        periodDays: currentKpis.periodDays,
      },
    },
    propertyCount: params.orgId ? propertyMetaById.size : 1,
    parkingCount: params.orgId ? parkingMetaById.size : 0,
    trendSeries,
    recentBookings,
    propertyPerformance,
    parkingPerformance,
    statusBreakdown,
  };
}

export type PropertyPeriodStats = {
  activeBookings: number;
  monthlyRevenue: number;
  occupancyRate: number;
};

/** Per-property KPIs for org properties list (current Manila calendar month). */
export function computePropertyPeriodStats(
  rows: Record<string, unknown>[],
  from: string,
  to: string
): PropertyPeriodStats {
  let activeBookings = 0;
  for (const row of rows) {
    const status = String(row.status ?? '');
    if (CANCELLED.has(status) || status === 'COMPLETED') continue;
    activeBookings += 1;
  }

  const snap = computePeriodKpiSnapshot(rows, from, to);
  const occupancyRate =
    snap.periodDays > 0 ? Math.round((snap.occupiedNights / snap.periodDays) * 100) : 0;

  return {
    activeBookings,
    monthlyRevenue: snap.ratedRevenue,
    occupancyRate,
  };
}

export function defaultManilaMonthRange(today: string): { from: string; to: string } {
  return defaultTrendRange(today);
}
