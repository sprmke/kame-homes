/** Mirrors supabase/functions/_shared/analyticsService.ts — keep in sync. */

export type AnalyticsPeriod = { from: string; to: string };

export type AnalyticsKpi = {
  value: number;
  changePctVsPrior: number | null;
  changePctVsLastYear: number | null;
};

export type ForwardOccupancyState = 'underbooked' | 'building' | 'strong' | 'fully_booked';
export type BalanceCollectionState = 'clear' | 'attention_needed' | 'at_risk';

export type AnalyticsKpis = {
  occupancyRate: AnalyticsKpi;
  adr: AnalyticsKpi;
  revpar: AnalyticsKpi;
  grossRevenue: AnalyticsKpi;
  netProfit: AnalyticsKpi;
  reservations: AnalyticsKpi;
  nightsBooked: AnalyticsKpi;
  avgLeadTimeDays: AnalyticsKpi;
  cancellationRate: AnalyticsKpi;
  avgRating: AnalyticsKpi;
  repeatGuestRate: AnalyticsKpi;
  avgResponseMinutes: AnalyticsKpi;
  responseWithin24hRate: AnalyticsKpi;
};

export type AnalyticsTrendPoint = {
  bucketStart: string;
  occupancyRate: number;
  adr: number;
  revenue: number;
};

export type AnalyticsDistributions = {
  lengthOfStay: Array<{ bucket: string; count: number }>;
  leadTime: Array<{ bucket: string; count: number }>;
  channelMix: Array<{ channel: string; count: number; revenue: number }>;
  guestAge: Array<{ bucket: string; count: number }>;
  guestOrigins: Array<{ origin: string; count: number; pct: number }>;
  partySize: Array<{ bucket: string; count: number }>;
};

export type AnalyticsForward = {
  windowDays: number;
  nightsBooked: number;
  nightsAvailable: number;
  occupancyOnBooks: number;
  revenueOnBooks: number;
  gapNights: Array<{ date: string }>;
};

export type AnalyticsPaceMonth = {
  monthStart: string;
  /** New bookings created in this bucket (not cumulative). */
  reservations: number;
  revenue: number;
  reservationsLastYear: number;
  revenueLastYear: number;
};

export type AnalyticsPickup = { last7Days: number; last30Days: number };

export type AnalyticsStateAssessment = {
  forwardOccupancyState30d: ForwardOccupancyState;
  forwardOccupancyState60d: ForwardOccupancyState;
  balanceCollectionState: BalanceCollectionState;
  unpaidBalanceUpcomingTotal: number;
  unpaidBalanceUpcomingCount: number;
};

export type AnalyticsSufficiency = { sampleSize: number; enough: boolean };

/** Privacy-guarded "vs Kame median" benchmark — never shown below a minimum peer sample. */
export type PlatformBenchmark = {
  available: boolean;
  sampleSize: number;
  medianOccupancyRate: number | null;
  medianAdr: number | null;
  occupancyPercentile: number | null;
  adrPercentile: number | null;
};

export type AnalyticsPublicPage = {
  pageViews: number;
  uniqueVisitors: number;
  topReferrers: Array<{ referrer: string; count: number }>;
};

export type AnalyticsBundle = {
  tier: 'full';
  period: AnalyticsPeriod;
  priorPeriod: AnalyticsPeriod;
  lastYearPeriod: AnalyticsPeriod;
  kpis: AnalyticsKpis;
  trend: AnalyticsTrendPoint[];
  distributions: AnalyticsDistributions;
  forward: AnalyticsForward;
  bookingPace: AnalyticsPaceMonth[];
  pickup: AnalyticsPickup;
  stateAssessment: AnalyticsStateAssessment;
  sufficiency: AnalyticsSufficiency;
  publicPage: AnalyticsPublicPage;
  playbook: AnalyticsPlaybookArticle[];
  benchmark: PlatformBenchmark;
};

export type AnalyticsPlaybookArticle = {
  slug: string;
  category: string;
  title: string;
  bodyMd: string;
  sortOrder: number;
};

export type AnalyticsTeaser = {
  tier: 'teaser';
  period: AnalyticsPeriod;
  kpis: Pick<AnalyticsKpis, 'occupancyRate' | 'adr' | 'revpar' | 'reservations'>;
  sufficiency: AnalyticsSufficiency;
};

export type AnalyticsSummaryResponse = AnalyticsBundle | AnalyticsTeaser;

export type AnalyticsQuery = {
  from: string;
  to: string;
};

export function isFullAnalyticsBundle(
  response: AnalyticsSummaryResponse
): response is AnalyticsBundle {
  return response.tier === 'full';
}

/** Mirrors analytics-org-summary's response shape. */
export type OrgPortfolioRowLocked = {
  propertyId: string;
  propertyName: string;
  propertySlug: string;
  locked: true;
};

export type OrgPortfolioRowUnlocked = {
  propertyId: string;
  propertyName: string;
  propertySlug: string;
  locked: false;
  occupancyRate: number;
  adr: number;
  revpar: number;
  grossRevenue: number;
  reservations: number;
  cancellationRate: number;
  forwardOccupancyState30d: ForwardOccupancyState;
  balanceCollectionState: BalanceCollectionState;
};

export type OrgPortfolioRow = OrgPortfolioRowLocked | OrgPortfolioRowUnlocked;

export type OrgAnalyticsSummary = {
  period: AnalyticsPeriod;
  portfolio: {
    totalRevenue: number;
    totalReservations: number;
    avgOccupancy: number;
    propertyCount: number;
    entitledPropertyCount: number;
  };
  rows: OrgPortfolioRow[];
};
