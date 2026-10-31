/**
 * Org portfolio rollup helpers — night-weighted occupancy + attention flags.
 * Mirrors supabase/functions/_shared/analyticsService.ts#rollupOrgPortfolio.
 */

import { describe, expect, it } from 'vitest';

type ForwardOccupancyState = 'underbooked' | 'building' | 'strong' | 'fully_booked';

function listingNeedsAttention(row: {
  forwardOccupancyState30d: ForwardOccupancyState;
  reservations?: number;
  occupancyRate?: number;
}): boolean {
  if (row.forwardOccupancyState30d === 'underbooked') return true;
  if (row.reservations === 0) return true;
  if (row.occupancyRate !== undefined && row.occupancyRate < 40 && (row.reservations ?? 0) > 0) {
    return true;
  }
  return false;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function rollupOrgPortfolio(
  rows: Array<{
    occupiedNights: number;
    periodDays: number;
    grossRevenue: number;
    reservations: number;
    occupancyRate?: number;
    forwardOccupancyState30d: ForwardOccupancyState;
  }>
) {
  let totalRevenue = 0;
  let totalReservations = 0;
  let totalOccupiedNights = 0;
  let totalAvailableNights = 0;
  let attentionCount = 0;
  for (const row of rows) {
    totalRevenue = roundMoney(totalRevenue + row.grossRevenue);
    totalReservations += row.reservations;
    totalOccupiedNights += row.occupiedNights;
    totalAvailableNights += row.periodDays;
    const occupancyRate =
      row.occupancyRate ??
      (row.periodDays > 0 ? roundMoney((row.occupiedNights / row.periodDays) * 100) : 0);
    if (
      listingNeedsAttention({
        forwardOccupancyState30d: row.forwardOccupancyState30d,
        reservations: row.reservations,
        occupancyRate,
      })
    ) {
      attentionCount += 1;
    }
  }
  return {
    totalRevenue,
    totalReservations,
    avgOccupancy:
      totalAvailableNights > 0 ? roundMoney((totalOccupiedNights / totalAvailableNights) * 100) : 0,
    attentionCount,
    totalOccupiedNights,
    totalAvailableNights,
  };
}

describe('rollupOrgPortfolio', () => {
  it('uses night-weighted occupancy, not mean of rates', () => {
    const rows = [
      {
        occupiedNights: 3,
        periodDays: 30,
        grossRevenue: 1000,
        reservations: 1,
        forwardOccupancyState30d: 'underbooked' as const,
      },
      {
        occupiedNights: 27,
        periodDays: 30,
        grossRevenue: 9000,
        reservations: 5,
        forwardOccupancyState30d: 'strong' as const,
      },
    ];
    const unequal = [
      {
        occupiedNights: 3,
        periodDays: 10,
        grossRevenue: 300,
        reservations: 1,
        forwardOccupancyState30d: 'underbooked' as const,
      },
      {
        occupiedNights: 27,
        periodDays: 30,
        grossRevenue: 2700,
        reservations: 5,
        forwardOccupancyState30d: 'strong' as const,
      },
    ];
    expect(rollupOrgPortfolio(unequal).avgOccupancy).toBe(75);
    expect(rollupOrgPortfolio(rows).totalRevenue).toBe(10000);
    expect(rollupOrgPortfolio(rows).attentionCount).toBe(1);
  });

  it('counts attention for underbooked, empty, or soft occupancy — not balances', () => {
    expect(
      listingNeedsAttention({
        forwardOccupancyState30d: 'strong',
        reservations: 0,
      })
    ).toBe(true);
    expect(
      listingNeedsAttention({
        forwardOccupancyState30d: 'building',
        reservations: 2,
        occupancyRate: 25,
      })
    ).toBe(true);
    expect(
      listingNeedsAttention({
        forwardOccupancyState30d: 'fully_booked',
        reservations: 4,
        occupancyRate: 80,
      })
    ).toBe(false);
  });
});
