/**
 * Maintenance items CRUD and period summaries.
 */

import { createClient } from './supabaseJs.ts';
import {
  addDaysToIso,
  addRecurrenceInterval,
  daysBetweenIso,
  defaultRecurrenceUntilForInterval,
  generateRecurrenceDates,
  generateRecurrenceDatesBackward,
  isRecurrenceEditScope,
  isRecurrenceInterval,
  type RecurrenceEditScope,
  type RecurrenceInterval,
} from './financeRecurrence.ts';
import { rebuildMaterializedRecurrenceSeries } from './recurringSeriesScheduleRebuild.ts';
import {
  type MaintenanceTelegramReminderInput,
  normalizeMaintenanceReminderInterval,
  reminderFieldsForInsert,
  reminderFieldsForRecurringRow,
  reminderFieldsForUpdate,
} from './telegramMaintenance.ts';

export type MaintenanceItemRow = {
  id: string;
  label: string;
  category: string | null;
  scheduled_on: string;
  notes: string | null;
  recurrence_series_id: string | null;
  recurrence_interval: RecurrenceInterval | null;
  telegram_reminder_enabled: boolean;
  telegram_due_date: string | null;
  telegram_days_before: number;
  telegram_reminder_interval:
    'hourly' | 'every_2_hours' | 'every_4_hours' | 'every_12_hours' | 'daily_noon';
  telegram_message_template: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type MaintenanceSummaryResult = {
  period: {
    from: string | null;
    to: string | null;
  };
  total: number;
  telegramEnabled: number;
  completed: number;
  pending: number;
  byCategory: { category: string; count: number }[];
};

function mapMaintenanceItemRow(row: Record<string, unknown>): MaintenanceItemRow {
  const interval = row.recurrence_interval;
  return {
    id: String(row.id),
    label: String(row.label),
    category: row.category ? String(row.category) : null,
    scheduled_on: String(row.scheduled_on).slice(0, 10),
    notes: row.notes ? String(row.notes) : null,
    recurrence_series_id: row.recurrence_series_id ? String(row.recurrence_series_id) : null,
    recurrence_interval: isRecurrenceInterval(interval) ? interval : null,
    telegram_reminder_enabled: Boolean(row.telegram_reminder_enabled),
    telegram_due_date: row.telegram_due_date ? String(row.telegram_due_date).slice(0, 10) : null,
    telegram_days_before: Number(row.telegram_days_before ?? 3),
    telegram_reminder_interval: normalizeMaintenanceReminderInterval(
      row.telegram_reminder_interval
    ),
    telegram_message_template: row.telegram_message_template
      ? String(row.telegram_message_template)
      : null,
    completed_at: row.completed_at ? String(row.completed_at) : null,
    created_by: row.created_by ? String(row.created_by) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
}

function filterMaintenanceItems(items: MaintenanceItemRow[], q?: string): MaintenanceItemRow[] {
  const needle = q?.trim().toLowerCase() ?? '';
  if (!needle) return items;
  return items.filter((item) => {
    const hay = [item.label, item.category, item.notes]
      .map((v) => String(v ?? '').toLowerCase())
      .join(' ');
    return hay.includes(needle);
  });
}

export async function listMaintenanceItems(params: {
  propertyId?: string;
  from: string | null;
  to: string | null;
  q?: string;
  /** Also return rows whose telegram_due_date falls in range (merged, deduped). */
  includeDueInRange?: boolean;
}): Promise<MaintenanceItemRow[]> {
  const supabase = getSupabase();
  let query = supabase.from('maintenance_items').select('*').order('scheduled_on', {
    ascending: false,
  });
  if (params.propertyId) query = query.eq('property_id', params.propertyId);
  if (params.from) query = query.gte('scheduled_on', params.from);
  if (params.to) query = query.lte('scheduled_on', params.to);
  const { data, error } = await query;
  if (error) throw new Error(`maintenance_items query failed: ${error.message}`);
  const byScheduled = (data ?? []).map((row) =>
    mapMaintenanceItemRow(row as Record<string, unknown>)
  );

  if (!params.includeDueInRange || !params.from || !params.to) {
    return filterMaintenanceItems(byScheduled, params.q);
  }

  const { data: dueData, error: dueError } = await (params.propertyId
    ? supabase
        .from('maintenance_items')
        .select('*')
        .eq('property_id', params.propertyId)
        .gte('telegram_due_date', params.from)
        .lte('telegram_due_date', params.to)
        .order('telegram_due_date', { ascending: true })
    : supabase
        .from('maintenance_items')
        .select('*')
        .gte('telegram_due_date', params.from)
        .lte('telegram_due_date', params.to)
        .order('telegram_due_date', { ascending: true }));
  if (dueError) {
    throw new Error(`maintenance_items due query failed: ${dueError.message}`);
  }

  const merged = new Map<string, MaintenanceItemRow>();
  for (const row of byScheduled) merged.set(row.id, row);
  for (const raw of dueData ?? []) {
    const row = mapMaintenanceItemRow(raw as Record<string, unknown>);
    merged.set(row.id, row);
  }

  return filterMaintenanceItems([...merged.values()], params.q);
}

export async function listRecurringSeriesItems(seriesId: string): Promise<MaintenanceItemRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('maintenance_items')
    .select('*')
    .eq('recurrence_series_id', seriesId)
    .order('scheduled_on', { ascending: true });
  if (error) {
    throw new Error(`maintenance_items series query failed: ${error.message}`);
  }
  return (data ?? []).map((row) => mapMaintenanceItemRow(row as Record<string, unknown>));
}

export async function extendRecurringSeries(
  seriesId: string,
  direction: 'before' | 'after',
  extendUntil: string,
  createdBy: string
): Promise<{ rows: MaintenanceItemRow[]; created_count: number }> {
  const supabase = getSupabase();
  const existing = await listRecurringSeriesItems(seriesId);
  if (existing.length === 0) throw new Error('recurrence_series_not_found');

  const template = existing[0];
  const interval = template.recurrence_interval;
  if (!interval || !isRecurrenceInterval(interval)) {
    throw new Error('recurrence_series_not_recurring');
  }

  const existingDates = new Set(existing.map((r) => r.scheduled_on));
  const minDate = existing[0].scheduled_on;
  const maxDate = existing[existing.length - 1].scheduled_on;
  const until = extendUntil.slice(0, 10);
  const primaryDay = Number(minDate.slice(8, 10));

  let candidateDates: string[] = [];
  if (direction === 'after') {
    if (until <= maxDate) throw new Error('extend_until_must_be_after_series_end');
    const firstNew = addRecurrenceInterval(maxDate, interval, primaryDay);
    candidateDates = generateRecurrenceDates(firstNew, interval, until, 500, primaryDay);
  } else {
    if (until >= minDate) throw new Error('extend_until_must_be_before_series_start');
    candidateDates = generateRecurrenceDatesBackward(minDate, interval, until, 500, primaryDay);
  }

  const newDates = candidateDates.filter((d) => !existingDates.has(d));
  if (newDates.length === 0) {
    return { rows: existing, created_count: 0 };
  }

  const now = new Date().toISOString();
  const seriesReminderInput = template.telegram_reminder_enabled
    ? {
        telegram_reminder_enabled: true as const,
        telegram_days_before: template.telegram_days_before,
        telegram_reminder_interval: template.telegram_reminder_interval,
        telegram_message_template: template.telegram_message_template,
      }
    : { telegram_reminder_enabled: false as const };
  const rows = newDates.map((scheduled_on) => ({
    label: template.label,
    category: template.category,
    notes: template.notes,
    scheduled_on,
    recurrence_series_id: seriesId,
    recurrence_interval: interval,
    created_by: createdBy,
    created_at: now,
    updated_at: now,
    ...reminderFieldsForRecurringRow(seriesReminderInput, scheduled_on),
  }));

  const { data, error } = await supabase.from('maintenance_items').insert(rows).select('*');
  if (error) {
    throw new Error(`extend recurring maintenance_items failed: ${error.message}`);
  }

  const inserted = ((data ?? []) as Record<string, unknown>[]).map(mapMaintenanceItemRow);
  const merged = [...existing, ...inserted].sort((a, b) =>
    a.scheduled_on.localeCompare(b.scheduled_on)
  );
  return { rows: merged, created_count: inserted.length };
}

function summarizeMaintenanceItems(
  items: MaintenanceItemRow[]
): Omit<MaintenanceSummaryResult, 'period'> {
  let telegramEnabled = 0;
  let completed = 0;
  let pending = 0;
  const categoryCounts = new Map<string, number>();

  for (const item of items) {
    if (item.telegram_reminder_enabled) telegramEnabled += 1;
    if (item.completed_at) completed += 1;
    else pending += 1;

    const key = item.category?.trim() || '—';
    categoryCounts.set(key, (categoryCounts.get(key) ?? 0) + 1);
  }

  const byCategory = [...categoryCounts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));

  return {
    total: items.length,
    telegramEnabled,
    completed,
    pending,
    byCategory,
  };
}

export async function computeMaintenanceSummary(params: {
  propertyId?: string;
  from: string | null;
  to: string | null;
  q?: string;
  includeDueInRange?: boolean;
}): Promise<MaintenanceSummaryResult> {
  const items = await listMaintenanceItems({
    propertyId: params.propertyId,
    from: params.from,
    to: params.to,
    q: params.q,
    includeDueInRange: params.includeDueInRange,
  });
  const summary = summarizeMaintenanceItems(items);

  return {
    period: {
      from: params.from,
      to: params.to,
    },
    ...summary,
  };
}

export async function createMaintenanceItem(
  input: {
    propertyId: string;
    label: string;
    category?: string | null;
    scheduled_on: string;
    notes?: string | null;
    recurrence_interval?: RecurrenceInterval | null;
    recurrence_until?: string | null;
    telegramReminder?: MaintenanceTelegramReminderInput;
  },
  createdBy: string
): Promise<{ row: MaintenanceItemRow; created_count: number }> {
  const supabase = getSupabase();
  const now = new Date().toISOString();
  const base = {
    property_id: input.propertyId,
    label: input.label.slice(0, 200),
    category: input.category?.slice(0, 80) ?? null,
    notes: input.notes?.slice(0, 2000) ?? null,
    created_by: createdBy,
    created_at: now,
    updated_at: now,
  };

  const interval = input.recurrence_interval;
  if (!interval || !isRecurrenceInterval(interval)) {
    const { data, error } = await supabase
      .from('maintenance_items')
      .insert({
        ...base,
        scheduled_on: input.scheduled_on,
        recurrence_series_id: null,
        recurrence_interval: null,
        ...reminderFieldsForInsert(input.telegramReminder, input.scheduled_on),
      })
      .select('*')
      .single();
    if (error) throw new Error(`create maintenance_item failed: ${error.message}`);
    const row = mapMaintenanceItemRow(data as Record<string, unknown>);
    return { row, created_count: 1 };
  }

  const until =
    input.recurrence_until && input.recurrence_until >= input.scheduled_on
      ? input.recurrence_until.slice(0, 10)
      : defaultRecurrenceUntilForInterval(input.scheduled_on, interval);
  const dates = generateRecurrenceDates(input.scheduled_on, interval, until);
  if (dates.length === 0) {
    throw new Error('recurrence_generated_no_dates');
  }

  const seriesId = crypto.randomUUID();
  const rows = dates.map((scheduled_on) => ({
    ...base,
    scheduled_on,
    recurrence_series_id: seriesId,
    recurrence_interval: interval,
    ...reminderFieldsForRecurringRow(input.telegramReminder, scheduled_on),
  }));

  const { data, error } = await supabase.from('maintenance_items').insert(rows).select('*');
  if (error) throw new Error(`create recurring maintenance_items failed: ${error.message}`);
  const inserted = ((data ?? []) as Record<string, unknown>[]).sort((a, b) =>
    String(a.scheduled_on).localeCompare(String(b.scheduled_on))
  );
  if (inserted.length === 0) throw new Error('create recurring maintenance_items empty');
  return {
    row: mapMaintenanceItemRow(inserted[0]),
    created_count: inserted.length,
  };
}

export async function updateMaintenanceItem(
  id: string,
  patch: Partial<{
    label: string;
    category: string | null;
    scheduled_on: string;
    notes: string | null;
    recurrence_interval: RecurrenceInterval;
    recurrence_until: string;
    telegramReminder?: MaintenanceTelegramReminderInput;
  }>,
  scope: RecurrenceEditScope = 'this'
): Promise<{ row: MaintenanceItemRow; updated_count: number }> {
  const supabase = getSupabase();
  const { data: existing, error: fetchErr } = await supabase
    .from('maintenance_items')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (fetchErr) throw new Error(`fetch maintenance_item failed: ${fetchErr.message}`);
  if (!existing) throw new Error('maintenance_item_not_found');

  const row = mapMaintenanceItemRow(existing as Record<string, unknown>);
  const seriesId = row.recurrence_series_id;
  const now = new Date().toISOString();

  const contentUpdate: Record<string, unknown> = { updated_at: now };
  if (patch.label != null) contentUpdate.label = patch.label.slice(0, 200);
  if (patch.category !== undefined) {
    contentUpdate.category = patch.category?.slice(0, 80) ?? null;
  }
  if (patch.notes !== undefined) {
    contentUpdate.notes = patch.notes?.slice(0, 2000) ?? null;
  }
  const reminderUpdate = reminderFieldsForUpdate(patch.telegramReminder);
  if (reminderUpdate) {
    delete reminderUpdate.telegram_due_date;
    Object.assign(contentUpdate, reminderUpdate);
  }

  if (seriesId && row.recurrence_interval) {
    const intervalCandidate = patch.recurrence_interval ?? row.recurrence_interval;
    if (!isRecurrenceInterval(intervalCandidate)) {
      throw new Error('invalid_recurrence_interval');
    }

    let seriesEnd = row.scheduled_on;
    const { data: endRow, error: endErr } = await supabase
      .from('maintenance_items')
      .select('scheduled_on')
      .eq('recurrence_series_id', seriesId)
      .order('scheduled_on', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (endErr) {
      throw new Error(`fetch maintenance_items series end failed: ${endErr.message}`);
    }
    if (endRow?.scheduled_on) {
      seriesEnd = String(endRow.scheduled_on).slice(0, 10);
    }

    const untilCandidate = patch.recurrence_until?.slice(0, 10) ?? seriesEnd;
    const intervalChanged = intervalCandidate !== row.recurrence_interval;
    const untilChanged = untilCandidate !== seriesEnd;

    if (intervalChanged || untilChanged) {
      const reminderInput = patch.telegramReminder;
      return await rebuildMaterializedRecurrenceSeries({
        supabase,
        table: 'maintenance_items',
        dateColumn: 'scheduled_on',
        seriesId,
        anchorId: id,
        newInterval: intervalCandidate,
        newUntil: untilCandidate,
        mapRow: mapMaintenanceItemRow,
        buildRowPatch: (existingRow, dateYmd, updatedAt) => {
          const rowPatch: Record<string, unknown> = {
            ...contentUpdate,
            scheduled_on: dateYmd,
            recurrence_interval: intervalCandidate,
            updated_at: updatedAt,
          };
          if (reminderInput) {
            Object.assign(rowPatch, reminderFieldsForRecurringRow(reminderInput, dateYmd));
          } else if (existingRow.telegram_reminder_enabled) {
            rowPatch.telegram_due_date = dateYmd;
          }
          return rowPatch;
        },
        buildInsertRow: (template, dateYmd, updatedAt) => ({
          label: contentUpdate.label ?? template.label,
          category: contentUpdate.category ?? template.category,
          notes: contentUpdate.notes ?? template.notes,
          scheduled_on: dateYmd,
          recurrence_series_id: seriesId,
          recurrence_interval: intervalCandidate,
          created_by: template.created_by,
          created_at: updatedAt,
          updated_at: updatedAt,
          completed_at: null,
          ...(reminderInput
            ? reminderFieldsForRecurringRow(reminderInput, dateYmd)
            : template.telegram_reminder_enabled
              ? {
                  telegram_reminder_enabled: true,
                  telegram_due_date: dateYmd,
                  telegram_days_before: template.telegram_days_before,
                  telegram_reminder_interval: template.telegram_reminder_interval,
                  telegram_message_template: template.telegram_message_template,
                }
              : {
                  telegram_reminder_enabled: false,
                  telegram_due_date: null,
                  telegram_days_before: 3,
                  telegram_reminder_interval: 'daily_noon',
                  telegram_message_template: null,
                }),
        }),
      });
    }
  }

  const effectiveScope = row.recurrence_series_id && isRecurrenceEditScope(scope) ? scope : 'this';

  const update: Record<string, unknown> = { ...contentUpdate };

  if (effectiveScope !== 'this' && patch.telegramReminder) {
    delete update.telegram_due_date;
  }

  if (effectiveScope === 'this') {
    if (patch.scheduled_on) update.scheduled_on = patch.scheduled_on;
    const { data, error } = await supabase
      .from('maintenance_items')
      .update(update)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw new Error(`update maintenance_item failed: ${error.message}`);
    return {
      row: mapMaintenanceItemRow(data as Record<string, unknown>),
      updated_count: 1,
    };
  }

  const dateChanged = Boolean(patch.scheduled_on) && patch.scheduled_on !== row.scheduled_on;
  const interval = row.recurrence_interval;

  if (dateChanged && interval) {
    return await reshiftRecurringSeriesDates({
      supabase,
      id,
      row,
      patch,
      update,
      effectiveScope,
      interval,
    });
  }

  let q = supabase
    .from('maintenance_items')
    .update(update)
    .eq('recurrence_series_id', row.recurrence_series_id);
  if (effectiveScope === 'this_and_future') {
    q = q.gte('scheduled_on', row.scheduled_on);
  }

  const { data, error } = await q.select('*');
  if (error) throw new Error(`update maintenance_items series failed: ${error.message}`);
  const updated = (data ?? []) as Record<string, unknown>[];
  const anchor = updated.find((r) => String(r.id) === id) ?? updated[0] ?? existing;
  return {
    row: mapMaintenanceItemRow(anchor as Record<string, unknown>),
    updated_count: updated.length,
  };
}

async function reshiftRecurringSeriesDates(params: {
  supabase: ReturnType<typeof getSupabase>;
  id: string;
  row: MaintenanceItemRow;
  patch: Partial<{ scheduled_on: string }>;
  update: Record<string, unknown>;
  effectiveScope: RecurrenceEditScope;
  interval: RecurrenceInterval;
}): Promise<{ row: MaintenanceItemRow; updated_count: number }> {
  const { supabase, id, row, patch, update, effectiveScope, interval } = params;
  const seriesId = row.recurrence_series_id;
  if (!seriesId || !patch.scheduled_on) {
    throw new Error('invalid_recurring_date_shift');
  }

  let seriesQuery = supabase
    .from('maintenance_items')
    .select('*')
    .eq('recurrence_series_id', seriesId)
    .order('scheduled_on', { ascending: true });
  if (effectiveScope === 'this_and_future') {
    seriesQuery = seriesQuery.gte('scheduled_on', row.scheduled_on);
  }

  const { data: scopedRows, error: fetchErr } = await seriesQuery;
  if (fetchErr) {
    throw new Error(`fetch maintenance_items series failed: ${fetchErr.message}`);
  }

  const rows = (scopedRows ?? []) as Record<string, unknown>[];
  if (rows.length === 0) throw new Error('maintenance_item_not_found');

  let newDates: string[];
  if (effectiveScope === 'all') {
    const delta = daysBetweenIso(row.scheduled_on, patch.scheduled_on);
    newDates = rows.map((r) => addDaysToIso(String(r.scheduled_on).slice(0, 10), delta));
  } else {
    const { data: allSeriesRows, error: allErr } = await supabase
      .from('maintenance_items')
      .select('scheduled_on')
      .eq('recurrence_series_id', seriesId)
      .order('scheduled_on', { ascending: false })
      .limit(1);
    if (allErr) {
      throw new Error(`fetch maintenance_items series end failed: ${allErr.message}`);
    }
    const seriesEnd = String(allSeriesRows?.[0]?.scheduled_on ?? row.scheduled_on).slice(0, 10);
    newDates = generateRecurrenceDates(patch.scheduled_on, interval, seriesEnd);
    if (newDates.length === 0) throw new Error('recurrence_generated_no_dates');
  }

  const now = String(update.updated_at);
  let anchor: Record<string, unknown> | null = null;
  const idsToDelete: string[] = [];

  for (let i = 0; i < rows.length; i += 1) {
    const existingRow = rows[i];
    const rowId = String(existingRow.id);
    const newDate = newDates[i];

    if (!newDate) {
      idsToDelete.push(rowId);
      continue;
    }

    const rowUpdate = {
      ...update,
      scheduled_on: newDate,
      updated_at: now,
    };
    const { data, error } = await supabase
      .from('maintenance_items')
      .update(rowUpdate)
      .eq('id', rowId)
      .select('*')
      .single();
    if (error) {
      throw new Error(`update maintenance_item date shift failed: ${error.message}`);
    }
    if (rowId === id) anchor = data as Record<string, unknown>;
  }

  if (idsToDelete.length > 0) {
    const { error: deleteErr } = await supabase
      .from('maintenance_items')
      .delete()
      .in('id', idsToDelete);
    if (deleteErr) {
      throw new Error(`delete maintenance_items after date shift failed: ${deleteErr.message}`);
    }
  }

  const updatedCount = rows.length - idsToDelete.length;
  if (!anchor) {
    const { data: refetched, error: refetchErr } = await supabase
      .from('maintenance_items')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (refetchErr) {
      throw new Error(`fetch maintenance_item anchor failed: ${refetchErr.message}`);
    }
    anchor = (refetched as Record<string, unknown> | null) ?? rows[0];
  }

  return {
    row: mapMaintenanceItemRow(anchor as Record<string, unknown>),
    updated_count: updatedCount,
  };
}

export async function deleteMaintenanceItem(
  id: string,
  scope: RecurrenceEditScope = 'this'
): Promise<{ deleted_count: number }> {
  const supabase = getSupabase();
  const { data: existing, error: fetchErr } = await supabase
    .from('maintenance_items')
    .select('id, recurrence_series_id, scheduled_on')
    .eq('id', id)
    .maybeSingle();
  if (fetchErr) throw new Error(`fetch maintenance_item failed: ${fetchErr.message}`);
  if (!existing) throw new Error('maintenance_item_not_found');

  const seriesId = existing.recurrence_series_id ? String(existing.recurrence_series_id) : null;
  const scheduledOn = String(existing.scheduled_on).slice(0, 10);
  const effectiveScope = seriesId && isRecurrenceEditScope(scope) ? scope : 'this';

  if (effectiveScope === 'this' || !seriesId) {
    const { error } = await supabase.from('maintenance_items').delete().eq('id', id);
    if (error) throw new Error(`delete maintenance_item failed: ${error.message}`);
    return { deleted_count: 1 };
  }

  let q = supabase.from('maintenance_items').delete().eq('recurrence_series_id', seriesId);
  if (effectiveScope === 'this_and_future') {
    q = q.gte('scheduled_on', scheduledOn);
  }

  const { data, error } = await q.select('id');
  if (error) throw new Error(`delete maintenance_items series failed: ${error.message}`);
  return { deleted_count: (data ?? []).length };
}
