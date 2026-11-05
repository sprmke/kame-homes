import { AdminMetricCardSkeleton } from '@/features/dashboard/bookings/components/AdminMetricCard';
import {
  KANBAN_STATUS_CONFIG,
  STAGE_META,
  STATUS_LEGEND_GROUPS,
  type BookingStage,
} from '@/features/dashboard/bookings/lib/bookingStages';
import type { BookingStatus } from '@/features/dashboard/bookings/lib/bookingStatus';

import { Skeleton } from '@/components/ui/skeleton';

const CARD_STAGES = [
  'action_required',
  'pending_docs',
  'confirmed',
  'history',
] as const satisfies readonly Exclude<BookingStage, 'all'>[];

const STAGE_ICON_STYLES = {
  action_required: {
    iconClassName: 'text-red-600 dark:text-red-400',
    iconBgClassName: 'bg-red-100 dark:bg-red-900/30',
  },
  pending_docs: {
    iconClassName: 'text-amber-600 dark:text-amber-400',
    iconBgClassName: 'bg-amber-100 dark:bg-amber-900/30',
  },
  confirmed: {
    iconClassName: 'text-emerald-600 dark:text-emerald-400',
    iconBgClassName: 'bg-emerald-100 dark:bg-emerald-900/30',
  },
  history: {
    iconClassName: 'text-muted-foreground',
    iconBgClassName: 'bg-muted/60 dark:bg-muted/40',
  },
} as const;

function statusesForStage(stage: Exclude<BookingStage, 'all'>): readonly BookingStatus[] {
  const group = STATUS_LEGEND_GROUPS.find((entry) => entry.stage === stage);
  if (!group) return [];
  return group.statuses.filter((status) => status !== 'PENDING_DOCUMENTS');
}

function StatusFooter({ statuses }: { statuses: readonly BookingStatus[] }) {
  if (statuses.length === 0) return null;
  return (
    <div className="flex w-full flex-wrap content-start items-start gap-1 max-lg:hidden">
      {statuses.map((status) => (
        <span
          key={status}
          className="border-border/60 bg-muted/30 text-muted-foreground inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-[11px] font-medium"
        >
          {KANBAN_STATUS_CONFIG[status].shortLabel}
        </span>
      ))}
    </div>
  );
}

/** Matches `BookingsSummaryCards` four stage cards. */
export function BookingsStageSummarySkeleton({
  stageLabels,
  hideStatusFooter = false,
}: {
  stageLabels?: Partial<Record<Exclude<BookingStage, 'all'>, string>>;
  hideStatusFooter?: boolean;
} = {}) {
  return (
    <div
      role="status"
      className="grid grid-cols-2 items-start gap-2.5 sm:gap-3 lg:grid-cols-4 lg:gap-4"
      aria-busy="true"
      aria-label="Loading summary"
    >
      {CARD_STAGES.map((stage, index) => {
        const meta = STAGE_META[stage];
        const styles = STAGE_ICON_STYLES[stage];
        return (
          <AdminMetricCardSkeleton
            key={stage}
            title={stageLabels?.[stage] ?? meta.label}
            icon={meta.icon}
            iconClassName={styles.iconClassName}
            iconBgClassName={styles.iconBgClassName}
            titleAdornment={<span aria-hidden className="-my-1 size-6 shrink-0" />}
            footer={
              hideStatusFooter ? undefined : <StatusFooter statuses={statusesForStage(stage)} />
            }
            style={{ opacity: 1 - index * 0.05 }}
          />
        );
      })}
    </div>
  );
}

/** Horizontal kanban columns with card stacks (phone scrolls). */
export function BookingsKanbanSkeleton() {
  return (
    <div
      role="status"
      className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-busy="true"
      aria-label="Loading board"
    >
      {Array.from({ length: 5 }).map((_, col) => (
        <div
          key={col}
          className="flex w-[min(100%,17rem)] shrink-0 flex-col gap-2 sm:w-[17rem]"
          style={{ opacity: 1 - col * 0.06 }}
        >
          <div className="flex items-center justify-between gap-2 px-0.5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-5 w-6 rounded-full" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: col % 2 === 0 ? 2 : 1 }).map((__, row) => (
              <div key={row} className="surface-card space-y-2 p-3">
                <Skeleton className="h-5 w-20 rounded-md" />
                <div className="flex items-center gap-2">
                  <Skeleton className="size-9 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-2.5 w-2/3" />
                  </div>
                </div>
                <Skeleton className="h-3 w-3/4" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
