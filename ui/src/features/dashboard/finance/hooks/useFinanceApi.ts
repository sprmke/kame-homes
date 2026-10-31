import {
  financeQueryToApiParams,
  ledgerSortToBookingsApiSort,
} from '@/features/dashboard/finance/lib/financePeriod';
import type {
  FinanceBookingLedgerRow,
  FinanceLineItem,
  FinanceQuery,
  FinanceReminderInterval,
  FinanceSummary,
  RecurrenceEditScope,
  RecurrenceInterval,
} from '@/features/dashboard/finance/lib/types';
import { appendPropertyId } from '@/features/dashboard/org/lib/adminApiScope';
import {
  assetScopeQuery,
  type AdminAssetScope,
} from '@/features/dashboard/org/lib/adminAssetScope';

import { adminEdgeFetchJson, assetEdgeFetchJson } from '@/lib/api/adminEdgeFetch';

type FinanceScope = AdminAssetScope | string | null;

function appendFinanceScope(params: URLSearchParams, scope: FinanceScope): URLSearchParams {
  if (scope && typeof scope === 'object') {
    const scoped = assetScopeQuery(scope);
    scoped.forEach((value, key) => params.set(key, value));
    return params;
  }
  return appendPropertyId(params, typeof scope === 'string' ? scope : null);
}

async function financeFetchJson<T>(
  path: string,
  init: RequestInit | undefined,
  scope: FinanceScope,
  fallbackError: string
): Promise<T> {
  if (scope && typeof scope === 'object') {
    return assetEdgeFetchJson<T>(path, init, scope, fallbackError);
  }
  return adminEdgeFetchJson<T>(path, init, typeof scope === 'string' ? scope : null, fallbackError);
}

export async function fetchFinanceSummary(
  query: FinanceQuery,
  scope: FinanceScope = null
): Promise<FinanceSummary> {
  const params = appendFinanceScope(financeQueryToApiParams(query), scope);
  const json = await financeFetchJson<{ data: FinanceSummary }>(
    `/finance-summary?${params.toString()}`,
    undefined,
    scope,
    'Failed to load finance summary'
  );
  return json.data;
}

export async function fetchFinanceBookings(
  query: FinanceQuery,
  scope: FinanceScope = null
): Promise<{
  rows: FinanceBookingLedgerRow[];
  total: number;
}> {
  const params = financeQueryToApiParams(query);
  params.set('page', String(query.page));
  params.set('limit', String(query.limit));
  params.set('sort', ledgerSortToBookingsApiSort(query.sort));
  appendFinanceScope(params, scope);
  const json = await financeFetchJson<{ data: FinanceBookingLedgerRow[]; total: number }>(
    `/finance-bookings?${params.toString()}`,
    undefined,
    scope,
    'Failed to load stays ledger'
  );
  return {
    rows: json.data,
    total: json.total,
  };
}

export async function fetchFinanceLineItems(
  query: FinanceQuery,
  options?: { includeDueInRange?: boolean },
  scope: FinanceScope = null
): Promise<FinanceLineItem[]> {
  const params = financeQueryToApiParams(query);
  if (options?.includeDueInRange) {
    params.set('include_due_in_range', 'true');
  }
  appendFinanceScope(params, scope);
  const json = await financeFetchJson<{ data: FinanceLineItem[] }>(
    `/finance-line-items?${params.toString()}`,
    undefined,
    scope,
    'Failed to load transactions'
  );
  return json.data;
}

export async function fetchRecurringSeriesItems(
  recurrenceSeriesId: string,
  scope: FinanceScope = null
): Promise<FinanceLineItem[]> {
  const params = appendFinanceScope(
    new URLSearchParams({ recurrence_series_id: recurrenceSeriesId }),
    scope
  );
  const json = await financeFetchJson<{ data: FinanceLineItem[] }>(
    `/finance-line-items?${params.toString()}`,
    undefined,
    scope,
    'Failed to load recurring series'
  );
  return json.data;
}

export async function extendRecurringSeriesApi(
  input: {
    recurrence_series_id: string;
    direction: 'before' | 'after';
    extend_until: string;
  },
  scope: FinanceScope = null
): Promise<{ rows: FinanceLineItem[]; created_count: number }> {
  const json = await financeFetchJson<{
    data: FinanceLineItem[];
    created_count: number;
  }>(
    '/finance-line-items',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'extend_series', ...input }),
    },
    scope,
    'Failed to extend recurring series'
  );
  return {
    rows: json.data,
    created_count: json.created_count ?? 0,
  };
}

export type FinanceTelegramReminderPayload = {
  telegram_reminder_enabled: boolean;
  telegram_due_date?: string | null;
  telegram_days_before?: number;
  telegram_reminder_interval?: FinanceReminderInterval;
  telegram_message_template?: string | null;
  marked_paid?: boolean;
};

export async function createFinanceLineItemApi(
  input: {
    kind: 'expense' | 'income';
    label: string;
    amount: number;
    category?: string | null;
    occurred_on: string;
    notes?: string | null;
    recurrence_interval?: RecurrenceInterval | null;
    recurrence_until?: string | null;
  } & FinanceTelegramReminderPayload,
  scope: FinanceScope = null
): Promise<{ row: FinanceLineItem; created_count: number }> {
  const json = await financeFetchJson<{ data: FinanceLineItem; created_count: number }>(
    '/finance-line-items',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    scope,
    'Failed to create transaction'
  );
  return {
    row: json.data,
    created_count: json.created_count ?? 1,
  };
}

export async function updateFinanceLineItemApi(
  id: string,
  patch: Partial<
    {
      kind: 'expense' | 'income';
      label: string;
      amount: number;
      category: string | null;
      occurred_on: string;
      notes: string | null;
      recurrence_interval: RecurrenceInterval | null;
      recurrence_until: string | null;
    } & FinanceTelegramReminderPayload
  >,
  editScope: RecurrenceEditScope = 'this',
  scope: FinanceScope = null
): Promise<{ row: FinanceLineItem; updated_count: number }> {
  const json = await financeFetchJson<{ data: FinanceLineItem; updated_count: number }>(
    '/finance-line-items',
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, scope: editScope, ...patch }),
    },
    scope,
    'Failed to update transaction'
  );
  return {
    row: json.data,
    updated_count: json.updated_count ?? 1,
  };
}

export async function deleteFinanceLineItemApi(
  id: string,
  editScope: RecurrenceEditScope = 'this',
  scope: FinanceScope = null
): Promise<{ deleted_count: number }> {
  const params = appendFinanceScope(new URLSearchParams({ id, scope: editScope }), scope);
  const json = await financeFetchJson<{ deleted_count: number }>(
    `/finance-line-items?${params.toString()}`,
    { method: 'DELETE' },
    scope,
    'Failed to delete transaction'
  );
  return { deleted_count: json.deleted_count ?? 1 };
}

/** Fetch all stays matching filters (for PDF export; capped at 500 rows). */
export async function fetchAllFinanceBookings(
  query: FinanceQuery,
  scope: FinanceScope = null
): Promise<FinanceBookingLedgerRow[]> {
  const params = financeQueryToApiParams(query);
  params.set('page', '1');
  params.set('limit', '100');
  appendFinanceScope(params, scope);
  const all: FinanceBookingLedgerRow[] = [];
  let page = 1;
  const maxPages = 5;
  while (page <= maxPages) {
    params.set('page', String(page));
    const json = await financeFetchJson<{ data: FinanceBookingLedgerRow[]; total: number }>(
      `/finance-bookings?${params.toString()}`,
      undefined,
      scope,
      'Failed to load stays for export'
    );
    const rows = json.data;
    all.push(...rows);
    const total = json.total;
    if (all.length >= total || rows.length === 0) break;
    page += 1;
  }
  return all;
}
