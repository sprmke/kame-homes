import { describe, expect, it } from 'vitest';

import {
  filterOrgAnalyticsRows,
  orgAttentionCount,
  orgAttentionReasons,
  sortOrgAnalyticsRows,
} from '@/features/dashboard/analytics/lib/orgAnalyticsListings';
import type { OrgPortfolioRow } from '@/features/dashboard/analytics/lib/types';

function row(
  name: string,
  overrides: Partial<Extract<OrgPortfolioRow, { locked: false }>> = {}
): OrgPortfolioRow {
  return {
    kind: 'property',
    id: name,
    name,
    slug: name.toLowerCase(),
    propertyId: name,
    propertyName: name,
    propertySlug: name.toLowerCase(),
    locked: false,
    occupancyRate: 50,
    adr: 0,
    revpar: 0,
    grossRevenue: 1000,
    reservations: 1,
    cancellationRate: 0,
    forwardOccupancyState30d: 'strong',
    forwardOccupancyRate30d: 70,
    balanceCollectionState: 'clear',
    occupiedNights: 10,
    periodDays: 30,
    ...overrides,
  };
}

const names = (rows: OrgPortfolioRow[]) => rows.map((r) => r.name);

describe('orgAttentionReasons', () => {
  it('is empty for an on-track listing', () => {
    expect(orgAttentionReasons(row('A'))).toEqual([]);
  });

  it('ignores unpaid balance and lists booking signals', () => {
    const reasons = orgAttentionReasons(
      row('A', {
        forwardOccupancyState30d: 'underbooked',
        forwardOccupancyRate30d: 12,
        balanceCollectionState: 'at_risk',
        unpaidBalanceUpcomingTotal: 5000,
        unpaidBalanceUpcomingCount: 2,
        reservations: 0,
        occupancyRate: 10,
      })
    );
    expect(reasons.map((r) => r.key)).toEqual(['underbooked', 'no_bookings']);
    expect(reasons.some((r) => r.key.startsWith('balance'))).toBe(false);
  });

  it('flags soft occupancy when bookings exist but period fill is low', () => {
    const reasons = orgAttentionReasons(
      row('Soft', {
        occupancyRate: 25,
        reservations: 2,
        forwardOccupancyState30d: 'building',
      })
    );
    expect(reasons.map((r) => r.key)).toEqual(['soft_occupancy']);
  });
});

describe('sortOrgAnalyticsRows', () => {
  const rows = [
    row('Rich', { grossRevenue: 9000 }),
    row('Under', { forwardOccupancyState30d: 'underbooked', grossRevenue: 100 }),
    row('Empty', { reservations: 0, grossRevenue: 50 }),
    row('Soft', { occupancyRate: 20, reservations: 2, grossRevenue: 500 }),
  ];

  it('pins needs-attention first, most urgent on top, then by revenue', () => {
    const sorted = sortOrgAnalyticsRows(rows, { key: 'revenue', desc: true });
    expect(names(sorted)).toEqual(['Under', 'Empty', 'Soft', 'Rich']);
  });

  it('keeps attention pinned when sorting ascending', () => {
    const sorted = sortOrgAnalyticsRows(
      [row('Big', { grossRevenue: 9000 }), row('Small', { grossRevenue: 10 }), rows[1]],
      { key: 'revenue', desc: false }
    );
    expect(names(sorted)).toEqual(['Under', 'Small', 'Big']);
  });
});

describe('filterOrgAnalyticsRows', () => {
  const rows = [
    row('Azure North'),
    row('Azure Parking', { kind: 'parking' }),
    row('Low', { forwardOccupancyState30d: 'underbooked' }),
  ];

  it('filters by attention, type and search', () => {
    const base = { search: '', attention: 'all', kind: 'all' } as const;
    expect(names(filterOrgAnalyticsRows(rows, { ...base, attention: 'attention' }))).toEqual([
      'Low',
    ]);
    expect(names(filterOrgAnalyticsRows(rows, { ...base, kind: 'parking' }))).toEqual([
      'Azure Parking',
    ]);
    expect(names(filterOrgAnalyticsRows(rows, { ...base, search: ' azure ' }))).toEqual([
      'Azure North',
      'Azure Parking',
    ]);
    expect(orgAttentionCount(rows)).toBe(1);
  });
});
