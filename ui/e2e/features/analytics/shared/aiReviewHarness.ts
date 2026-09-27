/**
 * Mocked property analytics harness focused on the AI review tab: a full bundle (so the page
 * clears its sample-size gate), two matched Playbook articles, and one latest AI review whose
 * improvements cite those articles and deep-link to Pricing.
 */

import { expect, type Page } from '@playwright/test';

import {
  FULL_ACCESS_PERMISSIONS,
  installPropertyTeamRbacMocks,
  TEAM_E2E_ORG_SLUG,
  TEAM_E2E_PROPERTY_ID,
  TEAM_E2E_PROPERTY_SLUG,
} from '../../team/shared/propertyTeamRbacHarness';

const PROPERTY_BASE = `/org/${TEAM_E2E_ORG_SLUG}/property/${TEAM_E2E_PROPERTY_SLUG}`;

export const analyticsPaths = {
  analytics: `${PROPERTY_BASE}/analytics`,
  pricing: `${PROPERTY_BASE}/pricing`,
} as const;

export const PLAYBOOK_BLOCKED_DATES = {
  slug: 'audit-blocked-dates',
  category: 'Availability',
  title: 'Audit your blocked dates',
  bodyMd: 'Open your calendar and release any date you blocked for a stay that never happened.',
  sortOrder: 1,
} as const;

export const PLAYBOOK_UNPAID_BALANCES = {
  slug: 'follow-up-unpaid-balances',
  category: 'Collections',
  title: 'Follow up on unpaid balances before check-in',
  bodyMd: 'Send a balance reminder the day before arrival so nobody checks in owing money.',
  sortOrder: 2,
} as const;

const kpi = (value: number) => ({
  value,
  changePctVsPrior: null,
  changePctVsLastYear: null,
});

function analyticsBundle() {
  return {
    tier: 'full',
    period: { from: '2026-09-01', to: '2026-09-30' },
    priorPeriod: { from: '2026-08-01', to: '2026-08-31' },
    lastYearPeriod: { from: '2025-09-01', to: '2025-09-30' },
    kpis: {
      occupancyRate: kpi(63),
      adr: kpi(2774),
      revpar: kpi(1747),
      grossRevenue: kpi(52_400),
      netProfit: kpi(41_800),
      reservations: kpi(8),
      nightsBooked: kpi(19),
      avgLeadTimeDays: kpi(12),
      cancellationRate: kpi(12.5),
      avgRating: kpi(4.9),
      repeatGuestRate: kpi(0),
      avgResponseMinutes: kpi(38),
      responseWithin24hRate: kpi(100),
    },
    trend: [],
    distributions: {
      lengthOfStay: [{ bucket: '2-3', count: 5 }],
      leadTime: [{ bucket: '8-14', count: 4 }],
      channelMix: [
        { channel: 'Airbnb', count: 5, revenue: 32_000 },
        { channel: 'Facebook', count: 3, revenue: 20_400 },
      ],
      guestAge: [{ bucket: '25-34', count: 6 }],
      guestOrigins: [{ origin: 'Makati, Metro Manila', count: 6, pct: 75 }],
      partySize: [{ bucket: '1-4', count: 8 }],
    },
    forward: {
      windowDays: 90,
      nightsBooked: 14,
      nightsAvailable: 90,
      occupancyOnBooks: 16,
      revenueOnBooks: 38_000,
      gapNights: [{ date: '2026-09-28' }],
    },
    bookingPace: [],
    pickup: { last7Days: 1, last30Days: 8 },
    stateAssessment: {
      forwardOccupancyState30d: 'building',
      forwardOccupancyState60d: 'building',
      balanceCollectionState: 'attention_needed',
      unpaidBalanceUpcomingTotal: 3900,
      unpaidBalanceUpcomingCount: 1,
    },
    sufficiency: { sampleSize: 42, enough: true },
    publicPage: { pageViews: 0, uniqueVisitors: 0, topReferrers: [] },
    playbook: [PLAYBOOK_BLOCKED_DATES, PLAYBOOK_UNPAID_BALANCES],
    benchmark: {
      available: false,
      sampleSize: 0,
      medianOccupancyRate: null,
      medianAdr: null,
      occupancyPercentile: null,
      adrPercentile: null,
    },
  };
}

function currentManilaMonthRange(): { from: string; to: string } {
  const manila = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  const y = manila.getFullYear();
  const m = manila.getMonth();
  const from = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const to = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
}

function aiReviewRecord() {
  const month = currentManilaMonthRange();
  return {
    id: 'review-e2e-001',
    generated_at: '2026-09-22T02:00:00.000Z',
    model: 'analytics-e2e',
    headline: 'Occupancy cooled after a full August. Nightly rate held.',
    score: 66,
    score_delta: -8,
    period_start: month.from,
    period_end: month.to,
    payload: {
      strengths: [
        {
          title: 'Nightly rate held',
          evidence: 'Avg nightly rate is about PHP 2,774 this month, only 1.5% below August.',
        },
        {
          title: 'October already has stays on the books',
          evidence: 'Four October stays and one early-November stay are confirmed or in review.',
        },
        {
          title: 'Bookings come from more than one channel',
          evidence:
            'Airbnb leads, with Facebook, Instagram, Booking.com, and referrals also contributing.',
        },
      ],
      improvements: [
        {
          title: 'Fill the remaining September nights',
          why: 'Occupancy is about 63% this month, down sharply from a packed August.',
          action: 'Release leftover blocked dates and price the open nights.',
          deepLink: analyticsPaths.pricing,
          articleSlugs: [PLAYBOOK_BLOCKED_DATES.slug],
        },
        {
          title: 'Collect the unpaid October balance',
          why: 'One October stay still has PHP 3,900 outstanding before check-in.',
          action: 'Send a balance reminder from Bookings before the guest arrives.',
          deepLink: null,
          articleSlugs: [PLAYBOOK_UNPAID_BALANCES.slug],
        },
      ],
      avoid: [
        {
          title: 'Do not slash the base rate after one softer month',
          why: 'ADR held while occupancy dropped. A blanket discount would give up rate for nights that may still book.',
          deepLink: analyticsPaths.pricing,
        },
        {
          title: 'Do not ignore the cancelled Facebook stay',
          why: 'One cancellation in an 8-booking month is not a pattern yet, but a second one would be.',
          deepLink: null,
        },
      ],
      metricsSnapshot: {},
    },
  };
}

function propertyAccessWithAnalytics() {
  return {
    accessKind: 'member' as const,
    permissions: [...FULL_ACCESS_PERMISSIONS, 'analytics:view', 'analytics:export'],
    memberId: 'member-team-e2e-001',
    propertyId: TEAM_E2E_PROPERTY_ID,
    orgSlug: TEAM_E2E_ORG_SLUG,
    orgName: 'Kame Homes PH',
    propertySlug: TEAM_E2E_PROPERTY_SLUG,
    propertyName: 'Solea Mactan',
    planLimited: false,
  };
}

export async function installAnalyticsAiReviewMocks(page: Page) {
  await installPropertyTeamRbacMocks(page, 'full_access');
  await installAnalyticsAiReviewRoutes(page);
}

/** Analytics routes only, for callers that install their own RBAC/plan harness first. */
export async function installAnalyticsAiReviewRoutes(page: Page) {
  // Registered last, so it wins over the shared harness handler; everything else falls through.
  await page.route('**/functions/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const endpoint = url.pathname.split('/').pop();
    if (endpoint === 'analytics-ai-review' && route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { review: aiReviewRecord(), available: true },
        }),
      });
      return;
    }
    const body =
      endpoint === 'analytics-summary'
        ? analyticsBundle()
        : endpoint === 'analytics-ai-review'
          ? { review: aiReviewRecord() }
          : endpoint === 'property-access'
            ? propertyAccessWithAnalytics()
            : null;
    if (!body) {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: body }),
    });
  });
}

export async function openAiReviewTab(page: Page, query = '') {
  await page.goto(`${analyticsPaths.analytics}${query}`);
  await page.getByRole('tab', { name: 'AI review' }).click();
  await expect(page.getByText('AI Performance Review')).toBeVisible({ timeout: 20_000 });
}
