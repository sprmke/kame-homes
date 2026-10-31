import { Pencil, Repeat, Trash2 } from 'lucide-react';

import { CalendarDatePill } from '@/features/dashboard/bookings/components/calendar/CalendarDatePill';
import { DateCalendarView } from '@/features/dashboard/bookings/components/calendar/DateCalendarView';
import type { StatusTone } from '@/features/dashboard/bookings/lib/bookingStatus';
import { recurrenceIntervalLabel } from '@/features/dashboard/finance/lib/recurrence';
import { MaintenanceStatusBadge } from '@/features/dashboard/maintenance/components/MaintenanceRemindersCardGrid';
import type { MaintenanceItem } from '@/features/dashboard/maintenance/lib/types';

import { cn } from '@/lib/utils';

type ItemActions = {
  onEdit?: (item: MaintenanceItem) => void;
  onDelete?: (item: MaintenanceItem) => void;
  onOpenSeries?: (item: MaintenanceItem) => void;
};

type Props = ItemActions & {
  items: MaintenanceItem[];
  isLoading: boolean;
  error?: string | null;
  isRefreshing?: boolean;
  initialMonth?: Date;
  onMonthChange?: (month: Date) => void;
  showStatus?: boolean;
};

function reminderTone(item: MaintenanceItem): StatusTone {
  if (item.telegram_reminder_enabled && !item.completed_at) return 'yellow';
  if (item.completed_at) return 'green';
  return 'neutral';
}

export function MaintenanceRemindersCalendarView({
  items,
  isLoading,
  error = null,
  isRefreshing,
  initialMonth,
  onMonthChange,
  showStatus = false,
  onEdit,
  onDelete,
  onOpenSeries,
}: Props) {
  return (
    <DateCalendarView
      rows={items}
      isLoading={isLoading}
      error={error}
      isRefreshing={isRefreshing}
      getItemKey={(item) => item.id}
      getItemDate={(item) => item.scheduled_on}
      renderPill={(item) => (
        <CalendarDatePill tone={reminderTone(item)} label={item.label} title={item.label} />
      )}
      renderDayItem={(item) => (
        <MaintenanceReminderDayCard
          item={item}
          showStatus={showStatus}
          onEdit={onEdit ? () => onEdit(item) : undefined}
          onDelete={onDelete ? () => onDelete(item) : undefined}
          onOpenSeries={onOpenSeries ? () => onOpenSeries(item) : undefined}
        />
      )}
      entityLabel="reminders"
      entityLabelSingular="reminder"
      initialMonth={initialMonth}
      onMonthChange={onMonthChange}
      emptySelectCaption="Click any day to see reminders on that date"
      emptyDayCaption="No reminders on this date"
    />
  );
}

function MaintenanceReminderDayCard({
  item,
  showStatus,
  onEdit,
  onDelete,
  onOpenSeries,
}: {
  item: MaintenanceItem;
  showStatus: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onOpenSeries?: () => void;
}) {
  return (
    <div className="border-border/50 bg-card rounded-xl border p-3">
      {item.recurrence_series_id && onOpenSeries ? (
        <button type="button" className="max-w-full text-left" onClick={onOpenSeries}>
          <p className="text-foreground truncate text-sm font-bold underline-offset-2 hover:underline">
            {item.label}
          </p>
          <span className="text-muted-foreground mt-0.5 inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide">
            <Repeat className="size-3 shrink-0" aria-hidden />
            {recurrenceIntervalLabel(item.recurrence_interval)}
          </span>
        </button>
      ) : (
        <p className="text-foreground truncate text-sm font-bold">{item.label}</p>
      )}

      {item.category ? (
        <p className="text-data-secondary mt-0.5 truncate">{item.category}</p>
      ) : null}

      {showStatus && item.telegram_reminder_enabled ? (
        <div className="mt-2">
          <MaintenanceStatusBadge isComplete={Boolean(item.completed_at)} />
        </div>
      ) : null}

      {item.notes ? <p className="text-data-secondary mt-1 line-clamp-2">{item.notes}</p> : null}

      <div className="mt-2 flex justify-end gap-0.5">
        {item.recurrence_series_id && onOpenSeries ? (
          <DayIconButton label="View series" onClick={onOpenSeries}>
            <Repeat className="size-4" />
          </DayIconButton>
        ) : null}
        {onEdit ? (
          <DayIconButton label="Edit" onClick={onEdit}>
            <Pencil className="size-4" />
          </DayIconButton>
        ) : null}
        {onDelete ? (
          <DayIconButton label="Delete" destructive onClick={onDelete}>
            <Trash2 className="size-4" />
          </DayIconButton>
        ) : null}
      </div>
    </div>
  );
}

function DayIconButton({
  label,
  onClick,
  destructive,
  children,
}: {
  label: string;
  onClick: () => void;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2.5',
        'text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors',
        destructive && 'hover:bg-destructive/10 hover:text-destructive'
      )}
    >
      {children}
    </button>
  );
}
