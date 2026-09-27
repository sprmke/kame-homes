import { seedSupabaseAuthSession } from '../../../shared/authSeam';
import { mockEdgeFunctions } from '../../../shared/interceptEdge';

import type { Page, Route } from '@playwright/test';

const KEYS = [
  'dailyCallLimit',
  'monthlyCallLimit',
  'dailyCostUsdLimit',
  'dailyCreditLimit',
  'monthlyCreditLimit',
  'assistantDailyMessageLimit',
  'assistantMonthlyMessageLimit',
  'assistantDailyWriteActionLimit',
  'voiceMaxSessionSeconds',
  'voiceMaxSessionsPerGuestPerDay',
  'voiceMaxConcurrentSessions',
  'imageMonthlyCreditCap',
  'videoMonthlyCreditCap',
] as const;

function resolved(overrides: Partial<Record<(typeof KEYS)[number], number>> = {}) {
  return Object.fromEntries(
    KEYS.map((key) => [
      key,
      overrides[key] !== undefined
        ? { value: overrides[key], source: 'override', profileCode: null }
        : {
            value: key.includes('image') || key.includes('video') ? null : 100,
            source: 'global',
            profileCode: null,
          },
    ])
  );
}

const usage = {
  todayCalls: 12,
  todayCostUsd: 0.4,
  monthCalls: 300,
  monthCostUsd: 3.2,
  monthCredits: 3200,
};

const matrix = {
  success: true,
  data: {
    total: 2,
    truncated: false,
    planTiers: ['free', 'growth'],
    rows: [
      {
        organizationId: 'org-1',
        name: 'Alpha Stays',
        slug: 'alpha-stays',
        planTier: 'growth',
        aiEnabled: true,
        orgProfileCode: null,
        planProfileCode: 'growth',
        hasOverrides: false,
        overrideReason: null,
        limits: resolved(),
        usage,
        breach: false,
      },
      {
        organizationId: 'org-2',
        name: 'Beta Homes',
        slug: 'beta-homes',
        planTier: 'free',
        aiEnabled: false,
        orgProfileCode: null,
        planProfileCode: 'free',
        hasOverrides: true,
        overrideReason: 'Negotiated',
        limits: resolved({ dailyCallLimit: 5 }),
        usage,
        breach: true,
      },
    ],
  },
};

const profileLimits = Object.fromEntries(KEYS.map((key) => [key, null]));
const profiles = {
  success: true,
  data: {
    profiles: [
      {
        id: 'p-default',
        code: 'default',
        name: 'Platform default',
        description: null,
        isDefault: true,
        updatedAt: null,
        limits: { ...profileLimits, assistantDailyMessageLimit: 50 },
        usage: {
          organizationAssignments: 0,
          propertyAssignments: 0,
          developmentAssignments: 0,
          plans: [],
          affectedOrganizations: 1,
          spend30dUsd: 4,
        },
      },
      {
        id: 'p-growth',
        code: 'growth',
        name: 'Growth',
        description: null,
        isDefault: false,
        updatedAt: null,
        limits: { ...profileLimits, dailyCallLimit: 400 },
        usage: {
          organizationAssignments: 0,
          propertyAssignments: 0,
          developmentAssignments: 0,
          plans: [{ id: 'plan-growth', code: 'growth', name: 'Growth' }],
          affectedOrganizations: 1,
          spend30dUsd: 12.5,
        },
      },
    ],
    developments: [
      { id: 'dev-1', name: 'Azure North', propertyCount: 3, profileId: null, profileCode: null },
    ],
    plans: [
      {
        id: 'plan-growth',
        code: 'growth',
        name: 'Growth',
        profileId: 'p-growth',
        profileCode: 'growth',
      },
    ],
  },
};

const orgDetail = {
  success: true,
  data: {
    organization: { id: 'org-1', name: 'Alpha Stays', slug: 'alpha-stays' },
    resolved: {
      limits: resolved(),
      planTier: 'growth',
      orgProfileCode: null,
      planProfileCode: 'growth',
      hasOverrides: false,
      overrideReason: null,
    },
    assignment: null,
    properties: [],
    dailySeries: [],
    profiles: [{ id: 'p-growth', code: 'growth', name: 'Growth' }],
  },
};

async function json(route: Route, body: unknown) {
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
}

export async function installConsoleMocks(page: Page) {
  const posts: Array<Record<string, unknown>> = [];
  await seedSupabaseAuthSession(page, 'host');
  await mockEdgeFunctions(page, [
    {
      name: 'list-organizations',
      body: { success: true, data: { organizations: [], isSuperAdmin: true } },
    },
    {
      name: 'super-admin-ai-limits',
      handler: async (route) => {
        const request = route.request();
        if (request.method() === 'POST') {
          posts.push(JSON.parse(request.postData() ?? '{}'));
          await json(route, { success: true, data: { affected: 1 } });
          return;
        }
        const view = new URL(request.url()).searchParams.get('view');
        if (view === 'profiles') return json(route, profiles);
        if (view === 'org') return json(route, orgDetail);
        return json(route, matrix);
      },
    },
  ]);
  return posts;
}
