import { describe, expect, it } from 'vitest';

import { orgPortfolioRowsToCsv } from '@/features/dashboard/analytics/lib/exportCsv';
import type { OrgPortfolioRow } from '@/features/dashboard/analytics/lib/types';

describe('orgPortfolioRowsToCsv', () => {
  it('includes kind and listing columns for property and parking rows', () => {
    const rows: OrgPortfolioRow[] = [
      {
        kind: 'property',
        id: 'p1',
        name: 'Solea',
        slug: 'solea',
        propertyId: 'p1',
        propertyName: 'Solea',
        propertySlug: 'solea',
        locked: false,
        occupancyRate: 70,
        adr: 2000,
        revpar: 1400,
        grossRevenue: 50000,
        reservations: 4,
        cancellationRate: 0,
        forwardOccupancyState30d: 'strong',
        balanceCollectionState: 'clear',
        occupiedNights: 21,
        periodDays: 30,
      },
      {
        kind: 'parking',
        id: 'k1',
        name: 'Slot A',
        slug: 'slot-a',
        propertyId: 'k1',
        propertyName: 'Slot A',
        propertySlug: 'slot-a',
        locked: false,
        occupancyRate: 40,
        adr: 500,
        revpar: 200,
        grossRevenue: 6000,
        reservations: 2,
        cancellationRate: 0,
        forwardOccupancyState30d: 'underbooked',
        balanceCollectionState: 'attention_needed',
        occupiedNights: 12,
        periodDays: 30,
      },
    ];
    const csv = orgPortfolioRowsToCsv(rows);
    expect(csv).toContain('Kind,Listing');
    expect(csv).toContain('Forward occupancy %');
    expect(csv).not.toContain('Balance state');
    expect(csv).toContain('property,Solea');
    expect(csv).toContain('parking,Slot A');
    expect(csv).toContain('underbooked');
  });
});
