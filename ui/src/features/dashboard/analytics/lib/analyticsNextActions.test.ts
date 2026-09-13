import { describe, expect, it } from 'vitest';

import { buildAnalyticsNextActions } from '@/features/dashboard/analytics/lib/analyticsNextActions';
import { inclusiveDayCount } from '@/features/dashboard/analytics/lib/analyticsPeriod';
import type {
  AnalyticsForward,
  AnalyticsPublicPage,
  AnalyticsStateAssessment,
} from '@/features/dashboard/analytics/lib/types';

const forward = (booked: number, available = 90): AnalyticsForward => ({
  windowDays: available,
  nightsBooked: booked,
  nightsAvailable: available,
  occupancyOnBooks: available > 0 ? Math.round((booked / available) * 100) : 0,
  revenueOnBooks: booked * 3000,
  gapNights: [],
});

const page = (pageViews: number): AnalyticsPublicPage => ({
  pageViews,
  uniqueVisitors: pageViews,
  topReferrers: [],
});

const state = (
  occupancy: AnalyticsStateAssessment['forwardOccupancyState30d'],
  balance: AnalyticsStateAssessment['balanceCollectionState'] = 'clear',
  unpaid = 0
): AnalyticsStateAssessment => ({
  forwardOccupancyState30d: occupancy,
  forwardOccupancyState60d: occupancy,
  balanceCollectionState: balance,
  unpaidBalanceUpcomingTotal: unpaid * 1000,
  unpaidBalanceUpcomingCount: unpaid,
});

const base = {
  orgSlug: 'acme',
  propertySlug: 'solea',
  playbook: [
    { slug: 'fill-gaps', category: 'pricing', title: 'Fill nearby gaps', bodyMd: '', sortOrder: 1 },
  ],
};

describe('inclusiveDayCount', () => {
  it('counts a full month inclusively', () => {
    expect(inclusiveDayCount('2026-09-01', '2026-09-30')).toBe(30);
  });

  it('returns 1 for a single day', () => {
    expect(inclusiveDayCount('2026-09-13', '2026-09-13')).toBe(1);
  });

  it('returns 0 when the range is inverted', () => {
    expect(inclusiveDayCount('2026-09-30', '2026-09-01')).toBe(0);
  });
});

describe('buildAnalyticsNextActions', () => {
  it('prioritizes unpaid balances, then pricing and marketing when underbooked', () => {
    const actions = buildAnalyticsNextActions({
      ...base,
      state: state('underbooked', 'at_risk', 2),
      forward: forward(0),
      publicPage: page(0),
    });
    expect(actions.map((a) => a.key)).toEqual(['collect', 'pricing', 'marketing']);
    expect(actions[0]?.to).toBe('/org/acme/property/solea/bookings');
  });

  it('suggests raising remaining rates when fully booked with open nights', () => {
    const actions = buildAnalyticsNextActions({
      ...base,
      state: state('fully_booked'),
      forward: forward(85),
      publicPage: page(40),
    });
    expect(actions[0]).toMatchObject({ key: 'raise', to: '/org/acme/property/solea/pricing' });
  });

  it('falls back to the matched playbook tip', () => {
    const actions = buildAnalyticsNextActions({
      ...base,
      state: state('strong'),
      forward: forward(90),
      publicPage: page(12),
    });
    expect(actions).toEqual([{ key: 'playbook', label: 'Fill nearby gaps', action: 'ai-review' }]);
  });
});
