import { manilaTodayIso } from './bookingsListSort.ts';
import {
  computePropertyPeriodStats,
  defaultManilaMonthRange,
  type PropertyPeriodStats,
} from './dashboardService.ts';

export type { PropertyPeriodStats };

const EMPTY_STATS: PropertyPeriodStats = {
  activeBookings: 0,
  monthlyRevenue: 0,
  occupancyRate: 0,
};

export function computePropertyListStatsByPropertyId(
  rows: Record<string, unknown>[],
  today = manilaTodayIso()
): Map<string, PropertyPeriodStats> {
  const { from, to } = defaultManilaMonthRange(today);
  const grouped = new Map<string, Record<string, unknown>[]>();

  for (const row of rows) {
    const propertyId = String(row.property_id ?? '').trim();
    if (!propertyId) continue;
    const bucket = grouped.get(propertyId) ?? [];
    bucket.push(row);
    grouped.set(propertyId, bucket);
  }

  const stats = new Map<string, PropertyPeriodStats>();
  for (const [propertyId, propertyRows] of grouped) {
    stats.set(propertyId, computePropertyPeriodStats(propertyRows, from, to));
  }
  return stats;
}

export function propertyListStatsOrEmpty(
  map: Map<string, PropertyPeriodStats>,
  propertyId: string
): PropertyPeriodStats {
  return map.get(propertyId) ?? EMPTY_STATS;
}
