import { useMemo } from 'react';

import { Link } from 'react-router-dom';

import { ArrowRight, CalendarClock, CheckCircle2, Receipt, Repeat } from 'lucide-react';

import type { FinanceLineItem } from '@/features/dashboard/finance/lib/types';
import {
  buildDashboardTransactionRows,
  countDashboardDueInPeriod,
  countDashboardRecurringInPeriod,
  dashboardTransactionMaxRows,
} from '@/features/dashboard/property/lib/dashboardFinanceTransactions';

import { AdminSurfaceCardHeader } from '@/components/shared/AdminSurfaceCardHeader';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { DatePreset } from '@/lib/date/navigation';
import { ATTENTION_SEVERITY_STYLES, compactStatusBadgeClasses } from '@/lib/statusToneColors';
import { cn } from '@/lib/utils';
import { formatIsoDate } from '@/utils/format/bookingDisplay';
import { formatMoney } from '@/utils/format/currency';

type Props = {
  items: FinanceLineItem[];
  from: string;
  to: string;
  rangeLabel: string;
  datePreset: DatePreset;
  /** Finance list deep-link (property or parking scoped). */
  transactionsHref: string;
  /** Match calendar card height on desktop (from ResizeObserver). */
  syncedHeight?: number;
  isLoading?: boolean;
  isRefreshing?: boolean;
  className?: string;
};

export function DashboardTransactionsDueCard({
  items,
  from,
  to,
  rangeLabel,
  datePreset,
  transactionsHref,
  syncedHeight,
  isLoading,
  isRefreshing,
  className,
}: Props) {
  const maxRows = dashboardTransactionMaxRows(datePreset);
  const rows = useMemo(() => buildDashboardTransactionRows(items, from, to), [items, from, to]);
  const dueCount = useMemo(() => countDashboardDueInPeriod(items, from, to), [items, from, to]);
  const recurringCount = useMemo(
    () => countDashboardRecurringInPeriod(items, from, to),
    [items, from, to]
  );
  const visibleRows = rows.slice(0, maxRows);

  return (
    <section
      className={cn(
        'surface-card flex min-h-0 min-w-0 flex-col overflow-hidden p-3 sm:p-4',
        className
      )}
      style={syncedHeight ? { height: syncedHeight } : undefined}
    >
      <AdminSurfaceCardHeader
        icon={Receipt}
        title="Transactions"
        description={`Due dates & recurring · ${rangeLabel}`}
        iconClassName="bg-muted/80"
        action={
          <Link
            to={transactionsHref}
            className="text-primary hover:bg-primary/10 inline-flex min-h-[44px] items-center gap-1 rounded-lg px-2 text-sm font-semibold transition-colors"
          >
            View
            <ArrowRight className="size-4 shrink-0" aria-hidden />
          </Link>
        }
      />

      {!isLoading ? (
        <div className="mb-3 flex flex-wrap gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold normal-case',
              ATTENTION_SEVERITY_STYLES.warning.chip,
              'text-amber-900 dark:text-amber-100'
            )}
          >
            <CalendarClock className="size-3 shrink-0" aria-hidden />
            {dueCount} due
          </span>
          <span className="border-border/60 bg-muted/40 text-foreground inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold">
            <Repeat className="text-muted-foreground size-3 shrink-0" aria-hidden />
            {recurringCount} recurring
          </span>
        </div>
      ) : null}

      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col transition-opacity duration-300',
          isRefreshing && !isLoading && 'opacity-60'
        )}
      >
        {isLoading ? (
          <div
            className="min-h-0 flex-1 space-y-2"
            aria-busy="true"
            aria-label="Loading transactions"
          >
            <div className="mb-1 flex flex-wrap gap-2">
              <Skeleton className="h-7 w-16 rounded-full" />
              <Skeleton className="h-7 w-24 rounded-full" />
            </div>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton
                key={i}
                className="h-12 w-full rounded-xl"
                style={{ opacity: 1 - i * 0.12 }}
              />
            ))}
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="border-border/60 flex min-h-0 flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-10 text-center">
            <CalendarClock className="text-muted-foreground/70 size-8" aria-hidden />
            <p className="text-foreground text-sm font-semibold">Nothing due in this period</p>
            <p className="text-caption max-w-xs">
              Recurring bills and payment due dates for {rangeLabel} will show here.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-1 min-h-[44px]">
              <Link to={transactionsHref}>Add Transaction</Link>
            </Button>
          </div>
        ) : (
          <>
            <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
              {visibleRows.map((row) => (
                <li key={row.item.id}>
                  <TransactionRow row={row} />
                </li>
              ))}
            </ul>

            {rows.length > maxRows ? (
              <Link
                to={transactionsHref}
                className="border-border/60 bg-muted/30 text-primary hover:bg-primary/10 mt-3 flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors"
              >
                View all
                <span className="text-muted-foreground font-medium">
                  (+{rows.length - maxRows} more)
                </span>
                <ArrowRight className="size-4 shrink-0" aria-hidden />
              </Link>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

function TransactionRow({
  row,
}: {
  row: ReturnType<typeof buildDashboardTransactionRows>[number];
}) {
  const { item, dueDate, isRecurring, recurrenceLabel, isOverdue, isDueToday, isPaid } = row;

  return (
    <div className="border-border/50 bg-muted/20 rounded-xl border px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-foreground min-w-0 truncate text-sm font-semibold">{item.label}</p>
        <p
          className={cn(
            'shrink-0 text-sm font-bold tabular-nums',
            item.kind === 'income'
              ? 'text-emerald-700 dark:text-emerald-300'
              : 'text-red-600 dark:text-red-400'
          )}
        >
          {item.kind === 'income' ? '+' : '−'}
          {formatMoney(item.amount)}
        </p>
      </div>

      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        {item.category ? (
          <span className="text-muted-foreground min-w-0 truncate text-[11px] font-medium">
            {item.category}
          </span>
        ) : null}

        <span className="text-muted-foreground inline-flex shrink-0 items-center gap-1 text-[11px] font-medium">
          <CalendarClock className="size-3 shrink-0" aria-hidden />
          Due {formatIsoDate(dueDate)}
        </span>

        {isRecurring && recurrenceLabel ? (
          <span className="border-border/50 bg-card text-muted-foreground inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
            <Repeat className="size-3 shrink-0" aria-hidden />
            {recurrenceLabel}
          </span>
        ) : null}

        {isPaid ? (
          <span
            className={cn(
              'inline-flex items-center gap-1 normal-case',
              compactStatusBadgeClasses('success')
            )}
          >
            <CheckCircle2 className="size-3 shrink-0" aria-hidden />
            Paid
          </span>
        ) : isOverdue ? (
          <span className={cn('normal-case', compactStatusBadgeClasses('danger'))}>Overdue</span>
        ) : isDueToday ? (
          <span className={cn('normal-case', compactStatusBadgeClasses('warning'))}>Due today</span>
        ) : null}
      </div>
    </div>
  );
}
