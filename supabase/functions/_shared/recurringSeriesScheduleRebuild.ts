/**
 * Rebuild materialized recurrence rows when interval or series end changes.
 * Shared by finance_line_items and maintenance_items update paths.
 */

import {
  generateRecurrenceDates,
  type RecurrenceEditScope,
  type RecurrenceInterval,
} from './financeRecurrence.ts';

type RebuildParams<TRow> = {
  supabase: import('./supabaseJs.ts').SupabaseClient;
  table: 'finance_line_items' | 'maintenance_items';
  dateColumn: 'occurred_on' | 'scheduled_on';
  seriesId: string;
  anchorId: string;
  newInterval: RecurrenceInterval;
  newUntil: string;
  /**
   * `'all'` (default) regenerates the whole series from its original start date.
   * `'this_and_future'` leaves every row dated before the anchor's own occurrence
   * completely untouched — including their paid/reconciled/completed state — and
   * only regenerates from the anchor's date forward. `'this'` is not valid here
   * (a repeat interval / end date is a series-level property); callers should
   * upgrade it to `'this_and_future'` before calling.
   */
  scope?: RecurrenceEditScope;
  buildRowPatch: (
    existing: Record<string, unknown>,
    dateYmd: string,
    now: string
  ) => Record<string, unknown>;
  mapRow: (row: Record<string, unknown>) => TRow;
  buildInsertRow: (
    template: Record<string, unknown>,
    dateYmd: string,
    now: string
  ) => Record<string, unknown>;
};

export async function rebuildMaterializedRecurrenceSeries<TRow>(
  params: RebuildParams<TRow>
): Promise<{ row: TRow; updated_count: number }> {
  const {
    supabase,
    table,
    dateColumn,
    seriesId,
    anchorId,
    newInterval,
    newUntil,
    scope = 'all',
    buildRowPatch,
    mapRow,
    buildInsertRow,
  } = params;

  const { data: existingRows, error: fetchErr } = await supabase
    .from(table)
    .select('*')
    .eq('recurrence_series_id', seriesId)
    .order(dateColumn, { ascending: true });
  if (fetchErr) {
    throw new Error(`fetch ${table} series failed: ${fetchErr.message}`);
  }

  const allRows = (existingRows ?? []) as Record<string, unknown>[];
  if (allRows.length === 0) throw new Error('recurrence_series_not_found');

  const anchorRow = allRows.find((row) => String(row.id) === anchorId);
  const anchorDate = anchorRow ? String(anchorRow[dateColumn]).slice(0, 10) : null;

  // 'this_and_future' only regenerates the anchor's own date forward — earlier
  // occurrences (and their paid/reconciled/completed state) are never touched.
  const regenerateFromAnchorOnly = scope === 'this_and_future' && anchorDate != null;
  const rows = regenerateFromAnchorOnly
    ? allRows.filter((row) => String(row[dateColumn]).slice(0, 10) >= anchorDate!)
    : allRows;
  if (rows.length === 0) throw new Error('recurrence_series_not_found');

  const regenerateStart = regenerateFromAnchorOnly
    ? anchorDate!
    : String(allRows[0][dateColumn]).slice(0, 10);
  // Only pin the day-of-month to the series' original start when regenerating
  // the whole series — for 'this_and_future', let it default to the anchor's
  // own day (generateRecurrenceDates does this when no override is given), so
  // a monthly/quarterly/etc. cadence keeps stepping from the date the host is
  // actually looking at instead of snapping back to the series' original day.
  const primaryDay = regenerateFromAnchorOnly
    ? undefined
    : Number(String(allRows[0][dateColumn]).slice(0, 10).slice(8, 10));
  const until = newUntil >= regenerateStart ? newUntil.slice(0, 10) : regenerateStart;
  const newDates = generateRecurrenceDates(regenerateStart, newInterval, until, 500, primaryDay);
  if (newDates.length === 0) throw new Error('recurrence_generated_no_dates');

  const now = new Date().toISOString();
  const template = allRows[0];
  let anchor: Record<string, unknown> | null = null;
  const idsToDelete: string[] = [];

  for (let i = 0; i < rows.length; i += 1) {
    const existing = rows[i];
    const rowId = String(existing.id);
    const newDate = newDates[i];

    if (!newDate) {
      idsToDelete.push(rowId);
      continue;
    }

    const patch = buildRowPatch(existing, newDate, now);
    const { data, error } = await supabase
      .from(table)
      .update(patch)
      .eq('id', rowId)
      .select('*')
      .single();
    if (error) {
      throw new Error(`update ${table} series rebuild failed: ${error.message}`);
    }
    if (rowId === anchorId) anchor = data as Record<string, unknown>;
  }

  if (idsToDelete.length > 0) {
    const { error: deleteErr } = await supabase.from(table).delete().in('id', idsToDelete);
    if (deleteErr) {
      throw new Error(`delete ${table} after series rebuild failed: ${deleteErr.message}`);
    }
  }

  let insertedCount = 0;
  for (let i = rows.length; i < newDates.length; i += 1) {
    const newDate = newDates[i]!;
    const insertRow = buildInsertRow(template, newDate, now);
    const { data, error } = await supabase.from(table).insert(insertRow).select('*').single();
    if (error) {
      throw new Error(`insert ${table} series rebuild failed: ${error.message}`);
    }
    insertedCount += 1;
    if (String(data.id) === anchorId) {
      anchor = data as Record<string, unknown>;
    }
  }

  if (!anchor) {
    const { data: refetched, error: refetchErr } = await supabase
      .from(table)
      .select('*')
      .eq('id', anchorId)
      .maybeSingle();
    if (refetchErr) {
      throw new Error(`fetch ${table} anchor after rebuild failed: ${refetchErr.message}`);
    }
    anchor = (refetched as Record<string, unknown> | null) ?? rows[0];
  }

  const updatedCount = rows.length - idsToDelete.length + insertedCount;
  return {
    row: mapRow(anchor as Record<string, unknown>),
    updated_count: updatedCount,
  };
}
