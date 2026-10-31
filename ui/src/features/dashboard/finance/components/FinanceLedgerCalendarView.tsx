import { useState } from 'react';

import { format, parseISO } from 'date-fns';
import { ArrowDownRight, ArrowUpRight, Pencil, Repeat, Trash2 } from 'lucide-react';

import { CalendarDatePill } from '@/features/dashboard/bookings/components/calendar/CalendarDatePill';
import { DateCalendarView } from '@/features/dashboard/bookings/components/calendar/DateCalendarView';
import type { StatusTone } from '@/features/dashboard/bookings/lib/bookingStatus';
import { FinanceLedgerStatusBadge } from '@/features/dashboard/finance/components/FinanceLedgerStatusBadge';
import { StayFinanceModal } from '@/features/dashboard/finance/components/StayFinanceModal';
import type { FinanceLedgerEntry } from '@/features/dashboard/finance/lib/financeLedger';
import { recurrenceIntervalLabel } from '@/features/dashboard/finance/lib/recurrence';
import type { FinanceBookingLedgerRow } from '@/features/dashboard/finance/lib/types';

import { cn } from '@/lib/utils';
import { formatMoney, formatMoneyCompact } from '@/utils/format/currency';

type Props = {
  rows: FinanceLedgerEntry[];
  isLoading: boolean;
  error?: string | null;
  isRefreshing?: boolean;
  initialMonth?: Date;
  onMonthChange?: (month: Date) => void;
  onEditTransaction?: (entry: FinanceLedgerEntry) => void;
  onDeleteTransaction?: (entry: FinanceLedgerEntry) => void;
  onOpenSeries?: (entry: FinanceLedgerEntry) => void;
};

function entryTone(entry: FinanceLedgerEntry): StatusTone {
  if (entry.status === 'canceled') return 'red';
  if (entry.status === 'pending') return 'yellow';
  return entry.type === 'income' ? 'green' : 'red';
}

export function FinanceLedgerCalendarView({
  rows,
  isLoading,
  error = null,
  isRefreshing,
  initialMonth,
  onMonthChange,
  onEditTransaction,
  onDeleteTransaction,
  onOpenSeries,
}: Props) {
  const [drawerStay, setDrawerStay] = useState<FinanceBookingLedgerRow | null>(null);

  return (
    <>
      <DateCalendarView
        rows={rows}
        isLoading={isLoading}
        error={error}
        isRefreshing={isRefreshing}
        getItemKey={(entry) => entry.id}
        getItemDate={(entry) => entry.date}
        renderPill={(entry) => (
          <CalendarDatePill
            tone={entryTone(entry)}
            label={formatMoneyCompact(Math.abs(entry.netAmount))}
            title={`${entry.description} · ${entry.type === 'income' ? '+' : '−'}${formatMoney(Math.abs(entry.netAmount))}`}
            labelClassName="tabular-nums"
          />
        )}
        renderDayItem={(entry) => (
          <LedgerCalendarDayCard
            entry={entry}
            onOpenStay={(stay) => setDrawerStay(stay)}
            onEditTransaction={onEditTransaction}
            onDeleteTransaction={onDeleteTransaction}
            onOpenSeries={onOpenSeries}
          />
        )}
        entityLabel="entries"
        entityLabelSingular="entry"
        initialMonth={initialMonth}
        onMonthChange={onMonthChange}
      />

      <StayFinanceModal row={drawerStay} onClose={() => setDrawerStay(null)} />
    </>
  );
}

function LedgerCalendarDayCard({
  entry,
  onOpenStay,
  onEditTransaction,
  onDeleteTransaction,
  onOpenSeries,
}: {
  entry: FinanceLedgerEntry;
  onOpenStay: (stay: NonNullable<FinanceLedgerEntry['stay']>) => void;
  onEditTransaction?: (entry: FinanceLedgerEntry) => void;
  onDeleteTransaction?: (entry: FinanceLedgerEntry) => void;
  onOpenSeries?: (entry: FinanceLedgerEntry) => void;
}) {
  const isIncome = entry.type === 'income';

  return (
    <div className="border-border/50 bg-card rounded-xl border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-foreground truncate text-sm font-semibold">{entry.description}</p>
          <p className="text-muted-foreground text-xs">
            {format(parseISO(entry.date), 'MMM d, yyyy')} · {entry.category}
          </p>
        </div>
        <FinanceLedgerStatusBadge status={entry.status} />
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span
          className={cn(
            'text-sm font-semibold tabular-nums tracking-tight sm:text-base',
            isIncome ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-600 dark:text-red-400'
          )}
        >
          {isIncome ? '+' : '−'}
          {formatMoney(Math.abs(entry.netAmount))}
        </span>
        <div className="flex items-center gap-0.5">
          {entry.source === 'stay' && entry.stay ? (
            <button
              type="button"
              className="text-muted-foreground hover:bg-muted/60 hover:text-foreground inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg"
              aria-label="Open stay details"
              onClick={() => onOpenStay(entry.stay!)}
            >
              {isIncome ? (
                <ArrowUpRight className="size-4" />
              ) : (
                <ArrowDownRight className="size-4" />
              )}
            </button>
          ) : (
            <>
              {entry.transaction?.recurrence_series_id && onOpenSeries ? (
                <button
                  type="button"
                  className="text-muted-foreground hover:bg-muted/60 hover:text-foreground inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg"
                  aria-label="View recurring series"
                  onClick={() => onOpenSeries(entry)}
                >
                  <Repeat className="size-4" />
                </button>
              ) : null}
              <button
                type="button"
                className="text-muted-foreground hover:bg-muted/60 hover:text-foreground inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg"
                aria-label="Edit transaction"
                onClick={() => onEditTransaction?.(entry)}
              >
                <Pencil className="size-4" />
              </button>
              <button
                type="button"
                className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg"
                aria-label="Delete transaction"
                onClick={() => onDeleteTransaction?.(entry)}
              >
                <Trash2 className="size-4" />
              </button>
            </>
          )}
        </div>
      </div>
      {entry.transaction?.recurrence_series_id ? (
        <p className="text-muted-foreground mt-2 text-[10px] font-medium uppercase tracking-wide">
          {recurrenceIntervalLabel(entry.transaction.recurrence_interval)}
        </p>
      ) : null}
    </div>
  );
}
