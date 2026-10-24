import { seedSupabaseAuthSession } from '../../../shared/authSeam';
import { mockEdgeFunctions } from '../../../shared/interceptEdge';

import type { Page, Route } from '@playwright/test';

const now = new Date().toISOString();
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

const counts = (partial: Record<string, number>) => ({
  ok: 0,
  warn: 0,
  error: 0,
  off: 0,
  unknown: 0,
  ...partial,
});

const job = (overrides: Record<string, unknown>) => ({
  features: [],
  cronJobs: [{ name: 'job', schedule: '*/15 * * * *', active: true }],
  expectedIntervalMinutes: 15,
  lastSuccessAt: minutesAgo(5),
  lastFailureAt: null,
  lastStatus: 'ok',
  lastError: null,
  lastDurationMs: 1200,
  consecutiveFailures: 0,
  totalRuns: 40,
  totalFailures: 0,
  minutesSinceSuccess: 5,
  ...overrides,
});

export const systemHealthSummary = {
  success: true,
  data: {
    environment: 'production',
    generatedAt: now,
    overall: 'error',
    categories: {
      configuration: { status: 'error', counts: counts({ ok: 2, error: 1 }) },
      security: { status: 'ok', counts: counts({ ok: 1 }) },
      integrations: { status: 'warn', counts: counts({ warn: 2 }) },
      jobs: { status: 'error', counts: counts({ ok: 1, error: 1 }) },
      database: { status: 'ok', counts: counts({ ok: 2 }) },
    },
    checks: [
      {
        id: 'env.edge.SUPABASE_URL',
        category: 'configuration',
        group: 'Core',
        label: 'SUPABASE_URL',
        status: 'ok',
        detail: 'https://example.supabase.co',
        features: ['Everything'],
      },
      {
        id: 'env.edge.RESEND_API_KEY',
        category: 'configuration',
        group: 'Email',
        label: 'RESEND_API_KEY',
        status: 'error',
        detail: 'Missing',
        hint: 'Create an API key in Resend.',
        features: ['All email'],
        manageHref: 'https://supabase.com/dashboard/project/abcdefghijklmnopqrst/functions/secrets',
      },
      {
        id: 'env.edge.GEMINI_API_KEY',
        category: 'configuration',
        group: 'AI',
        label: 'GEMINI_API_KEY or GEMINI_API_KEYS',
        status: 'ok',
        detail: 'Set',
        features: ['All AI features'],
      },
      {
        id: 'posture.edge.captcha',
        category: 'security',
        group: 'Production posture',
        label: 'CAPTCHA enforced',
        status: 'ok',
        detail: 'OK',
      },
      {
        id: 'probe.gemini',
        category: 'integrations',
        group: 'AI',
        label: 'Gemini',
        status: 'warn',
        detail: 'Gemini rate limit or quota reached',
        hint: 'Replace the key in Google AI Studio, or raise its quota.',
        checkedAt: minutesAgo(3),
        probeId: 'gemini',
        manageHref: 'https://aistudio.google.com/apikey',
      },
      {
        id: 'tenant.meta.tokens',
        category: 'integrations',
        group: 'Meta channels',
        label: 'Page connections',
        status: 'warn',
        detail: '2 connected, 1 expiring in 7 days',
        items: [
          {
            label: 'Casa Azul Facebook',
            detail: 'Expires within 7 days',
            href: '/admin/orgs/casa-azul',
          },
        ],
      },
      {
        id: 'job.sd-refund-cron',
        category: 'jobs',
        group: 'Scheduled jobs',
        label: 'SD refund',
        status: 'ok',
        detail: 'Last success 5m ago',
      },
      {
        id: 'job.calendar-sync-cron',
        category: 'jobs',
        group: 'Scheduled jobs',
        label: 'Calendar sync',
        status: 'error',
        detail: 'Failed 4 runs in a row',
        hint: 'Check the edge function logs for this job.',
      },
      {
        id: 'db.ext.pg_cron',
        category: 'database',
        group: 'Database',
        label: 'pg_cron extension',
        status: 'ok',
        detail: 'Installed',
      },
      {
        id: 'db.size',
        category: 'database',
        group: 'Database',
        label: 'Database size',
        status: 'ok',
        detail: '265 MB of 8.00 GB',
      },
    ],
    jobs: [
      job({
        fn: 'sd-refund-cron',
        label: 'SD refund',
        status: 'ok',
        detail: 'Last success 5m ago',
      }),
      job({
        fn: 'calendar-sync-cron',
        label: 'Calendar sync',
        status: 'error',
        detail: 'Failed 4 runs in a row',
        hint: 'Check the edge function logs for this job.',
        lastStatus: 'error',
        lastError: 'HTTP 500',
        consecutiveFailures: 4,
        totalFailures: 4,
        lastSuccessAt: minutesAgo(90),
        minutesSinceSuccess: 90,
        logsHref:
          'https://supabase.com/dashboard/project/abcdefghijklmnopqrst/functions/calendar-sync-cron/logs',
      }),
    ],
    sqlOnlyJobs: [{ name: 'prune-rate-limits', schedule: '0 3 * * *', active: true }],
    probesLastRunAt: minutesAgo(3),
    projectRef: 'abcdefghijklmnopqrst',
    vapidPublicKey: null,
  },
};

const capacity = {
  success: true,
  data: {
    capacity: {
      db_size_bytes: 278_350_995,
      tables: [
        { name: 'guest_submissions', bytes: 52_000_000, approx_rows: 12_000 },
        { name: 'activity_log', bytes: 31_000_000, approx_rows: 80_000 },
      ],
      buckets: [{ bucket: 'property-media', objects: 46, bytes: 51_592_104 }],
    },
  },
};

const aiUsage = {
  success: true,
  data: {
    range: '30d',
    generatedAt: now,
    totals: {
      costUsd: 12.5,
      calls: 900,
      orgsWithUsage: 4,
      quotaBreaches: 1,
      monthToDateUsd: 8.2,
      projectedMonthEndUsd: 14.1,
      platformDailyCapUsd: 5,
    },
    dailySeries: [
      { date: '2026-10-17', costUsd: 0.4, calls: 30 },
      { date: '2026-10-18', costUsd: 0.6, calls: 40 },
    ],
    featureBreakdown: [
      {
        feature: 'inbox_reply',
        costUsd: 2,
        calls: 200,
        errors: 40,
        errorRatePct: 20,
        fallbackRatePct: 5,
        latencyP50Ms: 900,
        latencyP95Ms: 2000,
      },
    ],
    topOrgs: [],
    quotaBreaches: [],
  },
};

const rateLimits = {
  success: true,
  data: { enforceEnabled: true, limit: 120, activeCounters: [], blocks: [] },
};

async function json(route: Route, body: unknown) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

export async function installSystemHealthMocks(page: Page) {
  const probePosts: Array<Record<string, unknown>> = [];
  await seedSupabaseAuthSession(page, 'host');
  await mockEdgeFunctions(page, [
    {
      name: 'list-organizations',
      body: { success: true, data: { organizations: [], isSuperAdmin: true } },
    },
    { name: 'super-admin-ai-usage', body: aiUsage },
    { name: 'super-admin-rate-limits', body: rateLimits },
    {
      name: 'super-admin-system-health',
      handler: async (route) => {
        const request = route.request();
        if (request.method() === 'POST') {
          probePosts.push(JSON.parse(request.postData() ?? '{}'));
          await json(route, {
            success: true,
            data: { ran: ['gemini'], throttled: [], checks: [] },
          });
          return;
        }
        const view = new URL(request.url()).searchParams.get('view');
        if (view === 'capacity') return json(route, capacity);
        return json(route, systemHealthSummary);
      },
    },
  ]);
  return probePosts;
}
