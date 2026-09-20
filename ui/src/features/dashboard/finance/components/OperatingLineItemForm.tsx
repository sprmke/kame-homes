import { useEffect, type ReactNode } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { useTelegramFinanceSettings } from '@/features/dashboard/bookings/hooks/useTelegramFinanceSettings';
import { requiredPositiveMoney } from '@/features/dashboard/bookings/lib/moneyFieldSchema';
import { CategoryCombobox } from '@/features/dashboard/finance/components/CategoryCombobox';
import { TelegramReminderSchedulePreview } from '@/features/dashboard/finance/components/TelegramReminderSchedulePreview';
import { manilaTodayIso } from '@/features/dashboard/finance/lib/financePeriod';
import {
  FINANCE_DEFAULT_REMINDER_TEMPLATE,
  financeMessageTemplateForApi,
  financeMessageTemplateForForm,
} from '@/features/dashboard/finance/lib/financeReminderTemplate';
import {
  defaultRecurrenceUntil,
  FINANCE_REMINDER_INTERVAL_OPTIONS,
  normalizeFinanceReminderInterval,
  RECURRENCE_INTERVAL_OPTIONS,
  RECURRENCE_SCOPE_OPTIONS,
  isRecurrenceScheduleDirty,
} from '@/features/dashboard/finance/lib/recurrence';
import type { FinanceLineItem } from '@/features/dashboard/finance/lib/types';

import { Checkbox } from '@/components/ui/checkbox';
import { IsoDateInput } from '@/components/ui/iso-date-input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { statusToneSurfaceClasses } from '@/lib/statusToneColors';
import { cn } from '@/lib/utils';

const schema = z
  .object({
    kind: z.enum(['expense', 'income']),
    label: z.string().trim().min(1, 'Label is required').max(200),
    amount: requiredPositiveMoney({
      requiredError: 'Amount is required',
      positiveError: 'Amount must be greater than 0',
    }),
    category: z.string().trim().min(1, 'Category is required').max(80),
    occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid date required'),
    notes: z.string().max(2000).optional(),
    recurrence_interval: z.enum([
      'none',
      'daily',
      'weekly',
      'monthly',
      'twice_monthly',
      'every_2_months',
      'quarterly',
      'every_6_months',
      'yearly',
    ]),
    recurrence_until: z.string().optional(),
    edit_scope: z.enum(['this', 'this_and_future', 'all']),
    telegram_reminder_enabled: z.boolean(),
    telegram_days_before: z.coerce.number().int().min(0).max(90),
    telegram_reminder_interval: z.enum([
      'hourly',
      'every_2_hours',
      'every_4_hours',
      'every_12_hours',
      'daily_noon',
    ]),
    telegram_message_template: z.string().max(4000).optional(),
    marked_paid: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.recurrence_interval !== 'none') {
      if (!data.recurrence_until?.match(/^\d{4}-\d{2}-\d{2}$/)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'End date required for recurring transactions',
          path: ['recurrence_until'],
        });
      } else if (data.recurrence_until < data.occurred_on) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'End date must be on or after the start date',
          path: ['recurrence_until'],
        });
      }
    }
  });

export type OperatingLineItemFormValues = z.infer<typeof schema>;

export function telegramReminderPayloadFromForm(
  values: OperatingLineItemFormValues,
  globalDefaultMessageTemplate = FINANCE_DEFAULT_REMINDER_TEMPLATE
) {
  return {
    telegram_reminder_enabled: values.telegram_reminder_enabled,
    telegram_due_date: values.telegram_reminder_enabled ? values.occurred_on : null,
    telegram_days_before: values.telegram_days_before,
    telegram_reminder_interval: values.telegram_reminder_interval,
    telegram_message_template: financeMessageTemplateForApi(
      values.telegram_message_template,
      values.telegram_reminder_enabled,
      globalDefaultMessageTemplate
    ),
    marked_paid: values.marked_paid,
  };
}

const CATEGORY_SUGGESTIONS = [
  'Rent',
  'Amortization',
  'Utilities',
  'Supplies',
  'Maintenance',
  'Marketing',
  'Staff',
  'Other',
];

type Props = {
  formId: string;
  initial?: FinanceLineItem | null;
  seriesRecurrenceUntil?: string | null;
  onSubmit: (values: OperatingLineItemFormValues) => void;
};

function defaultValues(
  initial: FinanceLineItem | null | undefined,
  globalDefaultMessageTemplate: string,
  seriesRecurrenceUntil?: string | null
): OperatingLineItemFormValues {
  const start = initial?.occurred_on ?? manilaTodayIso();
  const interval = initial?.recurrence_interval ?? 'none';
  return {
    kind: initial?.kind ?? 'expense',
    label: initial?.label ?? '',
    amount: initial?.amount ?? 0,
    category: initial?.category ?? '',
    occurred_on: start,
    notes: initial?.notes ?? '',
    recurrence_interval: interval === null ? 'none' : interval,
    recurrence_until:
      interval && interval !== 'none'
        ? (seriesRecurrenceUntil?.slice(0, 10) ?? defaultRecurrenceUntil(start, interval))
        : '',
    edit_scope: 'this',
    telegram_reminder_enabled: initial?.telegram_reminder_enabled ?? false,
    telegram_days_before: initial?.telegram_days_before ?? 3,
    telegram_reminder_interval: normalizeFinanceReminderInterval(
      initial?.telegram_reminder_interval
    ),
    telegram_message_template: financeMessageTemplateForForm(
      initial?.telegram_message_template,
      globalDefaultMessageTemplate
    ),
    marked_paid: Boolean(initial?.paid_at),
  };
}

export function OperatingLineItemForm({ formId, initial, seriesRecurrenceUntil, onSubmit }: Props) {
  const isRecurringEdit = Boolean(initial?.recurrence_series_id);
  const isEdit = Boolean(initial);
  const { data: financeSettings } = useTelegramFinanceSettings();
  const globalDefaultMessageTemplate =
    financeSettings?.defaultReminderTemplate ?? FINANCE_DEFAULT_REMINDER_TEMPLATE;

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<OperatingLineItemFormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues(initial, globalDefaultMessageTemplate, seriesRecurrenceUntil),
  });

  useEffect(() => {
    reset(defaultValues(initial, globalDefaultMessageTemplate, seriesRecurrenceUntil), {
      keepDefaultValues: false,
    });
  }, [initial, globalDefaultMessageTemplate, seriesRecurrenceUntil, reset]);

  const kind = watch('kind');
  const recurrenceInterval = watch('recurrence_interval');
  const recurrenceUntil = watch('recurrence_until');
  const occurredOn = watch('occurred_on');
  const telegramReminderEnabled = watch('telegram_reminder_enabled');
  const telegramDaysBefore = watch('telegram_days_before');
  const telegramReminderInterval = watch('telegram_reminder_interval');

  const scheduleDirty = isRecurrenceScheduleDirty({
    isRecurringEdit,
    recurrenceInterval,
    recurrenceUntil,
    initialInterval: initial?.recurrence_interval,
    initialUntil: seriesRecurrenceUntil,
  });

  const repeatOptions = RECURRENCE_INTERVAL_OPTIONS.filter(
    (opt) => !isRecurringEdit || opt.value !== 'none'
  );

  useEffect(() => {
    // A repeat interval / end-date change is a series-level property — it can't
    // apply to a single occurrence, so "this occurrence only" stops being a valid
    // choice. Nudge off it, but still let the host pick this-and-future vs. all
    // (the picker stays visible below, just scoped to those two options) instead
    // of silently deciding for them.
    if (scheduleDirty && getValues('edit_scope') === 'this') {
      setValue('edit_scope', 'this_and_future');
    }
  }, [scheduleDirty, getValues, setValue]);

  useEffect(() => {
    if (!telegramReminderEnabled) return;
    const current = getValues('telegram_message_template')?.trim();
    if (!current) {
      setValue('telegram_message_template', globalDefaultMessageTemplate);
    }
  }, [telegramReminderEnabled, globalDefaultMessageTemplate, getValues, setValue]);

  useEffect(() => {
    if (!isEdit && recurrenceInterval !== 'none' && occurredOn) {
      setValue('recurrence_until', defaultRecurrenceUntil(occurredOn, recurrenceInterval));
    }
  }, [recurrenceInterval, occurredOn, isEdit, setValue]);

  return (
    <form id={formId} className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <div className="grid grid-cols-2 gap-2">
        {(['expense', 'income'] as const).map((k) => {
          const active = kind === k;
          const isIncome = k === 'income';
          return (
            <button
              key={k}
              type="button"
              className={cn(
                'text-ui flex min-h-[44px] items-center justify-center gap-2 rounded-xl font-semibold capitalize transition-all',
                active
                  ? cn(
                      'border ring-1',
                      isIncome
                        ? `${statusToneSurfaceClasses('green').bgColor} ${statusToneSurfaceClasses('green').color} ${statusToneSurfaceClasses('green').borderColor}`
                        : `${statusToneSurfaceClasses('red').bgColor} ${statusToneSurfaceClasses('red').color} ${statusToneSurfaceClasses('red').borderColor}`
                    )
                  : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted/60 border'
              )}
              onClick={() => reset({ ...watch(), kind: k })}
            >
              {isIncome ? (
                <ArrowUpRight className="size-4" aria-hidden />
              ) : (
                <ArrowDownRight className="size-4" aria-hidden />
              )}
              {k}
            </button>
          );
        })}
      </div>

      <Field label="Label" required error={errors.label?.message}>
        <input
          className="border-input bg-card text-foreground field-focus h-10 w-full rounded-lg border px-3 text-sm transition-colors"
          placeholder="e.g. Monthly rent"
          {...register('label')}
        />
      </Field>

      <Field label="Amount (₱)" required error={errors.amount?.message}>
        <input
          type="number"
          step="0.01"
          min={0}
          className="border-input bg-card text-foreground field-focus h-10 w-full rounded-lg border px-3 text-sm tabular-nums transition-colors"
          placeholder="0.00"
          {...register('amount')}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Category" required error={errors.category?.message}>
          <Controller
            name="category"
            control={control}
            render={({ field }) => (
              <CategoryCombobox
                value={field.value ?? ''}
                onChange={field.onChange}
                suggestions={CATEGORY_SUGGESTIONS}
              />
            )}
          />
        </Field>

        <Field label="Date" error={errors.occurred_on?.message}>
          <Controller
            name="occurred_on"
            control={control}
            render={({ field }) => (
              <IsoDateInput
                value={field.value ?? ''}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
              />
            )}
          />
        </Field>
      </div>

      {!isEdit || isRecurringEdit ? (
        <>
          <Field label="Repeat" error={errors.recurrence_interval?.message}>
            <Controller
              name="recurrence_interval"
              control={control}
              render={({ field: { value, onChange } }) => (
                <Select value={value} onValueChange={onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {repeatOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          {recurrenceInterval !== 'none' ? (
            <Field label="Repeats until" error={errors.recurrence_until?.message}>
              <Controller
                name="recurrence_until"
                control={control}
                render={({ field }) => <IsoDateInput {...field} />}
              />
            </Field>
          ) : null}
        </>
      ) : null}

      {isEdit && isRecurringEdit ? (
        <fieldset className="space-y-2">
          <legend className="text-overline mb-1.5 block">Apply changes to</legend>
          {scheduleDirty ? (
            <p className="text-muted-foreground text-caption -mt-1 mb-1.5">
              A repeat schedule change can&apos;t apply to one occurrence only.
            </p>
          ) : null}
          <Controller
            name="edit_scope"
            control={control}
            render={({ field: { value, onChange } }) => (
              <RadioGroup value={value} onValueChange={onChange} className="space-y-2">
                {RECURRENCE_SCOPE_OPTIONS.filter(
                  (opt) => !scheduleDirty || opt.value !== 'this'
                ).map((opt) => (
                  <label
                    key={opt.value}
                    className={cn(
                      'flex min-h-[44px] cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors',
                      value === opt.value
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-border bg-muted/30 hover:bg-muted/50'
                    )}
                  >
                    <RadioGroupItem value={opt.value} className="mt-1" />
                    <span className="min-w-0">
                      <span className="text-foreground block text-sm font-semibold">
                        {opt.label}
                      </span>
                      <span className="text-caption text-muted-foreground mt-0.5 block">
                        {opt.description}
                      </span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
            )}
          />
        </fieldset>
      ) : null}

      <Field label="Notes" error={errors.notes?.message}>
        <textarea
          rows={7}
          className="border-input bg-card text-foreground field-focus w-full rounded-lg border px-3 py-2 text-sm transition-colors"
          placeholder="Optional notes…"
          {...register('notes')}
        />
      </Field>

      <fieldset className="border-border/50 bg-muted/20 space-y-3 rounded-xl border p-3">
        <legend className="sr-only">Telegram reminders</legend>
        <p className="text-overline">Telegram reminders</p>
        <Controller
          name="telegram_reminder_enabled"
          control={control}
          render={({ field: { value, onChange, onBlur, name } }) => (
            <label className="flex min-h-[44px] cursor-pointer items-start gap-3">
              <Checkbox
                name={name}
                checked={value}
                onCheckedChange={onChange}
                onBlur={onBlur}
                className="mt-1"
              />
              <span className="min-w-0">
                <span className="text-foreground block text-sm font-semibold">
                  Send payment due reminders
                </span>
                <span className="text-caption text-muted-foreground mt-0.5 block">
                  Posts to your Finance Telegram group.
                </span>
              </span>
            </label>
          )}
        />

        {telegramReminderEnabled ? (
          <div className="space-y-4">
            <Field label="Days before due" error={errors.telegram_days_before?.message}>
              <input
                type="number"
                min={0}
                max={90}
                className="border-input bg-card text-foreground field-focus h-10 w-full rounded-lg border px-3 text-sm"
                {...register('telegram_days_before', { valueAsNumber: true })}
              />
            </Field>

            <Field label="How often to remind" error={errors.telegram_reminder_interval?.message}>
              <Controller
                name="telegram_reminder_interval"
                control={control}
                render={({ field: { value, onChange, onBlur } }) => (
                  <RadioGroup
                    value={value}
                    onValueChange={onChange}
                    className="space-y-2"
                    aria-label="How often to remind"
                  >
                    {FINANCE_REMINDER_INTERVAL_OPTIONS.map((opt) => (
                      <label
                        key={opt.value}
                        className={cn(
                          'flex min-h-[44px] cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors',
                          value === opt.value
                            ? 'border-primary/40 bg-primary/5'
                            : 'border-border bg-muted/30 hover:bg-muted/50'
                        )}
                      >
                        <RadioGroupItem value={opt.value} className="mt-1" onBlur={onBlur} />
                        <span className="min-w-0">
                          <span className="text-foreground block text-sm font-semibold">
                            {opt.label}
                          </span>
                          <span className="text-caption text-muted-foreground mt-0.5 block">
                            {opt.description}
                          </span>
                        </span>
                      </label>
                    ))}
                  </RadioGroup>
                )}
              />
            </Field>

            <TelegramReminderSchedulePreview
              anchorDate={occurredOn}
              recurrenceInterval={recurrenceInterval}
              recurrenceUntil={recurrenceUntil}
              daysBefore={telegramDaysBefore}
              reminderInterval={telegramReminderInterval}
              singleOccurrenceOnly={isEdit}
            />

            <Field label="Message" error={errors.telegram_message_template?.message}>
              <textarea
                rows={9}
                className="border-input bg-card text-foreground field-focus w-full rounded-lg border px-3 py-2 font-mono text-xs"
                {...register('telegram_message_template')}
              />
            </Field>

            {isEdit ? (
              <Controller
                name="marked_paid"
                control={control}
                render={({ field: { value, onChange, onBlur, name } }) => (
                  <label className="flex min-h-[44px] cursor-pointer items-start gap-3">
                    <Checkbox
                      name={name}
                      checked={value}
                      onCheckedChange={onChange}
                      onBlur={onBlur}
                      className="mt-1"
                    />
                    <span className="min-w-0">
                      <span className="text-foreground block text-sm font-semibold">
                        Mark as paid
                      </span>
                      <span className="text-caption text-muted-foreground mt-0.5 block">
                        Stops reminders for this transaction.
                      </span>
                    </span>
                  </label>
                )}
              />
            ) : null}
          </div>
        ) : null}
      </fieldset>
    </form>
  );
}

function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="block min-w-0">
      <span className="text-overline mb-1.5 block">
        {label}
        {required ? (
          <>
            {' '}
            <span className="text-destructive" aria-hidden>
              *
            </span>
          </>
        ) : null}
      </span>
      {children}
      {hint ? <p className="text-caption text-muted-foreground mt-1">{hint}</p> : null}
      {error ? <p className="text-destructive mt-1 text-xs font-medium">{error}</p> : null}
    </div>
  );
}
