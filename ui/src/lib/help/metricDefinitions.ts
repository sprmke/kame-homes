/**
 * Shared host-facing definitions for dashboard KPIs.
 *
 * Each `source` names the file and symbol that computes the number. The
 * `metricDefinitions.test.ts` guard fails when the file disappears or the
 * symbol is renamed, so the copy cannot quietly drift from the server.
 *
 * Verified 2026-11-05 against `_shared/dashboardService.ts` and
 * `_shared/bookingFinance.ts`.
 */
export type MetricDefinition = {
  /** One or two sentences, at most 200 characters. */
  text: string;
  source: {
    /** Repository-relative path. */
    file: string;
    /** Substring that must exist in the file. */
    symbol: string;
  };
};

export const METRIC_DEFINITIONS = {
  propertyNetIncome: {
    text: 'What you keep from bookings that check in during this period: down payment, balance, guest fees, minus parking you paid. Security deposit lines count only on completed stays.',
    source: {
      file: 'supabase/functions/_shared/bookingFinance.ts',
      symbol: 'computeOperatingHostNet',
    },
  },
  propertyNightsBooked: {
    text: 'Nights booked out of the nights in this period. A 3-night stay fills 3 nights.',
    source: {
      file: 'supabase/functions/_shared/dashboardService.ts',
      symbol: 'countOccupiedNightsInRange',
    },
  },
  propertyOccupancyRate: {
    text: 'Nights booked divided by the nights in this period.',
    source: {
      file: 'supabase/functions/_shared/dashboardService.ts',
      symbol: 'occupiedNights / (currentKpis.periodDays',
    },
  },
  averageNightlyRate: {
    text: 'Average rate on booked nights that have a rate. Nights without a rate are not counted.',
    source: {
      file: 'supabase/functions/_shared/dashboardService.ts',
      symbol: 'currentKpis.ratedNights > 0',
    },
  },
  orgNetIncome: {
    text: 'What the organization keeps from bookings that check in during this period, across every property and parking.',
    source: {
      file: 'supabase/functions/_shared/bookingFinance.ts',
      symbol: 'computeOperatingHostNet',
    },
  },
  orgBookings: {
    text: 'Bookings that check in during this period, across every property and parking. Cancelled bookings are not counted.',
    source: {
      file: 'supabase/functions/_shared/dashboardService.ts',
      symbol: 'checkInsInPeriod: totalBookings',
    },
  },
  orgOccupancyRate: {
    text: 'Nights booked divided by the nights available across all listings in this period.',
    source: {
      file: 'supabase/functions/_shared/dashboardService.ts',
      symbol: 'orgUnitCount',
    },
  },
  parkingNetIncome: {
    text: 'What you keep from reservations that start in this period, after parking costs you paid.',
    source: {
      file: 'supabase/functions/_shared/bookingFinance.ts',
      symbol: 'computeOperatingHostNet',
    },
  },
  parkingNightsBooked: {
    text: 'Slot nights booked out of the slot nights in this period.',
    source: {
      file: 'supabase/functions/_shared/dashboardService.ts',
      symbol: 'countOccupiedNightsInRange',
    },
  },
  parkingOccupancyRate: {
    text: 'Slot nights booked divided by the slot nights available in this period.',
    source: {
      file: 'supabase/functions/_shared/dashboardService.ts',
      symbol: 'occupiedNights / (currentKpis.periodDays',
    },
  },
  priorPeriod: {
    text: 'Compared with the same number of days right before this range.',
    source: {
      file: 'supabase/functions/_shared/dashboardService.ts',
      symbol: 'function previousPeriodRange',
    },
  },
} as const satisfies Record<string, MetricDefinition>;

export type MetricDefinitionKey = keyof typeof METRIC_DEFINITIONS;
