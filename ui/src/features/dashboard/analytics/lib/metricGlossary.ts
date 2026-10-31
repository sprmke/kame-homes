/**
 * Host-facing, one-line metric definitions for the Analytics page tooltips.
 * Mirrors the plain-language copy in
 * `supabase/functions/_shared/dashboardAssistantAnalyticsTools.ts` (`METRIC_EXPLANATIONS`) —
 * keep the two in sync. Shorter here: these sit in a tooltip, not a chat reply.
 */

export type AnalyticsMetricKey =
  | 'forwardOccupancy'
  | 'occupancy'
  | 'adr'
  | 'revpar'
  | 'reservations'
  | 'leadTime'
  | 'cancellationRate'
  | 'rating'
  | 'responseRate'
  | 'occupancyOnBooks'
  | 'revenueOnBooks'
  | 'pickup';

export const ANALYTICS_METRIC_GLOSSARY: Record<AnalyticsMetricKey, string> = {
  forwardOccupancy:
    "How full the next 30 days look compared with this property's own trailing 90-day baseline — not a fixed global threshold.",
  occupancy: 'Nights booked divided by nights available in the selected period.',
  adr: 'Average nightly rate. Lodging revenue divided by nights booked, before fees.',
  revpar:
    'Revenue per available night. Lodging revenue divided by every night, booked or open. It blends how full you are with how much you charge.',
  reservations: 'Non-cancelled bookings with a check-in date inside the selected period.',
  leadTime: 'Average days between the moment a guest books and their check-in date.',
  cancellationRate: 'Cancelled bookings divided by all bookings with a check-in in the period.',
  rating: 'Average guest rating from reviews submitted for stays in the period.',
  responseRate: 'Share of new guest messages that got a first reply within 24 hours.',
  occupancyOnBooks:
    'Nights already reserved in the next 90 days divided by total nights in that window. This looks forward, not back.',
  revenueOnBooks: 'Booking revenue already confirmed for stays in the next 90 days.',
  pickup: 'New reservations made in the last 7 or 30 days for any future check-in date.',
};
