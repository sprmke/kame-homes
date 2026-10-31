import { AdminMetricCard } from '@/features/dashboard/bookings/components/AdminMetricCard';
import {
  KANBAN_STATUS_CONFIG,
  STAGE_META,
  STATUS_LEGEND_GROUPS,
  type BookingStage,
} from '@/features/dashboard/bookings/lib/bookingStages';
import type { BookingStatus } from '@/features/dashboard/bookings/lib/bookingStatus';

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
} as const satisfies Record<
  Exclude<BookingStage, 'all'>,
  { iconClassName: string; iconBgClassName: string }
>;

type Props = {
  counts: Record<Exclude<BookingStage, 'all'>, number>;
  activeStage: BookingStage;
  onStageChange: (stage: BookingStage) => void;
  /** Override card titles (e.g. parking reservations). */
  stageLabels?: Partial<Record<Exclude<BookingStage, 'all'>, string>>;
  hideStatusFooter?: boolean;
};

const CARD_STAGES = [
  'action_required',
  'pending_docs',
  'confirmed',
  'history',
] as const satisfies readonly Exclude<BookingStage, 'all'>[];

function statusesForSummaryCard(stage: Exclude<BookingStage, 'all'>): readonly BookingStatus[] {
  const group = STATUS_LEGEND_GROUPS.find((g) => g.stage === stage);
  if (!group) return [];
  return group.statuses.filter((s) => s !== 'PENDING_DOCUMENTS');
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

export function BookingsSummaryCards({
  counts,
  activeStage,
  onStageChange,
  stageLabels,
  hideStatusFooter = false,
}: Props) {
  return (
    <div className="grid grid-cols-2 items-start gap-2.5 sm:gap-3 lg:grid-cols-4 lg:gap-4">
      {CARD_STAGES.map((stage) => {
        const meta = STAGE_META[stage];
        const iconStyles = STAGE_ICON_STYLES[stage];
        const active = activeStage === stage;
        const statuses = hideStatusFooter ? [] : statusesForSummaryCard(stage);

        return (
          <AdminMetricCard
            key={stage}
            title={stageLabels?.[stage] ?? meta.label}
            value={String(counts[stage])}
            icon={meta.icon}
            iconClassName={iconStyles.iconClassName}
            iconBgClassName={iconStyles.iconBgClassName}
            footer={<StatusFooter statuses={statuses} />}
            active={active}
            onClick={() => onStageChange(active ? 'all' : stage)}
          />
        );
      })}
    </div>
  );
}
