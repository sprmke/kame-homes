import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  summarizeMarketingGenerations,
  summarizeUsageByPlan,
  type ConsolePlan,
  type GenerationRollupRow,
} from './aiUsageConsoleSummary.ts';

const plans: ConsolePlan[] = [
  { id: 'p-pro', code: 'pro', name: 'Pro', sortOrder: 2, monthlyCreditAllowance: 1000 },
  { id: 'p-free', code: 'free', name: 'Free', sortOrder: 0, monthlyCreditAllowance: 0 },
  { id: 'p-biz', code: 'business', name: 'Business', sortOrder: 3, monthlyCreditAllowance: 5000 },
];

Deno.test(
  'summarizeUsageByPlan: every plan in sort order, numerics parsed, empty plans zeroed',
  () => {
    const rows = summarizeUsageByPlan(plans, [
      {
        plan_id: 'p-pro',
        org_count: '3',
        active_orgs: '1',
        calls: '1500',
        credits: '1440000.000',
        cost_usd: '1440.000000',
        month_credits: '1200.000',
        orgs_at_allowance: '1',
      },
      {
        plan_id: 'p-free',
        org_count: 8,
        active_orgs: 0,
        calls: 0,
        credits: 0,
        cost_usd: 0,
        month_credits: 0,
        orgs_at_allowance: 0,
      },
    ]);

    assertEquals(
      rows.map((r) => r.planCode),
      ['free', 'pro', 'business']
    );
    assertEquals(rows[1], {
      planCode: 'pro',
      planName: 'Pro',
      orgCount: 3,
      activeOrgs: 1,
      calls: 1500,
      credits: 1_440_000,
      costUsd: 1440,
      creditAllowancePerOrg: 1000,
      monthCredits: 1200,
      orgsAtAllowance: 1,
    });
    assertEquals([rows[2].orgCount, rows[2].calls, rows[2].credits], [0, 0, 0]);
  }
);

function rollup(overrides: Partial<GenerationRollupRow>): GenerationRollupRow {
  return {
    media_type: 'video',
    quality_tier: 'standard',
    resolution: '1080p',
    job_status: 'completed',
    error_code: null,
    jobs: 1,
    credits: 0,
    cost_usd: 0,
    render_p50_seconds: null,
    render_p95_seconds: null,
    unbilled: 0,
    ...overrides,
  };
}

Deno.test('summarizeMarketingGenerations: folds status rows into one bucket per type', () => {
  const summary = summarizeMarketingGenerations([
    rollup({
      jobs: '8',
      credits: '7680',
      cost_usd: '7.68',
      render_p50_seconds: 75,
      render_p95_seconds: 140,
      unbilled: '1',
    }),
    rollup({ job_status: 'failed', error_code: 'safety_blocked', jobs: 1, cost_usd: 0.96 }),
    rollup({ job_status: 'failed', error_code: 'invalid_output', jobs: 1, cost_usd: 0.96 }),
    rollup({ job_status: 'processing', jobs: 2 }),
    rollup({ media_type: 'image', resolution: '1K', jobs: 3, credits: 117, cost_usd: 0.117 }),
  ]);

  const video = summary.rows.find((r) => r.mediaType === 'video')!;
  assertEquals(
    [video.total, video.completed, video.failed, video.blocked, video.inFlight],
    [12, 8, 1, 1, 2]
  );
  assertEquals(video.successRatePct, 80);
  assertEquals(video.credits, 7680);
  assertEquals(video.costUsd, 7.68);
  assertEquals([video.renderP50Seconds, video.renderP95Seconds], [75, 140]);

  const image = summary.rows.find((r) => r.mediaType === 'image')!;
  assertEquals([image.resolution, image.credits, image.renderP50Seconds], [null, 117, null]);

  assertEquals(summary.failureReasons, [
    { code: 'safety_blocked', count: 1 },
    { code: 'invalid_output', count: 1 },
  ]);
  assertEquals(summary.unbilledCompleted, 1);
});

Deno.test('summarizeMarketingGenerations: no finished jobs means 0% rather than NaN', () => {
  const summary = summarizeMarketingGenerations([rollup({ job_status: 'pending', jobs: 2 })]);
  assertEquals(summary.rows[0].successRatePct, 0);
});
