/**
 * Org portfolio rollup (properties + parkings) for a period — shared by `analytics-org-summary`
 * and the assistant's `get_org_portfolio_analytics` tool. The caller does the RBAC
 * (`org.analytics:view`). Occupancy is night-weighted across listings (sum occupied / sum
 * available), not the mean of per-listing occupancy percentages.
 */

import {
  computeParkingPortfolioRowPair,
  computePropertyPortfolioRowPair,
  previousPeriodRange,
  rollupOrgPortfolio,
  type PortfolioListingMetrics,
} from './analyticsService.ts';
import { createServiceClient } from './orgAuth.ts';

const MAX_PROPERTIES = 200;
const MAX_PARKINGS = 200;

export function defaultMonthRange(today: string): { from: string; to: string } {
  const [y, m] = today.split('-').map(Number);
  const from = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
}

export function isValidIsoDate(value: string | null | undefined): value is string {
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

export async function computeOrgPortfolioSummary(orgId: string, from: string, to: string) {
  const priorPeriod = previousPeriodRange(from, to);
  const supabase = createServiceClient();

  const [propertiesResult, parkingsResult] = await Promise.all([
    supabase
      .from('properties')
      .select('id, name, slug')
      .eq('organization_id', orgId)
      .eq('status', 'ACTIVE')
      .order('name', { ascending: true })
      .limit(MAX_PROPERTIES),
    supabase
      .from('parkings')
      .select('id, name, slug')
      .eq('organization_id', orgId)
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

  const toRow = (
    kind: 'property' | 'parking',
    listing: ListingMeta,
    pair: { current: PortfolioListingMetrics; prior: PortfolioListingMetrics }
  ) => {
    const { current, prior } = pair;
    currentMetricRows.push(current);
    priorMetricRows.push(prior);
    return {
      kind,
      id: listing.id,
      name: listing.name,
      slug: listing.slug,
      locked: false as const,
      // Legacy keys kept for older clients / CSV during migrate
      propertyId: listing.id,
      propertyName: listing.name,
      propertySlug: listing.slug,
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
  };

  const rows = [
    ...properties.map((property, index) => toRow('property', property, propertyPairs[index])),
    ...parkings.map((parking, index) => toRow('parking', parking, parkingPairs[index])),
  ];

  const current = rollupOrgPortfolio(currentMetricRows);
  const prior = rollupOrgPortfolio(priorMetricRows);

  return {
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
  };
}
