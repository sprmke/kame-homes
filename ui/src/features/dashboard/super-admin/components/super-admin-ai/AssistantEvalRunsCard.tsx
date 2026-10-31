import type { AssistantEvalRun } from '@/features/dashboard/super-admin/hooks/useSuperAdminAiUsage';

import { AdminSurfaceCardHeader } from '@/components/shared/AdminSurfaceCardHeader';
import { cn } from '@/lib/utils';

const pct = (passed: number, total: number) => Math.round((passed / total) * 100);

function formatRunDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
  });
}

/** Per-module pass rates of the latest assistant golden eval run, plus recent run history. */
export function AssistantEvalRunsCard({ runs }: { runs: AssistantEvalRun[] }) {
  const [latest, ...previous] = runs;
  return (
    <section className="surface-card min-w-0 p-3 sm:p-4" aria-label="Assistant evals">
      <AdminSurfaceCardHeader title="Assistant evals" />
      {/* In the body, not the header description: that is hidden on phones and this is data. */}
      <p className="text-muted-foreground mt-1 text-xs tabular-nums">
        {latest
          ? [
              `${latest.passed}/${latest.total} passed`,
              latest.routed ? 'routed' : 'all tools',
              latest.avgToolsSent != null ? `${latest.avgToolsSent} tools per turn` : null,
              formatRunDate(latest.createdAt),
            ]
              .filter(Boolean)
              .join(' · ')
          : 'No recorded runs yet'}
      </p>
      {latest ? (
        <>
          <ul className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {latest.modules.map((m) => {
              const rate = pct(m.passed, m.total);
              return (
                <li key={m.module} className="min-w-0">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate capitalize">{m.module}</span>
                    <span className="text-muted-foreground shrink-0 tabular-nums">
                      {m.passed}/{m.total}
                    </span>
                  </div>
                  <div className="bg-muted mt-1 h-1.5 overflow-hidden rounded-full">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        rate === 100
                          ? 'bg-emerald-500'
                          : rate >= 80
                            ? 'bg-amber-500'
                            : 'bg-destructive'
                      )}
                      style={{ width: `${rate}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          {latest.failedCaseIds.length > 0 ? (
            <p className="text-muted-foreground mt-3 break-words text-xs">
              Failed: {latest.failedCaseIds.join(', ')}
            </p>
          ) : null}
          {previous.length > 0 ? (
            <ul className="divide-border/60 mt-3 divide-y border-t text-xs">
              {previous.map((run) => (
                <li key={run.id} className="text-muted-foreground flex items-center gap-3 py-1.5">
                  <span className="w-14 shrink-0 tabular-nums">{formatRunDate(run.createdAt)}</span>
                  <span className="flex-1 tabular-nums">
                    {pct(run.passed, run.total)}% ({run.passed}/{run.total})
                  </span>
                  <span className="shrink-0">{run.routed ? 'routed' : 'all tools'}</span>
                  {run.promptVersion ? (
                    <span className="hidden shrink-0 tabular-nums sm:inline">
                      {run.promptVersion}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
