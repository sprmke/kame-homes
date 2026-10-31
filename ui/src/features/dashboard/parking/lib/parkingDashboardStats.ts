import type { DashboardPeriod } from '@/features/dashboard/property/lib/dashboardPeriod';
import type { DashboardStats, DashboardTrendWindow } from '@/features/dashboard/property/lib/types';

import { formatDateRangeDisplay, fromIsoDate, type DatePreset } from '@/lib/date/navigation';

function periodLabel(period: DashboardPeriod, preset: DatePreset = 'month'): string {
  const from = fromIsoDate(period.from);
  const to = fromIsoDate(period.to);
  if (!from || !to) return 'This period';
  return formatDateRangeDisplay(from, to, preset);
}

export function buildEmptyParkingDashboardStats(
  period: DashboardPeriod,
  datePreset: DatePreset = 'month'
): DashboardStats {
  const trendWindow: DashboardTrendWindow = {
    from: period.from,
    to: period.to,
    label: periodLabel(period, datePreset),
  };

  const periodDays = Math.max(
    1,
    Math.round(
      (new Date(period.to).getTime() - new Date(period.from).getTime()) / (1000 * 60 * 60 * 24)
    ) + 1
  );

  return {
    manilaDate: period.to,
    attention: [],
    pipeline: [],
    trendWindow,
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
    propertyCount: 1,
    parkingCount: 0,
    trendSeries: [],
    recentBookings: [],
    propertyPerformance: [],
    parkingPerformance: [],
    statusBreakdown: [],
  };
}
