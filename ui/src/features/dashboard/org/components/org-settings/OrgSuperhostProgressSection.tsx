import { AlertCircle, Award, CheckCircle2, Circle } from 'lucide-react';

import { AdminSection } from '@/features/dashboard/bookings/components/AdminSectionNavLayout';
import { useOrgSuperhostProgress } from '@/features/dashboard/org/hooks/useOrgSuperhostProgress';
import type { OrgSuperhostCriterionSnapshot } from '@/features/dashboard/org/lib/orgSuperhost';
import {
  countMetCriteria,
  formatSuperhostAssessmentDate,
  getSuperhostCriterionDisplay,
  getSuperhostOverallState,
  SUPERHOST_CRITERION_HELP,
  SUPERHOST_CRITERION_LABELS,
  SUPERHOST_SECTION_HELP,
  type OrgSuperhostCriterionKey,
  type SuperhostCriterionOutcome,
  type SuperhostOverallState,
} from '@/features/dashboard/org/lib/orgSuperhostDisplay';

import { FieldHelpTooltip } from '@/components/forms/FieldLabel';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const CRITERION_KEYS = Object.keys(SUPERHOST_CRITERION_LABELS) as OrgSuperhostCriterionKey[];
const TOTAL_GOALS = CRITERION_KEYS.length;

function CriterionStatusIcon({ outcome }: { outcome: SuperhostCriterionOutcome }) {
  if (outcome === 'met') {
    return <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden />;
  }
  if (outcome === 'needs_work') {
    return <AlertCircle className="size-4 shrink-0 text-amber-600" aria-hidden />;
  }
  return <Circle className="text-muted-foreground size-4 shrink-0" aria-hidden />;
}

function CriterionRow({
  criterionKey,
  row,
}: {
  criterionKey: OrgSuperhostCriterionKey;
  row: OrgSuperhostCriterionSnapshot;
}) {
  const label = SUPERHOST_CRITERION_LABELS[criterionKey];
  const help = SUPERHOST_CRITERION_HELP[criterionKey];
  const display = getSuperhostCriterionDisplay(criterionKey, row);

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 border-b px-3 py-3 last:border-b-0',
        display.outcome === 'met' && 'bg-emerald-500/[0.04]',
        display.outcome === 'needs_work' && 'bg-amber-500/[0.04]'
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <CriterionStatusIcon outcome={display.outcome} />
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-1">
            <p className="text-sm font-medium">{label}</p>
            <FieldHelpTooltip label={label} help={help} />
          </div>
          <p className="text-muted-foreground mt-0.5 text-xs">{display.summary}</p>
        </div>
      </div>
      <span
        className={cn(
          'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums',
          display.outcome === 'met' && 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300',
          display.outcome === 'needs_work' && 'bg-amber-500/15 text-amber-900 dark:text-amber-300',
          display.outcome === 'building' && 'bg-muted text-muted-foreground'
        )}
      >
        {display.outcomeLabel}
      </span>
    </div>
  );
}

function SuperhostStatusBanner({
  state,
  metCount,
  nextCheckLabel,
}: {
  state: SuperhostOverallState;
  metCount: number;
  nextCheckLabel: string;
}) {
  if (state === 'earned') {
    return (
      <div
        className="flex gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3.5 py-3"
        role="status"
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white">
          <Award className="size-4" aria-hidden />
        </div>
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
            You&apos;re a Superhost
          </p>
          <p className="text-muted-foreground text-xs">
            Guests see your badge on listings. Next check · {nextCheckLabel}
          </p>
        </div>
      </div>
    );
  }

  if (state === 'ready') {
    return (
      <div
        className="border-primary/20 bg-primary/5 flex gap-3 rounded-xl border px-3.5 py-3"
        role="status"
      >
        <div className="bg-primary text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-full">
          <CheckCircle2 className="size-4" aria-hidden />
        </div>
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-semibold">Ready for the next check</p>
          <p className="text-muted-foreground text-xs">
            All {TOTAL_GOALS} goals met. Badge updates on {nextCheckLabel}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-muted/40 flex gap-3 rounded-xl border px-3.5 py-3" role="status">
      <div className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-full">
        <Award className="size-4" aria-hidden />
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="space-y-0.5">
          <p className="text-sm font-semibold">Not a Superhost yet</p>
          <p className="text-muted-foreground text-xs">
            {metCount} of {TOTAL_GOALS} goals met. Next check · {nextCheckLabel}
          </p>
        </div>
        <div
          className="bg-muted h-1.5 overflow-hidden rounded-full"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={TOTAL_GOALS}
          aria-valuenow={metCount}
          aria-label={`${metCount} of ${TOTAL_GOALS} Superhost goals met`}
        >
          <div
            className="bg-primary h-full rounded-full transition-[width] duration-300 ease-out"
            style={{ width: `${(metCount / TOTAL_GOALS) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function OrgSuperhostProgressSection() {
  const { data, isLoading, isError } = useOrgSuperhostProgress();

  return (
    <AdminSection id="superhost" title="Superhost" icon={Award} titleHelp={SUPERHOST_SECTION_HELP}>
      {isLoading ? (
        <div className="space-y-4" role="status" aria-live="polite" aria-label="Loading Superhost">
          <Skeleton className="h-[4.5rem] w-full rounded-xl" aria-hidden />
          <div className="border-border overflow-hidden rounded-lg border" aria-hidden>
            {CRITERION_KEYS.map((key) => (
              <div
                key={key}
                className="border-border flex items-start gap-2.5 border-b px-3 py-3 last:border-b-0"
              >
                <Skeleton className="mt-0.5 size-4 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-48 max-w-full" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ) : isError || !data ? (
        <p className="text-destructive text-sm">Could not load Superhost progress.</p>
      ) : (
        <div className="space-y-4">
          <SuperhostStatusBanner
            state={getSuperhostOverallState({
              earned: data.earned,
              allCriteriaMet: data.allCriteriaMet,
            })}
            metCount={countMetCriteria(data.criteria)}
            nextCheckLabel={formatSuperhostAssessmentDate(data.nextAssessmentAt)}
          />

          <div className="border-border overflow-hidden rounded-lg border">
            {CRITERION_KEYS.map((key) => (
              <CriterionRow key={key} criterionKey={key} row={data.criteria[key]} />
            ))}
          </div>
        </div>
      )}
    </AdminSection>
  );
}
