/**
 * analytics-org-summary — Host Analytics org portfolio rollup (properties + parkings).
 * Org scope: ?org_slug=… or ?org_id=…. ?from=&to= (defaults to current calendar month, Manila).
 *
 * Preview-open: `org.analytics:view` is enough to read every active listing's numbers.
 * `analyticsInsights` gates Export CSV (client), not this GET.
 *
 * Occupancy is night-weighted across listings (sum occupied / sum available), not the mean of
 * per-listing occupancy percentages. Prior-period deltas use one bookings load per listing.
 */

import {
  computeParkingPortfolioRowPair,
  computePropertyPortfolioRowPair,
  previousPeriodRange,
  rollupOrgPortfolio,
  type PortfolioListingMetrics,
} from '../_shared/analyticsService.ts';
import { manilaTodayIso } from '../_shared/bookingsListSort.ts';
import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { resolveOrgAccessContext } from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

const MAX_PROPERTIES = 200;
const MAX_PARKINGS = 200;

function defaultMonthRange(today: string): { from: string; to: string } {
  const [y, m] = today.split('-').map(Number);
  const from = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
}

function isValidIsoDate(value: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function changePct(current: number, prior: number): number | null {
  if (prior === 0) return null;
  return Math.round(((current - prior) / prior) * 10000) / 100;
}

function changePts(current: number, prior: number): number | null {
  return Math.round((current - prior) * 100) / 100;
}

type ListingMeta = { id: string; name: string; slug: string };

serveAuthenticated('analytics-org-summary', async (req) => {
  if (req.method !== 'GET') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const { org } = await resolveOrgAccessContext(req, 'org.analytics:view');

  const today = manilaTodayIso();
  const url = new URL(req.url);
  const defaultRange = defaultMonthRange(today);
  const fromParam = url.searchParams.get('from');
  const toParam = url.searchParams.get('to');
  const from = isValidIsoDate(fromParam) ? fromParam : defaultRange.from;
  const to = isValidIsoDate(toParam) ? toParam : defaultRange.to;
  if (from > to) {
    return jsonError(req, '`from` must be on or before `to`', 400);
  }

  const priorPeriod = previousPeriodRange(from, to);
  const supabase = createServiceClient();

  const [propertiesResult, parkingsResult] = await Promise.all([
    supabase
      .from('properties')
      .select('id, name, slug')
      .eq('organization_id', org.id)
      .eq('status', 'ACTIVE')
      .order('name', { ascending: true })
      .limit(MAX_PROPERTIES),
    supabase
      .from('parkings')
      .select('id, name, slug')
      .eq('organization_id', org.id)
      .eq('status', 'ACTIVE')
      .order('name', { ascending: true })
      .limit(MAX_PARKINGS),
  ]);
  if (propertiesResult.error) throw new Error(propertiesResult.error.message);
  if (parkingsResult.error) throw new Error(parkingsResult.error.message);

  const properties = (propertiesResult.data ?? []) as ListingMeta[];
  const parkings = (parkingsResult.data ?? []) as ListingMeta[];

  const propertyPairs = await Promise.all(
    properties.map((property) =>
      computePropertyPortfolioRowPair(property.id, from, to, priorPeriod.from, priorPeriod.to)
    )
  );
  const parkingPairs = await Promise.all(
    parkings.map((parking) =>
      computeParkingPortfolioRowPair(parking.id, from, to, priorPeriod.from, priorPeriod.to)
    )
  );

  const currentMetricRows: PortfolioListingMetrics[] = [];
  const priorMetricRows: PortfolioListingMetrics[] = [];

  const rows = [
    ...properties.map((property, index) => {
      const { current, prior } = propertyPairs[index];
      currentMetricRows.push(current);
      priorMetricRows.push(prior);
      return {
        kind: 'property' as const,
        id: property.id,
        name: property.name,
        slug: property.slug,
        locked: false as const,
        // Legacy keys kept for older clients / CSV during migrate
        propertyId: property.id,
        propertyName: property.name,
        propertySlug: property.slug,
        occupancyRate: current.occupancyRate,
        adr: current.adr,
        revpar: current.revpar,
        grossRevenue: current.grossRevenue,
        reservations: current.reservations,
        cancellationRate: current.cancellationRate,
        revenueChangePct: changePct(current.grossRevenue, prior.grossRevenue),
        forwardOccupancyState30d: current.forwardOccupancyState30d,
        forwardOccupancyRate30d: current.forwardOccupancyRate30d,
        balanceCollectionState: current.balanceCollectionState,
        unpaidBalanceUpcomingTotal: current.unpaidBalanceUpcomingTotal,
        unpaidBalanceUpcomingCount: current.unpaidBalanceUpcomingCount,
        occupiedNights: current.occupiedNights,
        periodDays: current.periodDays,
      };
    }),
    ...parkings.map((parking, index) => {
      const { current, prior } = parkingPairs[index];
      currentMetricRows.push(current);
      priorMetricRows.push(prior);
      return {
        kind: 'parking' as const,
        id: parking.id,
        name: parking.name,
        slug: parking.slug,
        locked: false as const,
        propertyId: parking.id,
        propertyName: parking.name,
        propertySlug: parking.slug,
        occupancyRate: current.occupancyRate,
        adr: current.adr,
        revpar: current.revpar,
        grossRevenue: current.grossRevenue,
        reservations: current.reservations,
        cancellationRate: current.cancellationRate,
        revenueChangePct: changePct(current.grossRevenue, prior.grossRevenue),
        forwardOccupancyState30d: current.forwardOccupancyState30d,
        forwardOccupancyRate30d: current.forwardOccupancyRate30d,
        balanceCollectionState: current.balanceCollectionState,
        unpaidBalanceUpcomingTotal: current.unpaidBalanceUpcomingTotal,
        unpaidBalanceUpcomingCount: current.unpaidBalanceUpcomingCount,
        occupiedNights: current.occupiedNights,
        periodDays: current.periodDays,
      };
    }),
  ];

  const current = rollupOrgPortfolio(currentMetricRows);
  const prior = rollupOrgPortfolio(priorMetricRows);

  return jsonSuccess(req, {
    period: { from, to },
    priorPeriod,
    portfolio: {
      totalRevenue: current.totalRevenue,
      totalRevenueChangePct: changePct(current.totalRevenue, prior.totalRevenue),
      avgOccupancy: current.avgOccupancy,
      avgOccupancyChangePts: changePts(current.avgOccupancy, prior.avgOccupancy),
      totalReservations: current.totalReservations,
      totalReservationsChangePct: changePct(current.totalReservations, prior.totalReservations),
      propertyCount: properties.length,
      parkingCount: parkings.length,
      listingCount: properties.length + parkings.length,
      attentionCount: current.attentionCount,
      unpaidBalanceTotal: current.unpaidBalanceTotal,
      entitledPropertyCount: properties.length,
    },
    rows,
  });
});
