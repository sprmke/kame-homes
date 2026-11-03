/**
 * Shapes the Phase 7 "Telemetry" rollups (migration 20261318000000) for the AI Usage tab: rounds
 * and credits distribution per turn, Phase 3 plan size + approval outcome, Phase 3 step-failure
 * rate, and Phase 2 completion-check misses.
 * Mirror of the response type: ui/.../super-admin/hooks/useSuperAdminAiUsage.ts#AssistantTurnTelemetry.
 */

export type TurnTelemetryRow = {
  turns: number | string;
  avg_rounds: number | string | null;
  p50_rounds: number | string | null;
  p95_rounds: number | string | null;
  turns_with_plan: number | string;
  avg_plan_size: number | string | null;
  completion_miss_turns: number | string;
  avg_credits: number | string | null;
  p50_credits: number | string | null;
  p95_credits: number | string | null;
};

export type PlanOutcomeRow = {
  status: string;
  plans: number | string;
  total_steps: number | string;
  failed_steps: number | string;
};

export type PlanOutcomeBucket = {
  status: string;
  plans: number;
  /** Share of this range's plans (0-100), rounded to 1 decimal. */
  pct: number;
  totalSteps: number;
  failedSteps: number;
};

export type AssistantTurnTelemetry = {
  turns: number;
  avgRounds: number | null;
  p50Rounds: number | null;
  p95Rounds: number | null;
  /** Of `turns`, how many proposed a Phase 3 action plan. */
  turnsWithPlan: number;
  avgPlanSize: number | null;
  completionMissTurns: number;
  completionMissRatePct: number | null;
  avgCredits: number | null;
  p50Credits: number | null;
  p95Credits: number | null;
  planOutcomes: PlanOutcomeBucket[];
  totalPlans: number;
  /** Approved (completed/partially_failed/still running) over every decided plan — excludes
   * `proposed`/`expired`, which were never actually decided by the host. */
  approvalRatePct: number | null;
  cancelledRatePct: number | null;
  /** Failed steps over every step that actually ran (executed or failed — never denied/skipped). */
  stepFailureRatePct: number | null;
};

/** A plan the host explicitly approved, whatever its execution outcome ended up being. */
const APPROVED_STATUSES = new Set(['approved', 'running', 'completed', 'partially_failed']);

const num = (value: unknown): number | null => {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};
const round1 = (n: number): number => Math.round(n * 10) / 10;
const pct = (part: number, whole: number): number | null =>
  whole === 0 ? null : round1((part / whole) * 100);

export function summarizeAssistantTurnTelemetry(
  turnRows: readonly TurnTelemetryRow[],
  planRows: readonly PlanOutcomeRow[]
): AssistantTurnTelemetry {
  const row = turnRows[0];
  const turns = num(row?.turns) ?? 0;
  const completionMissTurns = num(row?.completion_miss_turns) ?? 0;
  const avgPlanSizeRaw = num(row?.avg_plan_size);

  const planOutcomes: PlanOutcomeBucket[] = planRows
    .filter((r) => r.status)
    .map((r) => ({
      status: r.status,
      plans: num(r.plans) ?? 0,
      totalSteps: num(r.total_steps) ?? 0,
      failedSteps: num(r.failed_steps) ?? 0,
      pct: 0,
    }))
    .sort((a, b) => b.plans - a.plans);

  const totalPlans = planOutcomes.reduce((sum, bucket) => sum + bucket.plans, 0);
  for (const bucket of planOutcomes) {
    bucket.pct = pct(bucket.plans, totalPlans) ?? 0;
  }

  const approvedPlans = planOutcomes
    .filter((bucket) => APPROVED_STATUSES.has(bucket.status))
    .reduce((sum, bucket) => sum + bucket.plans, 0);
  const cancelledPlans = planOutcomes
    .filter((bucket) => bucket.status === 'cancelled')
    .reduce((sum, bucket) => sum + bucket.plans, 0);
  const decidedPlans = approvedPlans + cancelledPlans;

  const totalSteps = planOutcomes.reduce((sum, bucket) => sum + bucket.totalSteps, 0);
  const failedSteps = planOutcomes.reduce((sum, bucket) => sum + bucket.failedSteps, 0);

  return {
    turns,
    avgRounds: num(row?.avg_rounds),
    p50Rounds: num(row?.p50_rounds),
    p95Rounds: num(row?.p95_rounds),
    turnsWithPlan: num(row?.turns_with_plan) ?? 0,
    avgPlanSize: avgPlanSizeRaw == null ? null : round1(avgPlanSizeRaw),
    completionMissTurns,
    completionMissRatePct: pct(completionMissTurns, turns),
    avgCredits: num(row?.avg_credits) == null ? null : round1(num(row?.avg_credits) ?? 0),
    p50Credits: num(row?.p50_credits),
    p95Credits: num(row?.p95_credits),
    planOutcomes,
    totalPlans,
    approvalRatePct: pct(approvedPlans, decidedPlans),
    cancelledRatePct: pct(cancelledPlans, decidedPlans),
    stepFailureRatePct: pct(failedSteps, totalSteps),
  };
}
