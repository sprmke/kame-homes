import {
  FINANCE_REMINDER_INTERVAL_OPTIONS,
  RECURRENCE_INTERVAL_OPTIONS,
  RECURRENCE_SCOPE_OPTIONS,
  type FinanceReminderInterval,
  type RecurrenceEditScope,
  type RecurrenceInterval,
} from '@/features/dashboard/finance/lib/recurrence';

import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/format/currency';
import { formatIsoDateForDisplay } from '@/utils/format/dates';

export type OperatingLineItemPreviewValues = {
  kind: 'expense' | 'income';
  label: string;
  amount: number;
  category: string;
  occurred_on: string;
  notes?: string;
  recurrence_interval: RecurrenceInterval;
  recurrence_until?: string;
  edit_scope: RecurrenceEditScope;
  telegram_reminder_enabled: boolean;
  telegram_days_before: number;
  telegram_reminder_interval: FinanceReminderInterval;
  marked_paid: boolean;
};

type Props = {
  values: OperatingLineItemPreviewValues;
  isEdit: boolean;
  isRecurringEdit: boolean;
  showRepeat: boolean;
  className?: string;
};

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex min-h-11 items-start justify-between gap-3 px-3 py-2.5">
      <span className="text-muted-foreground shrink-0 text-xs">{label}</span>
      <span className="text-foreground min-w-0 break-words text-right text-sm font-medium">
        {value}
      </span>
    </li>
  );
}

function labelForInterval(interval: string): string {
  return RECURRENCE_INTERVAL_OPTIONS.find((opt) => opt.value === interval)?.label ?? interval;
}

function labelForReminderInterval(interval: string): string {
  return FINANCE_REMINDER_INTERVAL_OPTIONS.find((opt) => opt.value === interval)?.label ?? interval;
}

function labelForScope(scope: string): string {
  return RECURRENCE_SCOPE_OPTIONS.find((opt) => opt.value === scope)?.label ?? scope;
}

export function OperatingLineItemFormPreview({
  values,
  isEdit,
  isRecurringEdit,
  showRepeat,
  className,
}: Props) {
  const kindLabel = values.kind === 'income' ? 'Income' : 'Expense';
  const amountLabel = formatMoney(values.amount);
  const dateLabel = values.occurred_on ? formatIsoDateForDisplay(values.occurred_on) : '—';
  const notes = values.notes?.trim() || null;
  const repeats = values.recurrence_interval !== 'none';
  const repeatLine = repeats
    ? `${labelForInterval(values.recurrence_interval)}${
        values.recurrence_until ? ` until ${formatIsoDateForDisplay(values.recurrence_until)}` : ''
      }`
    : labelForInterval('none');

  const telegramLine = values.telegram_reminder_enabled
    ? `${values.telegram_days_before}d before · ${labelForReminderInterval(values.telegram_reminder_interval)}`
    : 'Off';

  return (
    <div className={cn('space-y-4', className)}>
      <div className="rounded-lg border px-3 py-3">
        <p className="truncate text-sm font-medium">{values.label.trim() || 'Untitled'}</p>
        <p className="text-muted-foreground mt-1 text-xs">
          {kindLabel} · {amountLabel}
        </p>
      </div>

      <ul className="divide-border divide-y rounded-lg border">
        <PreviewRow label="Category" value={values.category.trim() || '—'} />
        <PreviewRow label="Date" value={dateLabel} />
        {showRepeat ? <PreviewRow label="Repeat" value={repeatLine} /> : null}
        {isEdit && isRecurringEdit ? (
          <PreviewRow label="Apply to" value={labelForScope(values.edit_scope)} />
        ) : null}
        <PreviewRow label="Telegram" value={telegramLine} />
        {isEdit && values.telegram_reminder_enabled ? (
          <PreviewRow label="Paid" value={values.marked_paid ? 'Yes' : 'No'} />
        ) : null}
        {notes ? <PreviewRow label="Notes" value={notes} /> : null}
      </ul>
    </div>
  );
}
