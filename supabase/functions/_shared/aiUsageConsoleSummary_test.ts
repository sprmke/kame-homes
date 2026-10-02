import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  summarizeMarketingGenerations,
  summarizeUsageByPlan,
  type ConsoleGenerationJob,
  type ConsolePlan,
} from './aiUsageConsoleSummary.ts';

const plans: ConsolePlan[] = [
  {
    id: 'p-pro',
    code: 'pro',
    name: 'Pro',
    sortOrder: 2,
    isDefault: false,
    monthlyCreditAllowance: 1000,
  },
  {
    id: 'p-free',
    code: 'free',
    name: 'Free',
    sortOrder: 0,
    isDefault: true,
    monthlyCreditAllowance: 0,
  },
  {
    id: 'p-biz',
    code: 'business',
    name: 'Business',
    sortOrder: 3,
    isDefault: false,
    monthlyCreditAllowance: 5000,
  },
];

Deno.test('summarizeUsageByPlan: orgs without a subscription fall to the default plan', () => {
  const rows = summarizeUsageByPlan({
    plans,
    orgIds: ['a', 'b', 'c'],
    planIdByOrg: new Map([['a', 'p-pro']]),
    events: [
      { organization_id: 'a', status: 'success', estimated_cost_usd: 0.5, credits_consumed: 500 },
      { organization_id: 'b', status: 'success', estimated_cost_usd: '0.01', credits_consumed: 10 },
      { organization_id: 'b', status: 'error', estimated_cost_usd: 0, credits_consumed: 0 },
    ],
    monthCreditsByOrg: new Map([['a', 1200]]),
  });

  assertEquals(
    rows.map((r) => r.planCode),
    ['free', 'pro', 'business']
  );
  const free = rows[0];
  assertEquals([free.orgCount, free.activeOrgs, free.calls, free.credits], [2, 1, 1, 10]);
  const pro = rows[1];
  assertEquals(pro.orgsAtAllowance, 1);
  assertEquals(pro.monthCredits, 1200);
  assertEquals(pro.costUsd, 0.5);
  const business = rows[2];
  assertEquals([business.orgCount, business.calls], [0, 0]);
});

Deno.test('summarizeUsageByPlan: a zero allowance never counts as at allowance', () => {
  const rows = summarizeUsageByPlan({
    plans,
    orgIds: ['b'],
    planIdByOrg: new Map(),
    events: [],
    monthCreditsByOrg: new Map([['b', 50]]),
  });
  assertEquals(rows[0].orgsAtAllowance, 0);
});

function job(overrides: Partial<ConsoleGenerationJob>): ConsoleGenerationJob {
  return {
    media_type: 'video',
    quality_tier: 'standard',
    resolution: '1080p',
    job_status: 'completed',
    error_code: null,
    credits_consumed: 960,
    estimated_cost_usd: 0.96,
    usage_recorded_at: '2026-10-01T00:02:00Z',
    created_at: '2026-10-01T00:00:00Z',
    completed_at: '2026-10-01T00:01:30Z',
    ...overrides,
  };
}

Deno.test('summarizeMarketingGenerations: outcomes, render time and blocked vs failed', () => {
  const now = new Date('2026-10-01T01:00:00Z');
  const summary = summarizeMarketingGenerations(
    [
      job({}),
      job({ completed_at: '2026-10-01T00:00:30Z' }),
      job({ job_status: 'failed', error_code: 'safety_blocked', credits_consumed: null }),
      job({ job_status: 'failed', error_code: 'invalid_output', credits_consumed: null }),
      job({ job_status: 'processing', completed_at: null }),
      job({
        media_type: 'image',
        resolution: '1K',
        credits_consumed: 39,
        estimated_cost_usd: 0.039,
      }),
    ],
    now
  );

  const video = summary.rows.find((r) => r.mediaType === 'video')!;
  assertEquals(
    [video.total, video.completed, video.failed, video.blocked, video.inFlight],
    [5, 2, 1, 1, 1]
  );
  assertEquals(video.successRatePct, 50);
  assertEquals(video.credits, 1920);
  assertEquals(video.renderP50Seconds, 90);

  const image = summary.rows.find((r) => r.mediaType === 'image')!;
  assertEquals(image.resolution, null);
  assertEquals(image.credits, 39);

  assertEquals(summary.failureReasons, [
    { code: 'safety_blocked', count: 1 },
    { code: 'invalid_output', count: 1 },
  ]);
  assertEquals(summary.unbilledCompleted, 0);
});

Deno.test(
  'summarizeMarketingGenerations: flags completed jobs still unbilled after 10 minutes',
  () => {
    const now = new Date('2026-10-01T01:00:00Z');
    const summary = summarizeMarketingGenerations(
      [
        job({ usage_recorded_at: null, completed_at: '2026-10-01T00:30:00Z' }),
        job({ usage_recorded_at: null, completed_at: '2026-10-01T00:55:00Z' }),
      ],
      now
    );
    assertEquals(summary.unbilledCompleted, 1);
  }
);
