import type { AssistantTurnTelemetry } from '@/features/dashboard/super-admin/hooks/useSuperAdminAiUsage';

import { AdminSurfaceCardHeader } from '@/components/shared/AdminSurfaceCardHeader';
import { cn } from '@/lib/utils';

const PLAN_STATUS_LABEL: Record<string, string> = {
  proposed: 'Awaiting review',
  approved: 'Approved',
  running: 'Running',
  completed: 'Completed',
  partially_failed: 'Partially failed',
  cancelled: 'Cancelled',
  expired: 'Expired',
};

/** Below this, a completion-check-miss or step-failure rate isn't flagged as a problem. */
const MISS_RATE_FLAG_PCT = 10;

function formatNum(value: number | null, digits = 0): string {
  if (value == null) return '-';
  return value.toFixed(digits);
}

function formatPct(value: number | null): string {
  return value == null ? '-' : `${value.toFixed(0)}%`;
}

function planBarClassName(status: string): string {
  if (status === 'completed') return 'bg-emerald-500';
  if (status === 'partially_failed') return 'bg-amber-500';
  if (status === 'cancelled' || status === 'expired') return 'bg-muted-foreground/40';
  return 'bg-sky-500';
}

/**
 * Phase 7 telemetry: rounds and credits per turn, Phase 3 plan size + approval outcome, Phase 3
 * step-failure rate, and Phase 2 completion-check misses (AI Usage tab, next to Assistant
 * latency). Read-only observability — no mutating capability, nothing to approve or edit here.
 */
export function AssistantTurnTelemetryCard({ telemetry }: { telemetry: AssistantTurnTelemetry }) {
  const missRateFlagged =
    telemetry.completionMissRatePct != null && telemetry.completionMissRatePct > MISS_RATE_FLAG_PCT;
  const stepFailureFlagged =
    telemetry.stepFailureRatePct != null && telemetry.stepFailureRatePct > MISS_RATE_FLAG_PCT;

  return (
    <section className="surface-card min-w-0 p-3 sm:p-4" aria-label="Assistant turn telemetry">
      <AdminSurfaceCardHeader title="Assistant telemetry" />
      <p className="text-muted-foreground mt-1 text-xs tabular-nums">
        {telemetry.turns > 0 ? `${telemetry.turns} turns` : 'No timed turns yet'}
      </p>

      {telemetry.turns > 0 ? (
        <ul className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          <li className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">Rounds / turn</span>
            <span className="tabular-nums">
              avg {formatNum(telemetry.avgRounds, 1)} &middot; p95 {formatNum(telemetry.p95Rounds)}
            </span>
          </li>
          <li className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">Credits / turn</span>
            <span className="tabular-nums">
              avg {formatNum(telemetry.avgCredits, 1)} &middot; p95{' '}
              {formatNum(telemetry.p95Credits)}
            </span>
          </li>
          <li className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">Plan size when proposed</span>
            <span className="tabular-nums">
              {telemetry.turnsWithPlan > 0
                ? `avg ${formatNum(telemetry.avgPlanSize, 1)} steps (${telemetry.turnsWithPlan})`
                : '-'}
            </span>
          </li>
          <li className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">Completion-check misses</span>
            <span className={cn('tabular-nums', missRateFlagged ? 'text-destructive' : undefined)}>
              {telemetry.completionMissTurns} ({formatPct(telemetry.completionMissRatePct)})
            </span>
          </li>
        </ul>
      ) : null}

      {telemetry.totalPlans > 0 ? (
        <>
          <div className="text-muted-foreground mt-4 flex items-center gap-3 text-xs">
            <span className="flex-1">Plan outcome</span>
            <span className="w-20 text-right">Plans</span>
          </div>
          <ul className="mt-2 space-y-2">
            {telemetry.planOutcomes.map((outcome) => (
              <li key={outcome.status} className="min-w-0">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">
                    {PLAN_STATUS_LABEL[outcome.status] ?? outcome.status}
                  </span>
                  <span className="text-muted-foreground w-20 shrink-0 text-right tabular-nums">
                    {outcome.plans} ({outcome.pct.toFixed(0)}%)
                  </span>
                </div>
                <div className="bg-muted mt-1 h-1.5 overflow-hidden rounded-full">
                  <div
                    className={cn('h-full rounded-full', planBarClassName(outcome.status))}
                    style={{ width: `${Math.max(outcome.pct, 2)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground mt-3 text-xs tabular-nums">
            {telemetry.approvalRatePct != null
              ? `${formatPct(telemetry.approvalRatePct)} approval rate`
              : 'No decided plans yet'}
            {telemetry.stepFailureRatePct != null ? (
              <>
                {' '}
                &middot;{' '}
                <span className={stepFailureFlagged ? 'text-destructive' : undefined}>
                  {formatPct(telemetry.stepFailureRatePct)} step failure rate
                </span>
              </>
            ) : null}
          </p>
        </>
      ) : null}
    </section>
  );
}
