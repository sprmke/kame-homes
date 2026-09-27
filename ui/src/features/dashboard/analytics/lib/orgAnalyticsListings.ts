/** Filter, sort and explain rows for the org Analytics listings table. */

import {
  ORG_OUTLOOK_LABEL,
  ORG_SOFT_OCCUPANCY_PCT,
  listingNeedsAttention,
} from '@/features/dashboard/analytics/lib/orgPortfolioLabels';
import {
  orgPortfolioListingKind,
  orgPortfolioListingName,
  type OrgPortfolioRow,
} from '@/features/dashboard/analytics/lib/types';

export type OrgAnalyticsUnlockedRow = Extract<OrgPortfolioRow, { locked: false }>;

export type OrgAnalyticsAttentionFilter = 'all' | 'attention' | 'on_track';
export type OrgAnalyticsKindFilter = 'all' | 'property' | 'parking';

export type OrgAnalyticsFilters = {
  search: string;
  attention: OrgAnalyticsAttentionFilter;
  kind: OrgAnalyticsKindFilter;
};

export type OrgAnalyticsSortKey = 'name' | 'occupancy' | 'revenue' | 'bookings' | 'outlook';

export type OrgAnalyticsSort = { key: OrgAnalyticsSortKey; desc: boolean };

export const ORG_ANALYTICS_DEFAULT_SORT: OrgAnalyticsSort = { key: 'revenue', desc: true };

export type OrgAttentionReason = {
  key: 'underbooked' | 'no_bookings' | 'soft_occupancy';
  label: string;
  detail: string;
  /** Higher is more urgent. */
  severity: number;
};

/** Most urgent first. Empty when the listing is on track. Booking / demand only — no finance. */
export function orgAttentionReasons(row: OrgPortfolioRow): OrgAttentionReason[] {
  if (row.locked || !listingNeedsAttention(row)) return [];
  const reasons: OrgAttentionReason[] = [];

  if (row.forwardOccupancyState30d === 'underbooked') {
    const rate = row.forwardOccupancyRate30d;
    reasons.push({
      key: 'underbooked',
      label: ORG_OUTLOOK_LABEL.underbooked,
      detail:
        rate === undefined ? 'Few nights booked ahead.' : `${rate}% of the next 30 nights booked.`,
      severity: 3,
    });
  }

  if (row.reservations === 0) {
    reasons.push({
      key: 'no_bookings',
      label: 'No bookings',
      detail: 'None in this period.',
      severity: 2,
    });
  } else if (row.occupancyRate < ORG_SOFT_OCCUPANCY_PCT) {
    reasons.push({
      key: 'soft_occupancy',
      label: 'Soft occupancy',
      detail: `${row.occupancyRate}% occupied this period.`,
      severity: 1,
    });
  }

  return reasons;
}

export function orgAttentionRank(row: OrgPortfolioRow): number {
  return orgAttentionReasons(row).reduce((max, reason) => Math.max(max, reason.severity), 0);
}

export function orgAttentionCount(rows: OrgPortfolioRow[]): number {
  return rows.reduce((count, row) => count + (orgAttentionRank(row) > 0 ? 1 : 0), 0);
}

export function orgAnalyticsHasActiveFilters(filters: OrgAnalyticsFilters): boolean {
  return filters.search.trim() !== '' || filters.attention !== 'all' || filters.kind !== 'all';
}

export function filterOrgAnalyticsRows(
  rows: OrgPortfolioRow[],
  filters: OrgAnalyticsFilters
): OrgPortfolioRow[] {
  const query = filters.search.trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.kind !== 'all' && orgPortfolioListingKind(row) !== filters.kind) return false;
    if (filters.attention !== 'all') {
      const needs = orgAttentionRank(row) > 0;
      if (filters.attention === 'attention' ? !needs : needs) return false;
    }
    if (query && !orgPortfolioListingName(row).toLowerCase().includes(query)) return false;
    return true;
  });
}

function sortValue(row: OrgAnalyticsUnlockedRow, key: OrgAnalyticsSortKey): number {
  switch (key) {
    case 'occupancy':
      return row.occupancyRate;
    case 'revenue':
      return row.grossRevenue;
    case 'bookings':
      return row.reservations;
    case 'outlook':
      return row.forwardOccupancyRate30d ?? 0;
    default:
      return 0;
  }
}

/**
 * Needs-attention listings always come first (most urgent on top), then the chosen sort applies
 * inside each group. Locked rows go last.
 */
export function sortOrgAnalyticsRows(
  rows: OrgPortfolioRow[],
  sort: OrgAnalyticsSort
): OrgPortfolioRow[] {
  return [...rows].sort((a, b) => {
    if (a.locked !== b.locked) return a.locked ? 1 : -1;
    const rankDiff = orgAttentionRank(b) - orgAttentionRank(a);
    if (rankDiff !== 0) return rankDiff;
    if (a.locked || b.locked) return 0;

    const dir = sort.desc ? -1 : 1;
    if (sort.key === 'name') {
      return dir * orgPortfolioListingName(a).localeCompare(orgPortfolioListingName(b));
    }
    const diff = sortValue(a, sort.key) - sortValue(b, sort.key);
    if (diff !== 0) return dir * diff;
    return orgPortfolioListingName(a).localeCompare(orgPortfolioListingName(b));
  });
}

export function outlookDetail(row: OrgAnalyticsUnlockedRow): string {
  const label = ORG_OUTLOOK_LABEL[row.forwardOccupancyState30d];
  return row.forwardOccupancyRate30d === undefined
    ? label
    : `${label}, ${row.forwardOccupancyRate30d}% booked`;
}
