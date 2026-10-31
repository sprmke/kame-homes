import { useState } from 'react';

import { Loader2 } from 'lucide-react';

import {
  RECURRENCE_SCOPE_OPTIONS,
  recurrenceIntervalLabel,
} from '@/features/dashboard/finance/lib/recurrence';
import type { FinanceLineItem, RecurrenceEditScope } from '@/features/dashboard/finance/lib/types';

import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { cn } from '@/lib/utils';
import { formatIsoDate } from '@/utils/format/bookingDisplay';

type Props = {
  item: FinanceLineItem | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (scope: RecurrenceEditScope) => void;
  isPending?: boolean;
  /** Hide batch delete options — always delete this row only. */
  singleOccurrenceOnly?: boolean;
};

export function RecurringDeleteDialog({
  item,
  open,
  onClose,
  onConfirm,
  isPending,
  singleOccurrenceOnly = false,
}: Props) {
  const [scope, setScope] = useState<RecurrenceEditScope>('this');

  if (!item) return null;

  const isSeries = Boolean(item.recurrence_series_id) && !singleOccurrenceOnly;

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(next) => {
        if (!next && !isPending) onClose();
      }}
    >
      <ResponsiveModalContent className="sm:max-w-[26rem] sm:p-5">
        <ResponsiveModalHeader className="text-left">
          <ResponsiveModalTitle>Delete transaction</ResponsiveModalTitle>
        </ResponsiveModalHeader>
        <p className="text-muted-foreground text-sm">
          Delete <span className="text-foreground font-semibold">{item.label}</span>
          {singleOccurrenceOnly ? (
            <> on {formatIsoDate(item.occurred_on)}?</>
          ) : isSeries ? (
            <>
              {' '}
              from this {recurrenceIntervalLabel(item.recurrence_interval)?.toLowerCase()} series?
            </>
          ) : (
            '?'
          )}
        </p>

        {isSeries ? (
          <RadioGroup
            value={scope}
            onValueChange={(value) => setScope(value as RecurrenceEditScope)}
            className="space-y-2"
          >
            {RECURRENCE_SCOPE_OPTIONS.map((opt) => {
              const active = scope === opt.value;
              return (
                <label
                  key={opt.value}
                  className={cn(
                    'flex min-h-[44px] cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors',
                    active
                      ? 'border-destructive/40 bg-destructive/5'
                      : 'border-border bg-muted/30 hover:bg-muted/50'
                  )}
                >
                  <RadioGroupItem value={opt.value} className="mt-1" />
                  <span className="min-w-0">
                    <span className="text-foreground block text-sm font-semibold">{opt.label}</span>
                    <span className="text-caption text-muted-foreground mt-0.5 block">
                      {opt.description}
                    </span>
                  </span>
                </label>
              );
            })}
          </RadioGroup>
        ) : null}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            className="border-border text-muted-foreground hover:bg-muted min-h-[44px] flex-1 rounded-xl border text-sm font-semibold transition-colors"
            disabled={isPending}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isPending}
            className="bg-destructive text-destructive-foreground flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl text-sm font-semibold disabled:opacity-50"
            onClick={() => onConfirm(isSeries ? scope : 'this')}
          >
            {isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Delete
          </button>
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
