import type {
  AssistantLatency,
  AssistantLatencyBucket,
} from '@/features/dashboard/super-admin/hooks/useSuperAdminAiUsage';

import { AdminSurfaceCardHeader } from '@/components/shared/AdminSurfaceCardHeader';
import { cn } from '@/lib/utils';

/** Plan budget for a Tier-0 single-tool turn (section H of the AI companion plan). */
const P95_BUDGET_MS = 9_000;

function formatMs(ms: number | null): string {
  if (ms == null) return '-';
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}

const GUARD_MODE_LABEL: Record<string, string> = {
  llm: 'Reviewer call',
  deterministic: 'Deterministic',
  blocked: 'Blocked by scan',
  none: 'No text to guard',
  unknown: 'Unknown',
};

function LatencyRows({
  buckets,
  labelFor,
}: {
  buckets: AssistantLatencyBucket[];
  labelFor?: (key: string) => string;
}) {
  return (
    <ul className="divide-border/60 mt-2 divide-y text-sm">
      {buckets.map((bucket) => {
        const overBudget = bucket.p95Ms != null && bucket.p95Ms > P95_BUDGET_MS;
        return (
          <li key={bucket.key} className="flex min-w-0 items-center gap-3 py-1.5">
            <span className="min-w-0 flex-1 truncate capitalize">
              {labelFor ? labelFor(bucket.key) : bucket.key}
            </span>
            <span className="text-muted-foreground w-10 shrink-0 text-right text-xs tabular-nums">
              {bucket.turns}
            </span>
            <span className="w-14 shrink-0 text-right tabular-nums">{formatMs(bucket.p50Ms)}</span>
            <span
              className={cn(
                'w-14 shrink-0 text-right tabular-nums',
                overBudget ? 'text-destructive' : 'text-muted-foreground'
              )}
            >
              {formatMs(bucket.p95Ms)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Turn latency p50/p95 per router module and the guard-mode split (AI Usage tab). */
export function AssistantLatencyCard({ latency }: { latency: AssistantLatency }) {
  const header = (
    <div className="text-muted-foreground mt-3 flex items-center gap-3 text-xs">
      <span className="flex-1">Module</span>
      <span className="w-10 text-right">Turns</span>
      <span className="w-14 text-right">p50</span>
      <span className="w-14 text-right">p95</span>
    </div>
  );
  return (
    <section className="surface-card min-w-0 p-3 sm:p-4" aria-label="Assistant latency">
      <AdminSurfaceCardHeader title="Assistant latency" />
      <p className="text-muted-foreground mt-1 text-xs tabular-nums">
        {latency.turns > 0 ? `${latency.turns} turns` : 'No timed turns yet'}
      </p>
      {latency.byModule.length > 0 ? (
        <>
          {header}
          <LatencyRows buckets={latency.byModule} />
        </>
      ) : null}
      {latency.byGuardMode.length > 0 ? (
        <>
          <div className="text-muted-foreground mt-4 flex items-center gap-3 text-xs">
            <span className="flex-1">Guard</span>
            <span className="w-10 text-right">Turns</span>
            <span className="w-14 text-right">p50</span>
            <span className="w-14 text-right">p95</span>
          </div>
          <LatencyRows
            buckets={latency.byGuardMode}
            labelFor={(key) => GUARD_MODE_LABEL[key] ?? key}
          />
        </>
      ) : null}
    </section>
  );
}
