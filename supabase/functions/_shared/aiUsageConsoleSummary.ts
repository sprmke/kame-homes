/**
 * Shapes the SQL rollups behind the super-admin AI usage console (`super-admin-ai-usage`;
 * functions in migration 20261316126700_super_admin_ai_usage_rollups.sql) into the
 * response: usage by plan and Marketing Studio job outcomes. Pure, no I/O.
 */

type Numeric = number | string | null;

const num = (value: Numeric | undefined): number => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

export type ConsolePlan = {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  monthlyCreditAllowance: number;
};

/** One row of `super_admin_ai_usage_by_plan`. */
export type PlanRollupRow = {
  plan_id: string;
  org_count: Numeric;
  active_orgs: Numeric;
  calls: Numeric;
  credits: Numeric;
  cost_usd: Numeric;
  month_credits: Numeric;
  orgs_at_allowance: Numeric;
};

export type PlanUsageRow = {
  planCode: string;
  planName: string;
  orgCount: number;
  activeOrgs: number;
  calls: number;
  credits: number;
  costUsd: number;
  creditAllowancePerOrg: number;
  monthCredits: number;
  orgsAtAllowance: number;
};

/** Every active plan in sort order, zero-filled when no org is on it. */
export function summarizeUsageByPlan(
  plans: ConsolePlan[],
  rollup: PlanRollupRow[]
): PlanUsageRow[] {
  const byPlan = new Map(rollup.map((r) => [r.plan_id, r]));
  return [...plans]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((plan) => {
      const r = byPlan.get(plan.id);
      return {
        planCode: plan.code,
        planName: plan.name,
        orgCount: num(r?.org_count),
        activeOrgs: num(r?.active_orgs),
        calls: num(r?.calls),
        credits: Math.round(num(r?.credits)),
        costUsd: round4(num(r?.cost_usd)),
        creditAllowancePerOrg: plan.monthlyCreditAllowance,
        monthCredits: Math.round(num(r?.month_credits)),
        orgsAtAllowance: num(r?.orgs_at_allowance),
      };
    });
}

/** One row of `super_admin_marketing_generation_rollup`. */
export type GenerationRollupRow = {
  media_type: string;
  quality_tier: string | null;
  resolution: string | null;
  job_status: string;
  error_code: string | null;
  jobs: Numeric;
  credits: Numeric;
  cost_usd: Numeric;
  render_p50_seconds: Numeric;
  render_p95_seconds: Numeric;
  unbilled: Numeric;
};

export type GenerationOutcomeRow = {
  mediaType: 'image' | 'video';
  qualityTier: string;
  resolution: string | null;
  total: number;
  completed: number;
  failed: number;
  blocked: number;
  cancelled: number;
  inFlight: number;
  successRatePct: number;
  credits: number;
  costUsd: number;
  renderP50Seconds: number | null;
  renderP95Seconds: number | null;
};

export type GenerationSummary = {
  rows: GenerationOutcomeRow[];
  failureReasons: Array<{ code: string; count: number }>;
  /** Completed over 10 minutes ago and still not charged; the sweeper owes a charge. */
  unbilledCompleted: number;
};

const IN_FLIGHT = new Set(['pending', 'processing', 'finalizing']);

/** Credits and spend count completed jobs only; failures are never charged to the host. */
export function summarizeMarketingGenerations(rollup: GenerationRollupRow[]): GenerationSummary {
  const buckets = new Map<string, GenerationOutcomeRow>();
  const reasons = new Map<string, number>();
  let unbilledCompleted = 0;

  for (const r of rollup) {
    const mediaType = r.media_type === 'video' ? 'video' : 'image';
    const qualityTier = r.quality_tier ?? 'standard';
    const resolution = mediaType === 'video' ? (r.resolution ?? null) : null;
    const key = `${mediaType}|${qualityTier}|${resolution ?? ''}`;
    let b = buckets.get(key);
    if (!b) {
      b = {
        mediaType,
        qualityTier,
        resolution,
        total: 0,
        completed: 0,
        failed: 0,
        blocked: 0,
        cancelled: 0,
        inFlight: 0,
        successRatePct: 0,
        credits: 0,
        costUsd: 0,
        renderP50Seconds: null,
        renderP95Seconds: null,
      };
      buckets.set(key, b);
    }
    const jobs = num(r.jobs);
    b.total += jobs;

    if (r.job_status === 'completed') {
      b.completed += jobs;
      b.credits += Math.round(num(r.credits));
      b.costUsd += num(r.cost_usd);
      b.renderP50Seconds = r.render_p50_seconds == null ? null : num(r.render_p50_seconds);
      b.renderP95Seconds = r.render_p95_seconds == null ? null : num(r.render_p95_seconds);
      unbilledCompleted += num(r.unbilled);
    } else if (r.job_status === 'failed') {
      if (r.error_code === 'safety_blocked') b.blocked += jobs;
      else b.failed += jobs;
      const code = r.error_code || 'unknown';
      reasons.set(code, (reasons.get(code) ?? 0) + jobs);
    } else if (r.job_status === 'cancelled') {
      b.cancelled += jobs;
    } else if (IN_FLIGHT.has(r.job_status)) {
      b.inFlight += jobs;
    }
  }

  const rows = Array.from(buckets.values())
    .map((b) => {
      const finished = b.completed + b.failed + b.blocked;
      return {
        ...b,
        successRatePct: finished === 0 ? 0 : Math.round((b.completed / finished) * 1000) / 10,
        costUsd: round4(b.costUsd),
      };
    })
    .sort((a, b) => b.total - a.total);

  return {
    rows,
    failureReasons: Array.from(reasons.entries())
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count),
    unbilledCompleted,
  };
}
