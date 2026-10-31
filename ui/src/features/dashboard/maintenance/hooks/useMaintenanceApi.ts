import type {
  FinanceReminderInterval,
  RecurrenceEditScope,
  RecurrenceInterval,
} from '@/features/dashboard/finance/lib/recurrence';
import { maintenanceQueryToApiParams } from '@/features/dashboard/maintenance/lib/maintenancePeriod';
import type {
  MaintenanceItem,
  MaintenanceQuery,
  MaintenanceSummary,
} from '@/features/dashboard/maintenance/lib/types';
import { appendPropertyId } from '@/features/dashboard/org/lib/adminApiScope';

import { adminEdgeFetchJson } from '@/lib/api/adminEdgeFetch';

export async function fetchMaintenanceSummary(
  query: MaintenanceQuery,
  propertyId: string | null = null
): Promise<MaintenanceSummary> {
  const params = maintenanceQueryToApiParams(query);
  params.set('include_due_in_range', 'true');
  appendPropertyId(params, propertyId);
  const json = await adminEdgeFetchJson<{ data: MaintenanceSummary }>(
    `/maintenance-summary?${params.toString()}`,
    undefined,
    propertyId,
    'Failed to load maintenance summary'
  );
  return json.data;
}

export async function fetchMaintenanceItems(
  query: MaintenanceQuery,
  options?: { includeDueInRange?: boolean },
  propertyId: string | null = null
): Promise<MaintenanceItem[]> {
  const params = maintenanceQueryToApiParams(query);
  if (options?.includeDueInRange) {
    params.set('include_due_in_range', 'true');
  }
  appendPropertyId(params, propertyId);
  const json = await adminEdgeFetchJson<{ data: MaintenanceItem[] }>(
    `/maintenance-items?${params.toString()}`,
    undefined,
    propertyId,
    'Failed to load maintenance items'
  );
  return json.data;
}

export async function fetchRecurringSeriesItems(
  recurrenceSeriesId: string,
  propertyId: string | null = null
): Promise<MaintenanceItem[]> {
  const params = appendPropertyId(
    new URLSearchParams({ recurrence_series_id: recurrenceSeriesId }),
    propertyId
  );
  const json = await adminEdgeFetchJson<{ data: MaintenanceItem[] }>(
    `/maintenance-items?${params.toString()}`,
    undefined,
    propertyId,
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
  propertyId: string | null = null
): Promise<{ rows: MaintenanceItem[]; created_count: number }> {
  const json = await adminEdgeFetchJson<{
    data: MaintenanceItem[];
    created_count?: number;
  }>(
    '/maintenance-items',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'extend_series', ...input }),
    },
    propertyId,
    'Failed to extend recurring series'
  );
  return {
    rows: json.data,
    created_count: json.created_count ?? 0,
  };
}

export type MaintenanceTelegramReminderPayload = {
  telegram_reminder_enabled: boolean;
  telegram_due_date?: string | null;
  telegram_days_before?: number;
  telegram_reminder_interval?: FinanceReminderInterval;
  telegram_message_template?: string | null;
  marked_complete?: boolean;
};

export async function createMaintenanceItemApi(
  input: {
    label: string;
    category: string;
    scheduled_on: string;
    notes?: string | null;
    recurrence_interval?: RecurrenceInterval | null;
    recurrence_until?: string | null;
  } & MaintenanceTelegramReminderPayload,
  propertyId: string | null = null
): Promise<{ row: MaintenanceItem; created_count: number }> {
  const json = await adminEdgeFetchJson<{
    data: MaintenanceItem;
    created_count?: number;
  }>(
    '/maintenance-items',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    propertyId,
    'Failed to create reminder'
  );
  return {
    row: json.data,
    created_count: json.created_count ?? 1,
  };
}

export async function updateMaintenanceItemApi(
  id: string,
  patch: Partial<
    {
      label: string;
      category: string;
      scheduled_on: string;
      notes: string | null;
      recurrence_interval: RecurrenceInterval | null;
      recurrence_until: string | null;
    } & MaintenanceTelegramReminderPayload
  >,
  scope: RecurrenceEditScope = 'this',
  propertyId: string | null = null
): Promise<{ row: MaintenanceItem; updated_count: number }> {
  const json = await adminEdgeFetchJson<{
    data: MaintenanceItem;
    updated_count?: number;
  }>(
    '/maintenance-items',
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, scope, ...patch }),
    },
    propertyId,
    'Failed to update reminder'
  );
  return {
    row: json.data,
    updated_count: json.updated_count ?? 1,
  };
}

export async function deleteMaintenanceItemApi(
  id: string,
  scope: RecurrenceEditScope = 'this',
  propertyId: string | null = null
): Promise<{ deleted_count: number }> {
  const params = appendPropertyId(new URLSearchParams({ id, scope }), propertyId);
  const json = await adminEdgeFetchJson<{ deleted_count?: number }>(
    `/maintenance-items?${params.toString()}`,
    { method: 'DELETE' },
    propertyId,
    'Failed to delete reminder'
  );
  return { deleted_count: json.deleted_count ?? 1 };
}
