import { useMemo } from 'react';

import {
  buildTelegramReminderSchedule,
  reminderIntervalLabel,
  type FinanceReminderInterval,
  type RecurrenceInterval,
} from '@/features/dashboard/finance/lib/recurrence';

import { cn } from '@/lib/utils';
import { formatIsoDate } from '@/utils/format/bookingDisplay';

type Props = {
  anchorDate: string;
  recurrenceInterval: RecurrenceInterval;
  recurrenceUntil?: string;
  daysBefore: number;
  reminderInterval: FinanceReminderInterval;
  singleOccurrenceOnly?: boolean;
  className?: string;
};

export function TelegramReminderSchedulePreview({
  anchorDate,
  recurrenceInterval,
  recurrenceUntil,
  daysBefore,
  reminderInterval,
  singleOccurrenceOnly,
  className,
}: Props) {
  const schedule = useMemo(
    () =>
      buildTelegramReminderSchedule({
        anchorDate,
        recurrenceInterval,
        recurrenceUntil,
        daysBefore,
        singleOccurrenceOnly,
      }),
    [anchorDate, recurrenceInterval, recurrenceUntil, daysBefore, singleOccurrenceOnly]
  );

  if (!schedule) return null;

  const { windows, totalCount, isRecurring, recurrenceLabel, seriesEndDate } = schedule;
  const window = windows[0];

  return (
    <div
      className={cn(
        'border-border/60 bg-background/60 space-y-1.5 rounded-lg border px-3 py-2.5',
        className
      )}
      aria-live="polite"
    >
      {isRecurring && recurrenceLabel && seriesEndDate ? (
        <p className="text-caption text-muted-foreground">
          {recurrenceLabel} through {formatIsoDate(seriesEndDate)} ({totalCount} total)
        </p>
      ) : window ? (
        <p className="text-foreground text-sm tabular-nums">
          {formatIsoDate(window.windowStart)} – {formatIsoDate(window.windowEnd)}
        </p>
      ) : null}
      <p className="text-caption text-muted-foreground">
        {reminderIntervalLabel(reminderInterval)} · Manila
      </p>
    </div>
  );
}
