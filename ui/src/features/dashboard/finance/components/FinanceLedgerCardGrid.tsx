import { useState } from 'react';

import { format, parseISO } from 'date-fns';
import { ArrowDownRight, ArrowUpRight, Pencil, Repeat, Trash2 } from 'lucide-react';

import { FinanceLedgerStatusBadge } from '@/features/dashboard/finance/components/FinanceLedgerStatusBadge';
import { StayFinanceModal } from '@/features/dashboard/finance/components/StayFinanceModal';
import type { FinanceLedgerEntry } from '@/features/dashboard/finance/lib/financeLedger';
import { recurrenceIntervalLabel } from '@/features/dashboard/finance/lib/recurrence';
import type { FinanceBookingLedgerRow } from '@/features/dashboard/finance/lib/types';

import { AdminListCardOverflowMenu } from '@/components/mobile/AdminListCardOverflowMenu';
import { FinanceStaysCardGridSkeleton } from '@/components/skeletons/AdminSkeletons';
import { toneIconWrapClasses } from '@/lib/statusToneColors';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/format/currency';

type Props = {
  rows: FinanceLedgerEntry[];
  isLoading: boolean;
  isRefreshing?: boolean;
  onEditTransaction?: (entry: FinanceLedgerEntry) => void;
  onDeleteTransaction?: (entry: FinanceLedgerEntry) => void;
  onOpenSeries?: (entry: FinanceLedgerEntry) => void;
};

export function FinanceLedgerCardGrid({
  rows,
  isLoading,
  isRefreshing = false,
  onEditTransaction,
  onDeleteTransaction,
  onOpenSeries,
}: Props) {
  const [drawerStay, setDrawerStay] = useState<FinanceBookingLedgerRow | null>(null);

  if (isLoading) return <FinanceStaysCardGridSkeleton />;
  if (rows.length === 0) return null;

  return (
    <>
      <div
        className={cn(
          'native-stagger grid grid-cols-1 items-stretch gap-2 sm:grid-cols-2 sm:gap-3.5 lg:grid-cols-3 xl:grid-cols-4',
          'transition-opacity duration-300',
          isRefreshing && 'opacity-60'
        )}
      >
        {rows.map((entry) => {
          const isIncome = entry.type === 'income';
          const amountPrefix = isIncome ? '+' : '−';
          const recurrenceLabel = entry.transaction?.recurrence_series_id
            ? recurrenceIntervalLabel(entry.transaction.recurrence_interval)
            : null;

          const handleOpen = () => {
            if (entry.source === 'stay' && entry.stay) {
              setDrawerStay(entry.stay ?? null);
              return;
            }
            onEditTransaction?.(entry);
          };

          const phoneActions =
            entry.source === 'transaction'
              ? [
                  ...(entry.transaction?.recurrence_series_id && onOpenSeries
                    ? [
                        {
                          key: 'series',
                          label: 'View series',
                          icon: <Repeat className="size-5" aria-hidden />,
                          onSelect: () => onOpenSeries(entry),
                        },
                      ]
                    : []),
                  ...(onEditTransaction
                    ? [
                        {
                          key: 'edit',
                          label: 'Edit',
                          icon: <Pencil className="size-5" aria-hidden />,
                          onSelect: () => onEditTransaction(entry),
                        },
                      ]
                    : []),
                  ...(onDeleteTransaction
                    ? [
                        {
                          key: 'delete',
                          label: 'Delete',
                          icon: <Trash2 className="size-5" aria-hidden />,
                          destructive: true,
                          onSelect: () => onDeleteTransaction(entry),
                        },
                      ]
                    : []),
                ]
              : [];

          return (
            <div
              key={entry.id}
              role="button"
              tabIndex={0}
              className="surface-card-interactive flex cursor-pointer flex-col px-3 py-2.5 sm:min-h-[148px] sm:p-4"
              onClick={handleOpen}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleOpen();
                }
              }}
            >
              {/* Phone: title + amount; status · meta; actions behind ⋯ */}
              <div className="flex items-start gap-2.5 sm:hidden">
                <div
                  className={cn(
                    'mt-0.5 size-7 shrink-0',
                    toneIconWrapClasses(isIncome ? 'green' : 'red')
                  )}
                >
                  {isIncome ? (
                    <ArrowUpRight
                      className="size-3.5 text-emerald-600 dark:text-emerald-400"
                      aria-hidden
                    />
                  ) : (
                    <ArrowDownRight
                      className="size-3.5 text-red-600 dark:text-red-400"
                      aria-hidden
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-foreground min-w-0 flex-1 truncate text-[13px] font-semibold leading-tight">
                      {entry.description}
                    </p>
                    <span
                      className={cn(
                        'shrink-0 text-[13px] font-semibold tabular-nums leading-none',
                        isIncome
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : 'text-red-600 dark:text-red-400'
                      )}
                    >
                      {amountPrefix}
                      {formatMoney(Math.abs(entry.netAmount))}
                    </span>
                  </div>
                  <div className="mt-1 flex min-w-0 items-center gap-1.5">
                    <FinanceLedgerStatusBadge status={entry.status} className="shrink-0" />
                    <p className="text-muted-foreground min-w-0 flex-1 truncate text-[11px] leading-tight">
                      <span className="tabular-nums">{format(parseISO(entry.date), 'MMM d')}</span>
                      <span className="text-muted-foreground/40 mx-1" aria-hidden>
                        ·
                      </span>
                      <span>{entry.category}</span>
                      {recurrenceLabel ? (
                        <>
                          <span className="text-muted-foreground/40 mx-1" aria-hidden>
                            ·
                          </span>
                          <span className="uppercase tracking-wide">{recurrenceLabel}</span>
                        </>
                      ) : null}
                    </p>
                    {phoneActions.length > 0 ? (
                      <AdminListCardOverflowMenu
                        label={`Actions for ${entry.description}`}
                        sheetTitle="Transaction"
                        actions={phoneActions}
                      />
                    ) : null}
                  </div>
                </div>
              </div>

              {/* sm+: taller card layout */}
              <div className="hidden h-full flex-col sm:flex">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <div
                      className={cn(
                        'size-8 shrink-0',
                        toneIconWrapClasses(isIncome ? 'green' : 'red')
                      )}
                    >
                      {isIncome ? (
                        <ArrowUpRight
                          className="size-4 text-emerald-600 dark:text-emerald-400"
                          aria-hidden
                        />
                      ) : (
                        <ArrowDownRight
                          className="size-4 text-red-600 dark:text-red-400"
                          aria-hidden
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-foreground truncate text-sm font-semibold leading-snug">
                        {entry.description}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {format(parseISO(entry.date), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                  <FinanceLedgerStatusBadge status={entry.status} />
                </div>

                <div className="mt-auto space-y-2">
                  <p className="text-muted-foreground text-xs">{entry.category}</p>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        'text-sm font-semibold tabular-nums tracking-tight sm:text-base',
                        isIncome
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : 'text-red-600 dark:text-red-400'
                      )}
                    >
                      {amountPrefix}
                      {formatMoney(Math.abs(entry.netAmount))}
                    </span>
                    {entry.source === 'transaction' ? (
                      <div
                        className="flex items-center gap-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
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
                      </div>
                    ) : null}
                  </div>
                  {recurrenceLabel ? (
                    <p className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
                      {recurrenceLabel}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <StayFinanceModal row={drawerStay} onClose={() => setDrawerStay(null)} />
    </>
  );
}
