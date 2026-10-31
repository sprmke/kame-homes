/**
 * parking_blocked_dates — owner-managed availability blocks for parking slots.
 * Nights covered: [start_date, end_date) — checkout-exclusive, matches booking occupancy.
 */

import { isValidCalendarDateKey } from './propertyBlockedDates.ts';
import { createServiceClient } from './orgAuth.ts';

export { isValidCalendarDateKey };

export type ParkingBlockedRangeRow = {
  id: string;
  parking_id: string;
  start_date: string;
  end_date: string;
  note: string | null;
  created_at: string;
  created_by: string | null;
};

function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!isValidCalendarDateKey(trimmed)) return null;
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
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

export async function loadParkingBlockedDateKeys(
  parkingId: string,
  monthStart?: string,
  monthEnd?: string
): Promise<string[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('parking_blocked_dates')
    .select('start_date, end_date')
    .eq('parking_id', parkingId);

  if (error) {
    throw new Error(`Failed to load parking blocked dates: ${error.message}`);
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

export async function loadParkingBlockedRanges(
  parkingId: string
): Promise<ParkingBlockedRangeRow[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('parking_blocked_dates')
    .select('*')
    .eq('parking_id', parkingId)
    .order('start_date', { ascending: true });

  if (error) {
    throw new Error(`Failed to load parking blocked ranges: ${error.message}`);
  }

  return (data ?? []) as ParkingBlockedRangeRow[];
}

export async function insertParkingBlockedRange(
  parkingId: string,
  startDate: string,
  endDate: string,
  note?: string | null,
  userId?: string | null
): Promise<ParkingBlockedRangeRow> {
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
    .from('parking_blocked_dates')
    .insert({
      parking_id: parkingId,
      start_date: formatDateKey(start),
      end_date: formatDateKey(end),
      note: note?.trim() || null,
      created_by: userId ?? null,
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to block parking dates: ${error.message}`);
  }

  return data as ParkingBlockedRangeRow;
}

export async function deleteParkingBlockedRangesCovering(
  parkingId: string,
  dateKeys: string[]
): Promise<number> {
  const validKeys = [...new Set(dateKeys)].filter(isValidCalendarDateKey);
  if (validKeys.length === 0) return 0;

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('unblock_parking_blocked_dates', {
    p_parking_id: parkingId,
    p_date_keys: validKeys,
  });

  if (error) {
    throw new Error(`Failed to unblock parking dates: ${error.message}`);
  }

  return typeof data === 'number' ? data : 0;
}

export async function hasParkingBlockedNightsInRange(
  parkingId: string,
  checkIn: string,
  checkOut: string
): Promise<boolean> {
  const start = parseDateOnly(checkIn);
  const end = parseDateOnly(checkOut);
  if (!start || !end || end <= start) return false;

  const ranges = await loadParkingBlockedRanges(parkingId);
  for (const range of ranges) {
    const blockStart = parseDateOnly(range.start_date);
    const blockEnd = parseDateOnly(range.end_date);
    if (!blockStart || !blockEnd) continue;
    if (blockStart < end && blockEnd > start) return true;
  }
  return false;
}
