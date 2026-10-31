import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  createMaintenanceItemApi,
  deleteMaintenanceItemApi,
  extendRecurringSeriesApi,
  fetchMaintenanceItems,
  fetchRecurringSeriesItems,
  updateMaintenanceItemApi,
} from '@/features/dashboard/maintenance/hooks/useMaintenanceApi';
import { MAINTENANCE_SUMMARY_KEY } from '@/features/dashboard/maintenance/hooks/useMaintenanceSummary';
import type {
  MaintenanceItem,
  MaintenanceQuery,
  RecurrenceEditScope,
} from '@/features/dashboard/maintenance/lib/types';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

import { friendlyToastError } from '@/lib/feedback/toastMessages';

const MAINTENANCE_ITEMS_KEY = ['maintenance-items'] as const;
const MAINTENANCE_RECURRING_SERIES_KEY = ['maintenance-recurring-series'] as const;

function maintenanceItemsQueryKey(
  propertyId: string | null,
  query: MaintenanceQuery,
  options?: { includeDueInRange?: boolean }
) {
  return [
    ...MAINTENANCE_ITEMS_KEY,
    propertyId,
    query.from,
    query.to,
    query.q,
    options?.includeDueInRange ?? false,
  ] as const;
}

function sortMaintenanceItems(items: MaintenanceItem[]): MaintenanceItem[] {
  return [...items].sort((a, b) => b.scheduled_on.localeCompare(a.scheduled_on));
}

function itemMatchesQuery(item: MaintenanceItem, query: MaintenanceQuery): boolean {
  if (query.q.trim()) return false;
  if (query.from && item.scheduled_on < query.from) return false;
  if (query.to && item.scheduled_on > query.to) return false;
  return true;
}

async function refreshMaintenanceCaches(
  qc: QueryClient,
  propertyId: string | null,
  query?: MaintenanceQuery
) {
  const tasks: Promise<unknown>[] = [
    qc.invalidateQueries({ queryKey: MAINTENANCE_ITEMS_KEY }),
    qc.invalidateQueries({ queryKey: MAINTENANCE_SUMMARY_KEY }),
  ];
  if (query) {
    tasks.push(
      qc.refetchQueries({
        queryKey: maintenanceItemsQueryKey(propertyId, query, { includeDueInRange: true }),
        type: 'active',
      })
    );
  }
  await Promise.all(tasks);
}

function maintenanceMutationErrorMessage(error: Error): string {
  switch (error.message) {
    case 'extend_until_must_be_after_series_end':
      return 'Choose a date after the last occurrence in the series.';
    case 'extend_until_must_be_before_series_start':
      return 'Choose a date before the first occurrence in the series.';
    default:
      return friendlyToastError(error, 'Could not save reminder');
  }
}

export function useMaintenanceItems(
  query: MaintenanceQuery,
  options?: { enabled?: boolean; includeDueInRange?: boolean }
) {
  const propertyId = usePropertyIdParam();
  return useQuery({
    queryKey: maintenanceItemsQueryKey(propertyId, query, options),
    queryFn: () =>
      fetchMaintenanceItems(query, { includeDueInRange: options?.includeDueInRange }, propertyId),
    enabled: options?.enabled ?? true,
  });
}

export function useMaintenanceItemMutations(query: MaintenanceQuery) {
  const qc = useQueryClient();
  const propertyId = usePropertyIdParam();
  const listKey = maintenanceItemsQueryKey(propertyId, query, { includeDueInRange: true });

  const create = useMutation({
    mutationFn: (input: Parameters<typeof createMaintenanceItemApi>[0]) =>
      createMaintenanceItemApi(input, propertyId),
    onSuccess: async (result) => {
      toast.success(
        result.created_count > 1
          ? `${result.created_count} recurring reminders created`
          : 'Reminder saved'
      );
      if (result.created_count === 1 && itemMatchesQuery(result.row, query)) {
        qc.setQueryData<MaintenanceItem[]>(listKey, (current) => {
          if (!current) return [result.row];
          if (current.some((item) => item.id === result.row.id)) return current;
          return sortMaintenanceItems([...current, result.row]);
        });
      }
      await refreshMaintenanceCaches(qc, propertyId, query);
    },
    onError: (e: Error) => toast.error(maintenanceMutationErrorMessage(e)),
  });

  const update = useMutation({
    mutationFn: ({
      id,
      patch,
      scope,
    }: {
      id: string;
      patch: Parameters<typeof updateMaintenanceItemApi>[1];
      scope?: RecurrenceEditScope;
    }) => updateMaintenanceItemApi(id, patch, scope, propertyId),
    onSuccess: async (result) => {
      toast.success(
        result.updated_count > 1 ? `${result.updated_count} reminders updated` : 'Reminder updated'
      );
      if (result.updated_count === 1) {
        qc.setQueryData<MaintenanceItem[]>(listKey, (current) => {
          if (!current) return current;
          const inRange = itemMatchesQuery(result.row, query);
          const without = current.filter((item) => item.id !== result.row.id);
          if (!inRange) return without;
          return sortMaintenanceItems([...without, result.row]);
        });
      }
      await refreshMaintenanceCaches(qc, propertyId, query);
    },
    onError: (e: Error) => toast.error(maintenanceMutationErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: ({ id, scope }: { id: string; scope?: RecurrenceEditScope }) =>
      deleteMaintenanceItemApi(id, scope, propertyId),
    onSuccess: async (result, { id }) => {
      toast.success(
        result.deleted_count > 1 ? `${result.deleted_count} reminders deleted` : 'Reminder deleted'
      );
      if (result.deleted_count === 1) {
        qc.setQueryData<MaintenanceItem[]>(listKey, (current) =>
          current ? current.filter((item) => item.id !== id) : current
        );
      }
      await refreshMaintenanceCaches(qc, propertyId, query);
    },
    onError: (e: Error) => toast.error(friendlyToastError(e, 'Could not delete reminder')),
  });

  return { create, update, remove };
}

export function useRecurringSeries(seriesId: string | null) {
  const propertyId = usePropertyIdParam();
  return useQuery({
    queryKey: [...MAINTENANCE_RECURRING_SERIES_KEY, propertyId, seriesId] as const,
    queryFn: () => fetchRecurringSeriesItems(seriesId!, propertyId),
    enabled: Boolean(seriesId),
  });
}

export function useRecurringSeriesMutations(seriesId: string | null, query: MaintenanceQuery) {
  const qc = useQueryClient();
  const propertyId = usePropertyIdParam();

  const refresh = async () => {
    await Promise.all([
      refreshMaintenanceCaches(qc, propertyId, query),
      qc.invalidateQueries({ queryKey: MAINTENANCE_RECURRING_SERIES_KEY }),
    ]);
  };

  const extend = useMutation({
    mutationFn: (input: Parameters<typeof extendRecurringSeriesApi>[0]) =>
      extendRecurringSeriesApi(input, propertyId),
    onSuccess: async (result) => {
      toast.success(
        result.created_count > 0
          ? `Added ${result.created_count} occurrence${result.created_count === 1 ? '' : 's'}`
          : 'No new occurrences to add'
      );
      await refresh();
    },
    onError: (e: Error) => toast.error(maintenanceMutationErrorMessage(e)),
  });

  const update = useMutation({
    mutationFn: ({
      id,
      patch,
      scope,
    }: {
      id: string;
      patch: Parameters<typeof updateMaintenanceItemApi>[1];
      scope?: RecurrenceEditScope;
    }) => updateMaintenanceItemApi(id, patch, scope ?? 'this', propertyId),
    onSuccess: async (result) => {
      toast.success(
        result.updated_count > 1
          ? `${result.updated_count} reminders updated`
          : 'Occurrence updated'
      );
      await refresh();
    },
    onError: (e: Error) => toast.error(maintenanceMutationErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteMaintenanceItemApi(id, 'this', propertyId),
    onSuccess: async () => {
      toast.success('Occurrence deleted');
      await refresh();
    },
    onError: (e: Error) => toast.error(maintenanceMutationErrorMessage(e)),
  });

  return { extend, update, remove, seriesId };
}
