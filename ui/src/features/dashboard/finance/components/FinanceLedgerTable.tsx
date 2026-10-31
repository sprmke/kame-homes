import { useState } from 'react';

import { format, parseISO } from 'date-fns';
import { ArrowDownRight, ArrowUpRight, MoreHorizontal, Pencil, Repeat, Trash2 } from 'lucide-react';

import {
  AdminDataTable,
  AdminTableHeadRow,
  AdminTableTh,
  adminTableCell,
  adminTableIconButtonClass,
  adminTableMoneyClass,
  adminTableRowClass,
  adminTableBodyText,
} from '@/features/dashboard/bookings/components/AdminDataTable';
import { FinanceLedgerStatusBadge } from '@/features/dashboard/finance/components/FinanceLedgerStatusBadge';
import { StayFinanceModal } from '@/features/dashboard/finance/components/StayFinanceModal';
import type { FinanceLedgerEntry } from '@/features/dashboard/finance/lib/financeLedger';
import { recurrenceIntervalLabel } from '@/features/dashboard/finance/lib/recurrence';
import type { FinanceBookingLedgerRow } from '@/features/dashboard/finance/lib/types';

import { FinanceStaysTableSkeleton } from '@/components/skeletons/AdminSkeletons';
import { toneIconWrapClasses } from '@/lib/statusToneColors';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/format/currency';

type Props = {
  rows: FinanceLedgerEntry[];
  isLoading?: boolean;
  onEditTransaction?: (entry: FinanceLedgerEntry) => void;
  onDeleteTransaction?: (entry: FinanceLedgerEntry) => void;
  onOpenSeries?: (entry: FinanceLedgerEntry) => void;
};

export function FinanceLedgerTable({
  rows,
  isLoading = false,
  onEditTransaction,
  onDeleteTransaction,
  onOpenSeries,
}: Props) {
  const [drawerStay, setDrawerStay] = useState<FinanceBookingLedgerRow | null>(null);

  if (isLoading) return <FinanceStaysTableSkeleton />;

  if (rows.length === 0) {
    return (
      <div className="surface-card flex flex-col items-center justify-center gap-3 py-20 text-center">
        <div className="bg-muted flex size-9 items-center justify-center rounded-full">
          <span className="text-muted-foreground text-lg leading-none">∅</span>
        </div>
        <p className="text-section-title text-foreground font-bold">No transactions found</p>
      </div>
    );
  }

  return (
    <>
      <AdminDataTable minWidth={640}>
        <AdminTableHeadRow>
          <AdminTableTh className="pl-4 pr-3 sm:pl-5">Date</AdminTableTh>
          <AdminTableTh className="px-3 sm:px-4">Description</AdminTableTh>
          <AdminTableTh className="hidden px-3 sm:px-4 md:table-cell">Category</AdminTableTh>
          <AdminTableTh className="px-3 sm:px-4">Status</AdminTableTh>
          <AdminTableTh className="px-3 sm:px-4">Amount</AdminTableTh>
          <AdminTableTh className="pl-2 pr-3 sm:pl-3 sm:pr-4">
            <span className="sr-only">Actions</span>
          </AdminTableTh>
        </AdminTableHeadRow>
        <tbody>
          {rows.map((entry, index) => {
            const isIncome = entry.type === 'income';
            const amountPrefix = isIncome ? '+' : '−';
            const amountClass = isIncome
              ? 'text-emerald-700 dark:text-emerald-300'
              : 'text-red-600 dark:text-red-400';

            const handleOpen = () => {
              if (entry.source === 'stay' && entry.stay) {
                setDrawerStay(entry.stay ?? null);
                return;
              }
              if (entry.source === 'transaction') {
                onEditTransaction?.(entry);
              }
            };

            return (
              <tr
                key={entry.id}
                role="button"
                tabIndex={0}
                className={adminTableRowClass(index)}
                onClick={handleOpen}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleOpen();
                  }
                }}
              >
                <td className={adminTableCell.status}>
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'size-9 shrink-0',
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
                    <div>
                      <p className={adminTableBodyText.primary}>
                        {format(parseISO(entry.date), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                </td>
                <td className={adminTableCell.body}>
                  <p className={cn('max-w-[240px] truncate', adminTableBodyText.primary)}>
                    {entry.description}
                  </p>
                  {entry.subDescription ? (
                    <p
                      className={cn('mt-0.5 max-w-[240px] truncate', adminTableBodyText.secondary)}
                    >
                      {entry.subDescription}
                    </p>
                  ) : null}
                  {entry.transaction?.recurrence_series_id ? (
                    <span className="text-muted-foreground mt-0.5 inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide">
                      <Repeat className="size-3 shrink-0" aria-hidden />
                      {recurrenceIntervalLabel(entry.transaction.recurrence_interval)}
                    </span>
                  ) : null}
                </td>
                <td
                  className={cn(
                    'hidden md:table-cell',
                    adminTableBodyText.secondary,
                    adminTableCell.body
                  )}
                >
                  {entry.category}
                </td>
                <td className={adminTableCell.body}>
                  <FinanceLedgerStatusBadge status={entry.status} />
                </td>
                <td className={adminTableCell.money}>
                  <span className={adminTableMoneyClass(amountClass)}>
                    {amountPrefix}
                    {formatMoney(Math.abs(entry.netAmount))}
                  </span>
                </td>
                <td className={adminTableCell.action} onClick={(e) => e.stopPropagation()}>
                  {entry.source === 'transaction' ? (
                    <div className="flex justify-end gap-0.5">
                      {entry.transaction?.recurrence_series_id && onOpenSeries ? (
                        <button
                          type="button"
                          className={adminTableIconButtonClass}
                          aria-label="View recurring series"
                          onClick={() => onOpenSeries(entry)}
                        >
                          <Repeat className="size-4" />
                        </button>
                      ) : null}
                      {onEditTransaction ? (
                        <button
                          type="button"
                          className={adminTableIconButtonClass}
                          aria-label="Edit transaction"
                          onClick={() => onEditTransaction(entry)}
                        >
                          <Pencil className="size-4" />
                        </button>
                      ) : null}
                      {onDeleteTransaction ? (
                        <button
                          type="button"
                          className={cn(
                            adminTableIconButtonClass,
                            'hover:bg-destructive/10 hover:text-destructive'
                          )}
                          aria-label="Delete transaction"
                          onClick={() => onDeleteTransaction(entry)}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={adminTableIconButtonClass}
                      aria-label="Open stay details"
                      onClick={() => entry.stay && setDrawerStay(entry.stay)}
                    >
                      <MoreHorizontal className="size-4" />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </AdminDataTable>

      <StayFinanceModal row={drawerStay} onClose={() => setDrawerStay(null)} />
    </>
  );
}
