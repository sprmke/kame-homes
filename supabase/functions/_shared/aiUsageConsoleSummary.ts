/**
 * Pure aggregations for the super-admin AI usage console (`super-admin-ai-usage`):
 * usage by plan and Marketing Studio generation outcomes. Read-only, no I/O.
 */

export type ConsoleUsageEvent = {
  organization_id: string | null;
  status: string | null;
  estimated_cost_usd: number | string | null;
  credits_consumed: number | string | null;
};

export type ConsolePlan = {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  isDefault: boolean;
  monthlyCreditAllowance: number;
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

const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

/**
 * One row per plan. Orgs without a live subscription count under the default plan.
 * `monthCreditsByOrg` is this calendar month's credits (allowance usage).
 */
export function summarizeUsageByPlan(input: {
  plans: ConsolePlan[];
  orgIds: string[];
  planIdByOrg: Map<string, string>;
  events: ConsoleUsageEvent[];
  monthCreditsByOrg: Map<string, number>;
}): PlanUsageRow[] {
  const defaultPlan = input.plans.find((p) => p.isDefault) ?? null;
  const planById = new Map(input.plans.map((p) => [p.id, p]));
  const planFor = (orgId: string): ConsolePlan | null =>
    planById.get(input.planIdByOrg.get(orgId) ?? '') ?? defaultPlan;

  type Bucket = PlanUsageRow & { active: Set<string>; sortOrder: number };
  const buckets = new Map<string, Bucket>();
  const bucketFor = (plan: ConsolePlan): Bucket => {
    let b = buckets.get(plan.id);
    if (!b) {
      b = {
        planCode: plan.code,
        planName: plan.name,
        orgCount: 0,
        activeOrgs: 0,
        calls: 0,
        credits: 0,
        costUsd: 0,
        creditAllowancePerOrg: plan.monthlyCreditAllowance,
        monthCredits: 0,
        orgsAtAllowance: 0,
        active: new Set(),
        sortOrder: plan.sortOrder,
      };
      buckets.set(plan.id, b);
    }
    return b;
  };

  for (const plan of input.plans) bucketFor(plan);
  for (const orgId of input.orgIds) {
    const plan = planFor(orgId);
    if (!plan) continue;
    const b = bucketFor(plan);
    b.orgCount += 1;
    const month = input.monthCreditsByOrg.get(orgId) ?? 0;
    b.monthCredits += month;
    if (plan.monthlyCreditAllowance > 0 && month >= plan.monthlyCreditAllowance) {
      b.orgsAtAllowance += 1;
    }
  }
  for (const ev of input.events) {
    if (!ev.organization_id || ev.status === 'error') continue;
    const plan = planFor(ev.organization_id);
    if (!plan) continue;
    const b = bucketFor(plan);
    b.calls += 1;
    b.credits += Number(ev.credits_consumed ?? 0);
    b.costUsd += Number(ev.estimated_cost_usd ?? 0);
    b.active.add(ev.organization_id);
  }

  return Array.from(buckets.values())
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(({ active, sortOrder: _sortOrder, ...row }) => ({
      ...row,
      activeOrgs: active.size,
      costUsd: round4(row.costUsd),
    }));
}

export type ConsoleGenerationJob = {
  media_type: string;
  quality_tier: string | null;
  resolution: string | null;
  job_status: string;
  error_code: string | null;
  credits_consumed: number | null;
  estimated_cost_usd: number | string | null;
  usage_recorded_at: string | null;
  created_at: string;
  completed_at: string | null;
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
  /** Completed over 10 minutes ago with no usage stamp: the sweeper still owes a charge. */
  unbilledCompleted: number;
};

const IN_FLIGHT = new Set(['pending', 'processing', 'finalizing']);
const UNBILLED_GRACE_MS = 10 * 60_000;

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

export function summarizeMarketingGenerations(
  jobs: ConsoleGenerationJob[],
  now: Date = new Date()
): GenerationSummary {
  type Bucket = Omit<
    GenerationOutcomeRow,
    'successRatePct' | 'renderP50Seconds' | 'renderP95Seconds'
  > & {
    renders: number[];
  };
  const buckets = new Map<string, Bucket>();
  const reasons = new Map<string, number>();
  let unbilledCompleted = 0;

  for (const job of jobs) {
    const mediaType = job.media_type === 'video' ? 'video' : 'image';
    const qualityTier = job.quality_tier ?? 'standard';
    const resolution = mediaType === 'video' ? (job.resolution ?? null) : null;
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
        credits: 0,
        costUsd: 0,
        renders: [],
      };
      buckets.set(key, b);
    }
    b.total += 1;

    if (job.job_status === 'completed') {
      b.completed += 1;
      b.credits += Number(job.credits_consumed ?? 0);
      b.costUsd += Number(job.estimated_cost_usd ?? 0);
      if (job.completed_at) {
        const seconds = (Date.parse(job.completed_at) - Date.parse(job.created_at)) / 1000;
        if (Number.isFinite(seconds) && seconds >= 0) b.renders.push(seconds);
        if (
          !job.usage_recorded_at &&
          now.getTime() - Date.parse(job.completed_at) > UNBILLED_GRACE_MS
        ) {
          unbilledCompleted += 1;
        }
      }
    } else if (job.job_status === 'failed') {
      if (job.error_code === 'safety_blocked') b.blocked += 1;
      else b.failed += 1;
      const code = job.error_code || 'unknown';
      reasons.set(code, (reasons.get(code) ?? 0) + 1);
    } else if (job.job_status === 'cancelled') {
      b.cancelled += 1;
    } else if (IN_FLIGHT.has(job.job_status)) {
      b.inFlight += 1;
    }
  }

  const rows = Array.from(buckets.values())
    .map(({ renders, ...b }) => {
      const sorted = [...renders].sort((x, y) => x - y);
      const finished = b.completed + b.failed + b.blocked;
      const p50 = percentile(sorted, 0.5);
      const p95 = percentile(sorted, 0.95);
      return {
        ...b,
        successRatePct: finished === 0 ? 0 : Math.round((b.completed / finished) * 1000) / 10,
        costUsd: round4(b.costUsd),
        renderP50Seconds: p50 == null ? null : Math.round(p50),
        renderP95Seconds: p95 == null ? null : Math.round(p95),
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
