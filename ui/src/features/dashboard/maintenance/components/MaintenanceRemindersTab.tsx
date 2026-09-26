import { useEffect, useMemo, useState } from 'react';

import { Loader2, Pencil, Plus, Repeat, Trash2, Wrench } from 'lucide-react';

import { EntityActivityHistory } from '@/features/dashboard/activity/components/EntityActivityHistory';
import {
  AdminDataTable,
  AdminTableHeadRow,
  AdminTableTh,
  adminTableCell,
  adminTableIconButtonClass,
  adminTableRowClass,
  adminTableBodyText,
} from '@/features/dashboard/bookings/components/AdminDataTable';
import { AdminListPagination } from '@/features/dashboard/bookings/components/AdminListToolbar';
import { useTelegramMaintenanceSettings } from '@/features/dashboard/bookings/hooks/useTelegramMaintenanceSettings';
import {
  recurrenceIntervalLabel,
  recurrenceScheduleUpdateFields,
} from '@/features/dashboard/finance/lib/recurrence';
import {
  MaintenanceItemForm,
  telegramReminderPayloadFromForm,
  type MaintenanceItemFormValues,
} from '@/features/dashboard/maintenance/components/MaintenanceItemForm';
import { MaintenanceRemindersCalendarView } from '@/features/dashboard/maintenance/components/MaintenanceRemindersCalendarView';
import {
  MaintenanceRemindersCardGrid,
  MaintenanceStatusBadge,
} from '@/features/dashboard/maintenance/components/MaintenanceRemindersCardGrid';
import { RecurringDeleteDialog } from '@/features/dashboard/maintenance/components/RecurringDeleteDialog';
import { RecurringSeriesModal } from '@/features/dashboard/maintenance/components/RecurringSeriesModal';
import { fetchRecurringSeriesItems } from '@/features/dashboard/maintenance/hooks/useMaintenanceApi';
import {
  useMaintenanceItemMutations,
  useMaintenanceItems,
} from '@/features/dashboard/maintenance/hooks/useMaintenanceItems';
import {
  filterMaintenanceItems,
  paginateMaintenanceItems,
  sortMaintenanceItems,
} from '@/features/dashboard/maintenance/lib/maintenanceReminders';
import { MAINTENANCE_DEFAULT_REMINDER_TEMPLATE } from '@/features/dashboard/maintenance/lib/maintenanceReminderTemplate';
import type { MaintenanceItem, MaintenanceQuery } from '@/features/dashboard/maintenance/lib/types';

import {
  FinanceOperatingTabSkeleton,
  FinanceStaysCardGridSkeleton,
} from '@/components/skeletons/AdminSkeletons';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { buildPageItems } from '@/lib/table/pagination';
import { cn } from '@/lib/utils';
import { formatIsoDate } from '@/utils/format/bookingDisplay';

const REMINDER_FORM_ID = 'maintenance-reminder-form';

type Props = {
  query: MaintenanceQuery;
  onQueryChange: (next: MaintenanceQuery) => void;
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
  calendarInitialMonth?: Date;
  onCalendarMonthChange?: (month: Date) => void;
  canEdit?: boolean;
  canDelete?: boolean;
};

export function MaintenanceRemindersTab({
  query,
  onQueryChange,
  createOpen,
  onCreateOpenChange,
  calendarInitialMonth,
  onCalendarMonthChange,
  canEdit = true,
  canDelete = true,
}: Props) {
  const {
    data: items = [],
    isLoading,
    isFetching,
  } = useMaintenanceItems(query, {
    includeDueInRange: true,
  });
  const { create, update, remove } = useMaintenanceItemMutations(query);
  const { data: maintenanceSettings } = useTelegramMaintenanceSettings();
  const globalDefaultMessageTemplate =
    maintenanceSettings?.defaultReminderTemplate ?? MAINTENANCE_DEFAULT_REMINDER_TEMPLATE;
  const [modalOpen, setModalOpen] = useState(false);
  const [createSession, setCreateSession] = useState(0);
  const [editing, setEditing] = useState<MaintenanceItem | null>(null);
  const [editingSeriesUntil, setEditingSeriesUntil] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<MaintenanceItem | null>(null);
  const [seriesAnchor, setSeriesAnchor] = useState<MaintenanceItem | null>(null);

  function openCreate() {
    setEditing(null);
    setCreateSession((n) => n + 1);
    setModalOpen(true);
  }

  useEffect(() => {
    if (!createOpen) return;
    setEditing(null);
    setCreateSession((n) => n + 1);
    setModalOpen(true);
    onCreateOpenChange(false);
  }, [createOpen, onCreateOpenChange]);

  async function openEdit(item: MaintenanceItem) {
    if (!canEdit) return;
    setEditing(item);
    if (item.recurrence_series_id) {
      try {
        const rows = await fetchRecurringSeriesItems(item.recurrence_series_id);
        const last = rows[rows.length - 1];
        setEditingSeriesUntil(last?.scheduled_on ?? null);
      } catch {
        setEditingSeriesUntil(null);
      }
    } else {
      setEditingSeriesUntil(null);
    }
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setEditingSeriesUntil(null);
  }

  function openSeries(item: MaintenanceItem) {
    if (!item.recurrence_series_id) return;
    setSeriesAnchor(item);
  }

  function closeSeries() {
    setSeriesAnchor(null);
  }

  function handleSubmit(values: MaintenanceItemFormValues) {
    const payload = {
      label: values.label.trim(),
      category: values.category.trim(),
      scheduled_on: values.scheduled_on,
      notes: values.notes?.trim() || null,
      ...telegramReminderPayloadFromForm(values, globalDefaultMessageTemplate),
    };
    if (editing) {
      const schedule = recurrenceScheduleUpdateFields({
        hasSeries: Boolean(editing.recurrence_series_id),
        recurrenceInterval: values.recurrence_interval,
        recurrenceUntil: values.recurrence_until,
        initialInterval: editing.recurrence_interval,
        initialUntil: editingSeriesUntil,
        editScope: values.edit_scope,
      });
      update.mutate(
        {
          id: editing.id,
          patch: {
            ...payload,
            ...(schedule.recurrence_interval !== undefined
              ? {
                  recurrence_interval: schedule.recurrence_interval,
                  recurrence_until: schedule.recurrence_until ?? null,
                }
              : {}),
          },
          scope: schedule.scope,
        },
        { onSuccess: closeModal }
      );
    } else {
      create.mutate(
        {
          ...payload,
          recurrence_interval:
            values.recurrence_interval === 'none' ? null : values.recurrence_interval,
          recurrence_until:
            values.recurrence_interval === 'none' ? null : (values.recurrence_until ?? null),
        },
        { onSuccess: closeModal }
      );
    }
  }

  const hasSearch = query.q.trim().length > 0;
  const hasActiveFilters =
    query.statusFilter.length > 0 ||
    query.categoryFilter.length > 0 ||
    query.telegramFilter !== 'all';
  const hasActiveQuery = hasSearch || hasActiveFilters;
  const isMobileLayout = useIsBelowLg();
  const showCalendarView = query.view === 'calendar';
  const showTableView = query.view === 'table' && !isMobileLayout;
  const showCardView = query.view === 'card' || (isMobileLayout && query.view !== 'calendar');

  const allItems = items;
  const filteredItems = useMemo(() => filterMaintenanceItems(allItems, query), [allItems, query]);
  const sortedItems = useMemo(
    () => sortMaintenanceItems(filteredItems, query.sort),
    [filteredItems, query.sort]
  );
  const pagedItems = useMemo(() => {
    if (showCalendarView) {
      return { rows: sortedItems, total: sortedItems.length };
    }
    return paginateMaintenanceItems(sortedItems, query.page, query.limit);
  }, [sortedItems, query.page, query.limit, showCalendarView]);

  const displayItems = pagedItems.rows;
  const pageCount = Math.max(1, Math.ceil(pagedItems.total / query.limit));
  const pageItems = useMemo(() => buildPageItems(query.page, pageCount), [query.page, pageCount]);
  const showPagination = !showCalendarView && pageCount > 1;

  useEffect(() => {
    if (query.page <= pageCount) return;
    onQueryChange({ ...query, page: pageCount });
  }, [query, pageCount, onQueryChange]);

  const showStatusColumn = sortedItems.some((item) => item.telegram_reminder_enabled);

  const tableColumnCount = showStatusColumn ? 6 : 5;

  if (isLoading && allItems.length === 0 && !showCalendarView) {
    if (showCardView) {
      return <FinanceStaysCardGridSkeleton />;
    }
    return <FinanceOperatingTabSkeleton />;
  }

  return (
    <div className="space-y-4">
      {showCalendarView ? (
        <MaintenanceRemindersCalendarView
          items={sortedItems}
          isLoading={isLoading}
          isRefreshing={isFetching}
          initialMonth={calendarInitialMonth}
          onMonthChange={onCalendarMonthChange}
          showStatus={showStatusColumn}
          onEdit={openEdit}
          onDelete={setDeleting}
          onOpenSeries={openSeries}
        />
      ) : null}

      {showTableView ? (
        <AdminDataTable minWidth={showStatusColumn ? 560 : 480}>
          <AdminTableHeadRow>
            <AdminTableTh className="pl-4 pr-3 sm:pl-5">Date</AdminTableTh>
            <AdminTableTh className="px-3 sm:px-4">Label</AdminTableTh>
            <AdminTableTh className="hidden md:table-cell">Category</AdminTableTh>
            {showStatusColumn ? (
              <AdminTableTh className="hidden md:table-cell">Status</AdminTableTh>
            ) : null}
            <AdminTableTh className="hidden sm:table-cell">Notes</AdminTableTh>
            <AdminTableTh className="pl-2 pr-3 text-left sm:pl-3 sm:pr-4">
              <span className="sr-only">Actions</span>
            </AdminTableTh>
          </AdminTableHeadRow>
          <tbody>
            {displayItems.length === 0 ? (
              <tr>
                <td colSpan={tableColumnCount}>
                  <div className="flex flex-col items-center justify-center gap-3 px-4 py-20 text-center">
                    <div className="icon-well-sm bg-muted/80 inline-flex items-center justify-center">
                      <Wrench className="text-muted-foreground size-[18px]" aria-hidden />
                    </div>
                    <p className="text-section-title text-foreground font-bold">
                      {hasActiveQuery ? 'No reminders match your filters' : 'No reminders yet'}
                    </p>
                    {!hasActiveQuery ? (
                      <button
                        type="button"
                        className={cn(
                          'mt-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-4',
                          'gradient-primary text-primary-foreground shadow-soft text-[13px] font-semibold'
                        )}
                        onClick={openCreate}
                      >
                        <Plus className="size-4" aria-hidden />
                        Add reminder
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ) : (
              displayItems.map((item, index) => (
                <tr key={item.id} className={adminTableRowClass(index, { interactive: false })}>
                  <td className={cn('whitespace-nowrap', adminTableCell.status)}>
                    <p className={adminTableBodyText.primary}>{formatIsoDate(item.scheduled_on)}</p>
                  </td>
                  <td className={adminTableCell.body}>
                    {item.recurrence_series_id ? (
                      <button
                        type="button"
                        className="hover:text-primary focus-visible:ring-primary/30 max-w-[220px] rounded-md text-left transition-colors focus:outline-none focus-visible:ring-2"
                        onClick={() => openSeries(item)}
                      >
                        <p
                          className={cn(
                            'truncate underline-offset-2 hover:underline',
                            adminTableBodyText.primary
                          )}
                        >
                          {item.label}
                        </p>
                        <span className="text-muted-foreground mt-0.5 inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide">
                          <Repeat className="size-3 shrink-0" aria-hidden />
                          {recurrenceIntervalLabel(item.recurrence_interval)}
                        </span>
                      </button>
                    ) : (
                      <p className={cn('max-w-[220px] truncate', adminTableBodyText.primary)}>
                        {item.label}
                      </p>
                    )}
                    {showStatusColumn && item.telegram_reminder_enabled ? (
                      <div className="mt-1.5 md:hidden">
                        <MaintenanceStatusBadge isComplete={Boolean(item.completed_at)} />
                      </div>
                    ) : null}
                  </td>
                  <td
                    className={cn(
                      'hidden md:table-cell',
                      adminTableBodyText.secondary,
                      adminTableCell.body
                    )}
                  >
                    {item.category ?? '-'}
                  </td>
                  {showStatusColumn ? (
                    <td className={cn('hidden md:table-cell', adminTableCell.body)}>
                      {item.telegram_reminder_enabled ? (
                        <MaintenanceStatusBadge isComplete={Boolean(item.completed_at)} />
                      ) : (
                        <span className={adminTableBodyText.secondary}>-</span>
                      )}
                    </td>
                  ) : null}
                  <td
                    className={cn(
                      'hidden max-w-[180px] truncate sm:table-cell',
                      adminTableBodyText.secondary,
                      adminTableCell.body
                    )}
                  >
                    {item.notes ?? '-'}
                  </td>
                  <td className={adminTableCell.action}>
                    <div className="flex justify-end gap-0.5">
                      {item.recurrence_series_id ? (
                        <button
                          type="button"
                          className={adminTableIconButtonClass}
                          aria-label="View recurring series"
                          onClick={() => openSeries(item)}
                        >
                          <Repeat className="size-4" />
                        </button>
                      ) : null}
                      {canEdit ? (
                        <button
                          type="button"
                          className={adminTableIconButtonClass}
                          aria-label="Edit"
                          onClick={() => openEdit(item)}
                        >
                          <Pencil className="size-4" />
                        </button>
                      ) : null}
                      {canDelete ? (
                        <button
                          type="button"
                          className={cn(
                            adminTableIconButtonClass,
                            'hover:bg-destructive/10 hover:text-destructive'
                          )}
                          aria-label="Delete"
                          onClick={() => setDeleting(item)}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </AdminDataTable>
      ) : null}

      {showCardView ? (
        displayItems.length === 0 ? (
          <div className="border-border/50 bg-card flex flex-col items-center justify-center gap-3 rounded-xl border py-20 text-center">
            <div className="icon-well-sm bg-muted/80 inline-flex items-center justify-center">
              <Wrench className="text-muted-foreground size-[18px]" aria-hidden />
            </div>
            <p className="text-section-title text-foreground font-bold">
              {hasActiveQuery ? 'No reminders match your filters' : 'No reminders yet'}
            </p>
            {!hasActiveQuery ? (
              <button
                type="button"
                className={cn(
                  'mt-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-4',
                  'gradient-primary text-primary-foreground shadow-soft text-[13px] font-semibold'
                )}
                onClick={openCreate}
              >
                <Plus className="size-4" aria-hidden />
                Add reminder
              </button>
            ) : null}
          </div>
        ) : (
          <MaintenanceRemindersCardGrid
            items={displayItems}
            isLoading={isLoading}
            isRefreshing={isFetching}
            showStatus={showStatusColumn}
            onEdit={openEdit}
            onDelete={setDeleting}
            onOpenSeries={openSeries}
          />
        )
      ) : null}

      {showPagination ? (
        <AdminListPagination
          ariaLabel="Reminders pagination"
          page={query.page}
          pageCount={pageCount}
          pageItems={pageItems}
          onPageChange={(page) => onQueryChange({ ...query, page })}
        />
      ) : null}

      <ResponsiveModal
        open={modalOpen}
        onOpenChange={(open) => {
          if (!open) closeModal();
        }}
      >
        <ResponsiveModalContent
          sheetLayout="split"
          className="flex max-h-[min(90dvh,44rem)] max-w-[min(calc(100vw-1.5rem),34rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(calc(100vw-2rem),36rem)] sm:p-0"
          onPointerDownOutside={(e) => {
            const target = e.target as Element | null;
            if (target?.closest('[data-radix-popper-content-wrapper]')) {
              e.preventDefault();
              return;
            }
            if (create.isPending || update.isPending) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (create.isPending || update.isPending) e.preventDefault();
          }}
        >
          <ResponsiveModalHeader className="border-border shrink-0 border-b px-4 pb-3.5 pt-[max(env(safe-area-inset-top,0px),1rem)] text-left sm:px-5 sm:pt-5">
            <ResponsiveModalTitle>
              {editing ? 'Edit reminder' : 'New reminder'}
            </ResponsiveModalTitle>
          </ResponsiveModalHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
            <MaintenanceItemForm
              formId={REMINDER_FORM_ID}
              key={
                editing
                  ? `${editing.id}:${editing.telegram_reminder_interval}`
                  : `new-${createSession}`
              }
              initial={editing}
              seriesRecurrenceUntil={editingSeriesUntil}
              onSubmit={handleSubmit}
            />
            {editing ? (
              <EntityActivityHistory
                targetType="maintenance_item"
                targetId={editing.id}
                className="border-border/60 mt-5 border-t pt-4"
                initialLimit={4}
              />
            ) : null}
          </div>
          <ResponsiveModalFooter className="border-border shrink-0 flex-row gap-2 border-t px-4 py-3.5 sm:px-5">
            <button
              type="button"
              className="border-border text-muted-foreground hover:bg-muted min-h-[44px] flex-1 rounded-xl border text-sm font-semibold transition-colors"
              onClick={closeModal}
            >
              Cancel
            </button>
            <button
              type="submit"
              form={REMINDER_FORM_ID}
              disabled={create.isPending || update.isPending}
              className="gradient-primary text-primary-foreground shadow-soft flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl text-sm font-semibold disabled:opacity-50"
            >
              {create.isPending || update.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              {editing ? 'Save' : 'Add reminder'}
            </button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>

      <RecurringSeriesModal
        anchor={seriesAnchor}
        open={seriesAnchor != null}
        onClose={closeSeries}
        query={query}
      />

      <RecurringDeleteDialog
        item={deleting}
        open={deleting != null}
        onClose={() => setDeleting(null)}
        isPending={remove.isPending}
        onConfirm={(scope) => {
          if (!deleting) return;
          remove.mutate({ id: deleting.id, scope }, { onSuccess: () => setDeleting(null) });
        }}
      />
    </div>
  );
}
