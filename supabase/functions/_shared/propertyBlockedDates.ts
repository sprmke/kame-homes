/**
 * property_blocked_dates — owner-managed availability blocks.
 * Nights covered: [start_date, end_date) — checkout-exclusive, matches booking occupancy.
 */

import { createServiceClient } from './orgAuth.ts';

export type BlockedRangeRow = {
  id: string;
  property_id: string;
  start_date: string;
  end_date: string;
  note: string | null;
  created_at: string;
  created_by: string | null;
};

const STRICT_DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * True only for exact `YYYY-MM-DD` strings that are also calendar-valid
 * (rejects `2026-02-30`, non-zero-padded values, and any trailing garbage).
 */
export function isValidCalendarDateKey(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = STRICT_DATE_KEY_RE.exec(value.trim());
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!isValidCalendarDateKey(trimmed)) return null;
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(year, month - 1, day);
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Nights `[start_date, end_date)` for every blocked range on the property, optionally windowed. */
export async function loadBlockedDateKeys(
  propertyId: string,
  monthStart?: string,
  monthEnd?: string,
  /** Restrict to `manual` (owner) or `ical_import` (OTA-synced) rows. */
  source?: 'manual' | 'ical_import'
): Promise<string[]> {
  const supabase = createServiceClient();
  let query = supabase
    .from('property_blocked_dates')
    .select('start_date, end_date')
    .eq('property_id', propertyId);
  if (source) query = query.eq('source', source);
  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load blocked dates: ${error.message}`);
  }

  const rangeStart = monthStart ? parseDateOnly(monthStart) : null;
  const rangeEnd = monthEnd ? parseDateOnly(monthEnd) : null;

  const keys = new Set<string>();
  for (const row of data ?? []) {
    const start = parseDateOnly(row.start_date as string);
    const end = parseDateOnly(row.end_date as string);
    if (!start || !end || end <= start) continue;

    let cursor = new Date(start);
    const lastNight = addDays(end, -1);
    while (cursor <= lastNight) {
      if (!rangeStart || !rangeEnd || (cursor >= rangeStart && cursor <= rangeEnd)) {
        keys.add(formatDateKey(cursor));
      }
      cursor = addDays(cursor, 1);
    }
  }

  return [...keys].sort();
}

/** Loads all blocked ranges (unexpanded) for a property — used by overlap/availability checks. */
export async function loadBlockedRanges(propertyId: string): Promise<BlockedRangeRow[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('property_blocked_dates')
    .select('*')
    .eq('property_id', propertyId)
    .order('start_date', { ascending: true });

  if (error) {
    throw new Error(`Failed to load blocked ranges: ${error.message}`);
  }

  return (data ?? []) as BlockedRangeRow[];
}

export async function insertBlockedRange(
  propertyId: string,
  startDate: string,
  endDate: string,
  note?: string | null,
  userId?: string | null
): Promise<BlockedRangeRow> {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  if (!start || !end) {
    throw new Error('blockRange requires valid startDate and endDate (YYYY-MM-DD)');
  }
  if (end <= start) {
    throw new Error('blockRange endDate must be after startDate');
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('property_blocked_dates')
    .insert({
      property_id: propertyId,
      start_date: formatDateKey(start),
      end_date: formatDateKey(end),
      note: note?.trim() || null,
      created_by: userId ?? null,
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to block dates: ${error.message}`);
  }

  return data as BlockedRangeRow;
}

/**
 * Frees the given night keys. Any stored range that intersects a requested
 * night is deleted and re-split into the remaining (still-blocked) sub-ranges,
 * so partially unblocking a range keeps the rest blocked.
 *
 * The delete + re-insert of remnant ranges runs inside a single Postgres
 * function call (`unblock_property_blocked_dates`, see migration
 * `20261001150000_unblock_property_dates_function.sql`) so a failure midway
 * cannot delete a range without persisting its still-blocked remnants —
 * unlike two separate delete/insert round-trips from this edge function.
 */
export async function deleteBlockedRangesCovering(
  propertyId: string,
  dateKeys: string[]
): Promise<number> {
  const validKeys = [...new Set(dateKeys)].filter(isValidCalendarDateKey);
  if (validKeys.length === 0) return 0;

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('unblock_property_blocked_dates', {
    p_property_id: propertyId,
    p_date_keys: validKeys,
  });

  if (error) {
    throw new Error(`Failed to unblock dates: ${error.message}`);
  }

  return typeof data === 'number' ? data : 0;
}

/** True when any night in `[checkIn, checkOut)` is covered by an owner block. */
export async function hasBlockedNightsInRange(
  propertyId: string,
  checkIn: string,
  checkOut: string
): Promise<boolean> {
  const start = parseDateOnly(checkIn);
  const end = parseDateOnly(checkOut);
  if (!start || !end || end <= start) return false;

  const ranges = await loadBlockedRanges(propertyId);
  for (const range of ranges) {
    const blockStart = parseDateOnly(range.start_date);
    const blockEnd = parseDateOnly(range.end_date);
    if (!blockStart || !blockEnd) continue;
    if (blockStart < end && blockEnd > start) return true;
  }
  return false;
}
