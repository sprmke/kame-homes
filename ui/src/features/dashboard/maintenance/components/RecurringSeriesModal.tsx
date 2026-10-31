import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import {
  CalendarPlus,
  CalendarRange,
  Hash,
  Loader2,
  Pencil,
  Repeat,
  Tag,
  Trash2,
} from 'lucide-react';

import {
  AdminDataTable,
  AdminTableHeadRow,
  AdminTableTh,
  adminTableCell,
  adminTableIconButtonClass,
  adminTableRowClass,
} from '@/features/dashboard/bookings/components/AdminDataTable';
import { useTelegramMaintenanceSettings } from '@/features/dashboard/bookings/hooks/useTelegramMaintenanceSettings';
import {
  recurrenceIntervalLabel,
  recurrenceScheduleUpdateFields,
  suggestExtendAfter,
  suggestExtendBefore,
} from '@/features/dashboard/finance/lib/recurrence';
import {
  MaintenanceItemForm,
  telegramReminderPayloadFromForm,
  type MaintenanceItemFormHandle,
  type MaintenanceItemFormValues,
  type MaintenanceItemFormWizardState,
} from '@/features/dashboard/maintenance/components/MaintenanceItemForm';
import { RecurringDeleteDialog } from '@/features/dashboard/maintenance/components/RecurringDeleteDialog';
import {
  useRecurringSeries,
  useRecurringSeriesMutations,
} from '@/features/dashboard/maintenance/hooks/useMaintenanceItems';
import { MAINTENANCE_DEFAULT_REMINDER_TEMPLATE } from '@/features/dashboard/maintenance/lib/maintenanceReminderTemplate';
import type { MaintenanceItem, MaintenanceQuery } from '@/features/dashboard/maintenance/lib/types';

import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import { RecurringSeriesTableSkeleton } from '@/components/skeletons/AdminSkeletons';
import { IsoDateInput } from '@/components/ui/iso-date-input';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { SegmentedStepProgress } from '@/components/wizard/SegmentedStepProgress';
import { WizardModalActions } from '@/components/wizard/WizardModalActions';
import { useGuardedClose } from '@/hooks/useGuardedClose';
import { cn } from '@/lib/utils';
import { formatIsoDate } from '@/utils/format/bookingDisplay';
import { formatIsoDateForDisplay } from '@/utils/format/dates';

const EDIT_OCCURRENCE_FORM_ID = 'maintenance-edit-occurrence-form';

const INITIAL_WIZARD: MaintenanceItemFormWizardState = {
  stepIndex: 0,
  stepLabels: ['Details', 'Reminders', 'Preview'],
  isFirstStep: true,
  isLastStep: false,
};

type Props = {
  anchor: MaintenanceItem | null;
  open: boolean;
  onClose: () => void;
  query: MaintenanceQuery;
};

export function RecurringSeriesModal({ anchor, open, onClose, query }: Props) {
  const seriesId = anchor?.recurrence_series_id ?? null;
  const { data: items = [], isLoading, isFetching } = useRecurringSeries(open ? seriesId : null);
  const { extend, update, remove } = useRecurringSeriesMutations(seriesId, query);
  const { data: maintenanceSettings } = useTelegramMaintenanceSettings();
  const globalDefaultMessageTemplate =
    maintenanceSettings?.defaultReminderTemplate ?? MAINTENANCE_DEFAULT_REMINDER_TEMPLATE;

  const [extendBeforeUntil, setExtendBeforeUntil] = useState('');
  const [extendAfterUntil, setExtendAfterUntil] = useState('');
  const [editing, setEditing] = useState<MaintenanceItem | null>(null);
  const [deleting, setDeleting] = useState<MaintenanceItem | null>(null);
  const [wizard, setWizard] = useState<MaintenanceItemFormWizardState>(INITIAL_WIZARD);
  const [editDirty, setEditDirty] = useState(false);
  const formRef = useRef<MaintenanceItemFormHandle>(null);

  const handleWizardStateChange = useCallback((state: MaintenanceItemFormWizardState) => {
    setWizard(state);
  }, []);

  useEffect(() => {
    if (editing == null) {
      setWizard(INITIAL_WIZARD);
      setEditDirty(false);
    }
  }, [editing]);

  const interval = anchor?.recurrence_interval ?? items[0]?.recurrence_interval ?? null;
  const seriesStart = items[0]?.scheduled_on;
  const seriesEnd = items[items.length - 1]?.scheduled_on;

  useEffect(() => {
    if (!open || !interval || !seriesStart || !seriesEnd) return;
    setExtendBeforeUntil(suggestExtendBefore(seriesStart, interval));
    setExtendAfterUntil(suggestExtendAfter(seriesEnd, interval, seriesStart));
  }, [open, interval, seriesStart, seriesEnd]);

  const summary = useMemo(() => {
    if (!anchor || items.length === 0) return null;
    const template = items[0];
    return {
      label: template.label,
      category: template.category,
      count: items.length,
    };
  }, [anchor, items]);

  async function handleEditSubmit(values: MaintenanceItemFormValues): Promise<boolean> {
    if (!editing) return false;
    const schedule = recurrenceScheduleUpdateFields({
      hasSeries: true,
      recurrenceInterval: values.recurrence_interval,
      recurrenceUntil: values.recurrence_until,
      initialInterval: editing.recurrence_interval,
      initialUntil: seriesEnd,
      editScope: values.edit_scope,
    });
    try {
      await update.mutateAsync({
        id: editing.id,
        patch: {
          label: values.label.trim(),
          category: values.category.trim(),
          scheduled_on: values.scheduled_on,
          notes: values.notes?.trim() || null,
          ...telegramReminderPayloadFromForm(values, globalDefaultMessageTemplate),
          ...(schedule.recurrence_interval !== undefined
            ? {
                recurrence_interval: schedule.recurrence_interval,
                recurrence_until: schedule.recurrence_until ?? null,
              }
            : {}),
        },
        scope: schedule.scope,
      });
      setEditing(null);
      return true;
    } catch {
      return false;
    }
  }

  const {
    onOpenChange: onEditOpenChange,
    requestClose: requestEditClose,
    dialogProps: editDialogProps,
  } = useGuardedClose({
    open: editing != null,
    onOpenChange: (next) => {
      if (!next && !update.isPending) setEditing(null);
    },
    isDirty: editDirty,
    onSave: async () => (await formRef.current?.submit()) ?? false,
  });

  const busy = extend.isPending || update.isPending || remove.isPending || isFetching;

  if (!anchor?.recurrence_series_id) return null;

  return (
    <>
      <ResponsiveModal
        open={open}
        onOpenChange={(next) => {
          if (!next && !busy) onClose();
        }}
      >
        <ResponsiveModalContent
          sheetLayout="split"
          className="flex max-h-[min(92dvh,44rem)] w-full max-w-[min(calc(100vw-1.5rem),36rem)] flex-col gap-0 overflow-hidden p-0 pb-0 pt-0 sm:max-w-[min(90vw,42rem)] sm:p-0 md:max-w-[min(90vw,48rem)] lg:max-h-[min(90dvh,52rem)] lg:max-w-[min(calc(100vw-3rem),56rem)]"
          onPointerDownOutside={(e) => {
            const target = e.target as Element | null;
            if (target?.closest('[data-radix-popper-content-wrapper]')) {
              e.preventDefault();
              return;
            }
            if (busy) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (busy) e.preventDefault();
          }}
        >
          <div className="border-border/60 shrink-0 space-y-3.5 border-b px-4 pb-3.5 pt-[max(env(safe-area-inset-top,0px),0.875rem)] sm:px-5 sm:pb-4">
            <ResponsiveModalHeader className="space-y-2.5 pr-0 text-left">
              <ResponsiveModalTitle className="flex flex-wrap items-center gap-2 pr-12 sm:pr-14">
                <span>{summary?.label ?? anchor.label}</span>
                {interval ? (
                  <span className="bg-primary/10 text-primary ring-primary/20 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ring-1">
                    <Repeat className="size-3" aria-hidden />
                    {recurrenceIntervalLabel(interval)}
                  </span>
                ) : null}
              </ResponsiveModalTitle>

              {summary && seriesStart && seriesEnd ? (
                <SeriesSummaryGrid
                  category={summary.category}
                  count={summary.count}
                  seriesStart={seriesStart}
                  seriesEnd={seriesEnd}
                />
              ) : isLoading ? (
                <div className="bg-muted/50 h-20 animate-pulse rounded-xl" />
              ) : null}
            </ResponsiveModalHeader>

            {interval && seriesStart && seriesEnd ? (
              <div className="space-y-2">
                <p className="text-overline">Extend series</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <ExtendPanel
                    label="Add earlier occurrences"
                    description={`Before ${formatIsoDateForDisplay(seriesStart)}`}
                    date={extendBeforeUntil}
                    onDateChange={setExtendBeforeUntil}
                    max={seriesStart}
                    disabled={busy}
                    pending={extend.isPending}
                    onExtend={() => {
                      if (!seriesId || extendBeforeUntil >= seriesStart) return;
                      extend.mutate({
                        recurrence_series_id: seriesId,
                        direction: 'before',
                        extend_until: extendBeforeUntil,
                      });
                    }}
                  />
                  <ExtendPanel
                    label="Add later occurrences"
                    description={`After ${formatIsoDateForDisplay(seriesEnd)}`}
                    date={extendAfterUntil}
                    onDateChange={setExtendAfterUntil}
                    min={seriesEnd}
                    disabled={busy}
                    pending={extend.isPending}
                    onExtend={() => {
                      if (!seriesId || extendAfterUntil <= seriesEnd) return;
                      extend.mutate({
                        recurrence_series_id: seriesId,
                        direction: 'after',
                        extend_until: extendAfterUntil,
                      });
                    }}
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex min-h-0 flex-1 flex-col px-4 py-3 pb-[max(env(safe-area-inset-bottom,0px),0.875rem)] sm:px-5">
            {!isLoading && items.length > 0 ? (
              <div className="mb-2.5 flex shrink-0 items-center justify-between gap-2">
                <p className="text-overline">Occurrences</p>
                <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-[11px] font-semibold tabular-nums">
                  {items.length} total
                </span>
              </div>
            ) : null}
            {isLoading ? (
              <RecurringSeriesTableSkeleton showAmount={false} />
            ) : items.length === 0 ? (
              <p className="text-muted-foreground flex flex-1 items-center justify-center py-8 text-center text-sm">
                No occurrences found in this series.
              </p>
            ) : (
              <AdminDataTable minWidth={480} stickyHeader className="min-h-0 flex-1">
                <AdminTableHeadRow sticky>
                  <AdminTableTh className="pl-2 pr-3 sm:pl-3">Date</AdminTableTh>
                  <AdminTableTh className="hidden px-2 sm:table-cell sm:px-3 lg:max-w-none lg:whitespace-normal">
                    Notes
                  </AdminTableTh>
                  <AdminTableTh className="pl-2 pr-2 sm:pr-3">
                    <span className="sr-only">Actions</span>
                  </AdminTableTh>
                </AdminTableHeadRow>
                <tbody>
                  {items.map((item, index) => (
                    <tr
                      key={item.id}
                      className={adminTableRowClass(index, {
                        interactive: false,
                      })}
                    >
                      <td className={cn('whitespace-nowrap', adminTableCell.status)}>
                        <p className="text-data-primary">{formatIsoDate(item.scheduled_on)}</p>
                        {item.id === anchor.id ? (
                          <span className="bg-primary/10 text-primary mt-0.5 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                            Opened from list
                          </span>
                        ) : null}
                      </td>
                      <td
                        className={cn(
                          'text-data-secondary hidden max-w-[280px] truncate sm:table-cell',
                          adminTableCell.body
                        )}
                      >
                        {item.notes ?? '-'}
                      </td>
                      <td className={adminTableCell.action}>
                        <div className="flex justify-end gap-0.5">
                          <button
                            type="button"
                            className={adminTableIconButtonClass}
                            aria-label={`Edit ${formatIsoDate(item.scheduled_on)}`}
                            onClick={() => setEditing(item)}
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            type="button"
                            className={cn(
                              adminTableIconButtonClass,
                              'hover:bg-destructive/10 hover:text-destructive'
                            )}
                            aria-label={`Delete ${formatIsoDate(item.scheduled_on)}`}
                            onClick={() => setDeleting(item)}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </AdminDataTable>
            )}
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>

      <ResponsiveModal open={editing != null} onOpenChange={onEditOpenChange}>
        <ResponsiveModalContent
          sheetLayout="split"
          className="flex max-h-[min(90dvh,44rem)] max-w-[min(calc(100vw-1.5rem),34rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(calc(100vw-2rem),36rem)] sm:p-0"
          onPointerDownOutside={(e) => {
            const target = e.target as Element | null;
            if (target?.closest('[data-radix-popper-content-wrapper]')) {
              e.preventDefault();
              return;
            }
            if (update.isPending) e.preventDefault();
          }}
        >
          <ResponsiveModalHeader className="border-border shrink-0 space-y-0 border-b px-4 pb-3.5 pt-[max(env(safe-area-inset-top,0px),1rem)] text-left sm:px-5 sm:pt-5">
            <ResponsiveModalTitle>Edit occurrence</ResponsiveModalTitle>
            {wizard.stepLabels.length > 1 ? (
              <nav aria-label="Reminder steps" className="mt-3">
                <SegmentedStepProgress labels={wizard.stepLabels} currentIndex={wizard.stepIndex} />
              </nav>
            ) : null}
          </ResponsiveModalHeader>
          {editing ? (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
              <MaintenanceItemForm
                ref={formRef}
                formId={EDIT_OCCURRENCE_FORM_ID}
                key={`${editing.id}:${editing.telegram_reminder_interval}`}
                initial={editing}
                seriesRecurrenceUntil={seriesEnd}
                onSubmit={handleEditSubmit}
                onWizardStateChange={handleWizardStateChange}
                onDirtyChange={setEditDirty}
              />
            </div>
          ) : null}
          <ResponsiveModalFooter className="border-border shrink-0 border-t px-4 py-3.5 sm:px-5">
            <WizardModalActions
              onCancel={requestEditClose}
              onBack={() => formRef.current?.goBack()}
              onNext={() => {
                void formRef.current?.goNext();
              }}
              onSubmit={() => formRef.current?.submit()}
              isFirstStep={wizard.isFirstStep}
              isLastStep={wizard.isLastStep}
              submitPending={update.isPending}
              submitLabel="Save"
              pendingLabel="Saving…"
            />
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>

      <UnsavedChangesDialog {...editDialogProps} />

      <RecurringDeleteDialog
        item={deleting}
        open={deleting != null}
        onClose={() => setDeleting(null)}
        isPending={remove.isPending}
        singleOccurrenceOnly
        onConfirm={() => {
          if (!deleting) return;
          remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
        }}
      />
    </>
  );
}

function SeriesSummaryGrid({
  category,
  count,
  seriesStart,
  seriesEnd,
}: {
  category: string | null;
  count: number;
  seriesStart: string;
  seriesEnd: string;
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <SummaryStat icon={Tag} label="Category" value={category ?? '-'} />
        <SummaryStat icon={Hash} label="Occurrences" value={String(count)} />
        <SummaryStat
          icon={CalendarRange}
          label="Date range"
          value={
            <>
              {formatIsoDate(seriesStart)}
              <span className="text-muted-foreground mx-1 font-normal">→</span>
              {formatIsoDate(seriesEnd)}
            </>
          }
        />
      </div>
    </div>
  );
}

function SummaryStat({
  icon: Icon,
  label,
  value,
}: {
  icon?: typeof Tag;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="border-border/50 bg-card rounded-xl border p-2.5">
      <div className="flex items-center gap-1.5">
        {Icon ? <Icon className="text-muted-foreground size-3.5 shrink-0" aria-hidden /> : null}
        <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider">
          {label}
        </p>
      </div>
      <div className="text-foreground mt-1.5 truncate text-sm font-semibold">{value}</div>
    </div>
  );
}

function ExtendPanel({
  label,
  description,
  date,
  onDateChange,
  min,
  max,
  disabled,
  pending,
  onExtend,
}: {
  label: string;
  description: string;
  date: string;
  onDateChange: (value: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  pending?: boolean;
  onExtend: () => void;
}) {
  return (
    <div className="border-border/50 bg-card rounded-xl border p-3">
      <div className="mb-2.5 flex items-start gap-2.5">
        <div className="bg-primary/10 flex size-9 shrink-0 items-center justify-center rounded-lg">
          <CalendarPlus className="text-primary size-[18px]" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-foreground text-xs font-semibold">{label}</p>
          <p className="text-caption text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <IsoDateInput
          value={date}
          min={min}
          max={max}
          disabled={disabled}
          className="min-w-0 flex-1"
          onChange={(e) => onDateChange(e.target.value)}
        />
        <button
          type="button"
          disabled={disabled || !date || pending}
          className="gradient-primary text-primary-foreground shadow-soft inline-flex min-h-[44px] w-full shrink-0 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold disabled:opacity-50 sm:w-auto sm:min-w-[5.5rem]"
          onClick={onExtend}
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Add
        </button>
      </div>
    </div>
  );
}
