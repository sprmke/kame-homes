import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  createFinanceLineItemApi,
  deleteFinanceLineItemApi,
  extendRecurringSeriesApi,
  fetchFinanceLineItems,
  fetchRecurringSeriesItems,
  updateFinanceLineItemApi,
} from '@/features/dashboard/finance/hooks/useFinanceApi';
import { FINANCE_SUMMARY_KEY } from '@/features/dashboard/finance/hooks/useFinanceSummary';
import type {
  FinanceLineItem,
  FinanceQuery,
  RecurrenceEditScope,
} from '@/features/dashboard/finance/lib/types';
import { assetScopeKey, useAdminAssetScope } from '@/features/dashboard/org/lib/adminAssetScope';

import { friendlyToastError } from '@/lib/feedback/toastMessages';

const FINANCE_LINE_ITEMS_KEY = ['finance-line-items'] as const;
const FINANCE_RECURRING_SERIES_KEY = ['finance-recurring-series'] as const;

function financeLineItemsQueryKey(
  scopeKey: string,
  query: FinanceQuery,
  options?: { includeDueInRange?: boolean }
) {
  return [
    ...FINANCE_LINE_ITEMS_KEY,
    scopeKey,
    query.from,
    query.to,
    query.q,
    options?.includeDueInRange ?? false,
  ] as const;
}

function sortLineItems(items: FinanceLineItem[]): FinanceLineItem[] {
  return [...items].sort((a, b) => b.occurred_on.localeCompare(a.occurred_on));
}

function lineItemMatchesQuery(item: FinanceLineItem, query: FinanceQuery): boolean {
  if (query.q.trim()) return false;
  if (query.from && item.occurred_on < query.from) return false;
  if (query.to && item.occurred_on > query.to) return false;
  return true;
}

async function refreshFinanceLineItemCaches(
  qc: QueryClient,
  scopeKey: string,
  query?: FinanceQuery
) {
  const tasks: Promise<unknown>[] = [
    qc.invalidateQueries({ queryKey: [...FINANCE_LINE_ITEMS_KEY, scopeKey] }),
    qc.invalidateQueries({ queryKey: [...FINANCE_SUMMARY_KEY, scopeKey] }),
  ];
  if (query) {
    tasks.push(
      qc.refetchQueries({
        queryKey: financeLineItemsQueryKey(scopeKey, query),
        type: 'active',
      })
    );
  }
  await Promise.all(tasks);
}

function financeMutationErrorMessage(error: Error): string {
  switch (error.message) {
    case 'cannot_change_date_on_series_batch':
      return 'Could not update the date for this recurring series. Please try again.';
    case 'extend_until_must_be_after_series_end':
      return 'Choose a date after the last occurrence in the series.';
    case 'extend_until_must_be_before_series_start':
      return 'Choose a date before the first occurrence in the series.';
    default:
      return friendlyToastError(error, 'Could not save transaction');
  }
}

export function useFinanceLineItems(
  query: FinanceQuery,
  options?: { enabled?: boolean; includeDueInRange?: boolean }
) {
  const scope = useAdminAssetScope();
  const scopeKey = assetScopeKey(scope);
  return useQuery({
    queryKey: financeLineItemsQueryKey(scopeKey, query, options),
    queryFn: () =>
      fetchFinanceLineItems(query, { includeDueInRange: options?.includeDueInRange }, scope),
    enabled: options?.enabled ?? true,
  });
}

export function useFinanceLineItemMutations(query: FinanceQuery) {
  const qc = useQueryClient();
  const scope = useAdminAssetScope();
  const scopeKey = assetScopeKey(scope);
  const listKey = financeLineItemsQueryKey(scopeKey, query);

  const create = useMutation({
    mutationFn: (input: Parameters<typeof createFinanceLineItemApi>[0]) =>
      createFinanceLineItemApi(input, scope),
    onSuccess: async (result) => {
      toast.success(
        result.created_count > 1
          ? `${result.created_count} recurring transactions created`
          : 'Transaction saved'
      );
      if (result.created_count === 1 && lineItemMatchesQuery(result.row, query)) {
        qc.setQueryData<FinanceLineItem[]>(listKey, (current) => {
          if (!current) return [result.row];
          if (current.some((item) => item.id === result.row.id)) return current;
          return sortLineItems([...current, result.row]);
        });
      }
      await refreshFinanceLineItemCaches(qc, scopeKey, query);
    },
    onError: (e: Error) => toast.error(financeMutationErrorMessage(e)),
  });

  const update = useMutation({
    mutationFn: ({
      id,
      patch,
      scope: editScope,
    }: {
      id: string;
      patch: Parameters<typeof updateFinanceLineItemApi>[1];
      scope?: RecurrenceEditScope;
    }) => updateFinanceLineItemApi(id, patch, editScope, scope),
    onSuccess: async (result) => {
      toast.success(
        result.updated_count > 1
          ? `${result.updated_count} transactions updated`
          : 'Transaction updated'
      );
      if (result.updated_count === 1) {
        qc.setQueryData<FinanceLineItem[]>(listKey, (current) => {
          if (!current) return current;
          const inRange = lineItemMatchesQuery(result.row, query);
          const without = current.filter((item) => item.id !== result.row.id);
          if (!inRange) return without;
          return sortLineItems([...without, result.row]);
        });
      }
      await refreshFinanceLineItemCaches(qc, scopeKey, query);
    },
    onError: (e: Error) => toast.error(financeMutationErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: ({ id, scope: editScope }: { id: string; scope?: RecurrenceEditScope }) =>
      deleteFinanceLineItemApi(id, editScope, scope),
    onSuccess: async (result, { id }) => {
      toast.success(
        result.deleted_count > 1
          ? `${result.deleted_count} transactions deleted`
          : 'Transaction deleted'
      );
      if (result.deleted_count === 1) {
        qc.setQueryData<FinanceLineItem[]>(listKey, (current) =>
          current ? current.filter((item) => item.id !== id) : current
        );
      }
      await refreshFinanceLineItemCaches(qc, scopeKey, query);
    },
    onError: (e: Error) => toast.error(friendlyToastError(e, 'Could not delete transaction')),
  });

  return { create, update, remove };
}

export function useRecurringSeries(seriesId: string | null) {
  const scope = useAdminAssetScope();
  const scopeKey = assetScopeKey(scope);
  return useQuery({
    queryKey: [...FINANCE_RECURRING_SERIES_KEY, scopeKey, seriesId] as const,
    queryFn: () => fetchRecurringSeriesItems(seriesId!, scope),
    enabled: Boolean(seriesId),
  });
}

export function useRecurringSeriesMutations(seriesId: string | null, query: FinanceQuery) {
  const qc = useQueryClient();
  const scope = useAdminAssetScope();
  const scopeKey = assetScopeKey(scope);

  const refresh = async () => {
    await Promise.all([
      refreshFinanceLineItemCaches(qc, scopeKey, query),
      qc.invalidateQueries({ queryKey: [...FINANCE_RECURRING_SERIES_KEY, scopeKey] }),
    ]);
  };

  const extend = useMutation({
    mutationFn: (input: Parameters<typeof extendRecurringSeriesApi>[0]) =>
      extendRecurringSeriesApi(input, scope),
    onSuccess: async (result) => {
      toast.success(
        result.created_count > 0
          ? `Added ${result.created_count} occurrence${result.created_count === 1 ? '' : 's'}`
          : 'No new occurrences to add'
      );
      await refresh();
    },
    onError: (e: Error) => toast.error(financeMutationErrorMessage(e)),
  });

  const update = useMutation({
    mutationFn: ({
      id,
      patch,
      scope: editScope,
    }: {
      id: string;
      patch: Parameters<typeof updateFinanceLineItemApi>[1];
      scope?: RecurrenceEditScope;
    }) => updateFinanceLineItemApi(id, patch, editScope ?? 'this', scope),
    onSuccess: async (result) => {
      toast.success(
        result.updated_count > 1
          ? `${result.updated_count} transactions updated`
          : 'Occurrence updated'
      );
      await refresh();
    },
    onError: (e: Error) => toast.error(financeMutationErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFinanceLineItemApi(id, 'this', scope),
    onSuccess: async () => {
      toast.success('Occurrence deleted');
      await refresh();
    },
    onError: (e: Error) => toast.error(financeMutationErrorMessage(e)),
  });

  return { extend, update, remove, seriesId };
}
