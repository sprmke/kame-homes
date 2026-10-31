import {
  addDays,
  eachDayOfInterval,
  endOfWeek,
  format,
  isSameDay,
  startOfDay,
  startOfWeek,
} from 'date-fns';

import { parseOccupancyDate } from '@/features/dashboard/bookings/components/calendar/calendarDateUtils';

import { toGuestSubmissionTime } from '@/utils/format/dates';

/** Default stay times when a booking row has none (matches guest-facing fallbacks). */
export const CALENDAR_DEFAULT_CHECK_IN_MINUTES = 14 * 60;
export const CALENDAR_DEFAULT_CHECK_OUT_MINUTES = 11 * 60;

/** Visible hour window for week/day grids (inclusive start, exclusive end). */
export const CALENDAR_GRID_HOUR_START = 6;
export const CALENDAR_GRID_HOUR_END = 24;

export const CALENDAR_PX_PER_HOUR = 52;
/** Space above the first hour line so labels / early blocks aren’t clipped under the day header. */
export const CALENDAR_GRID_TOP_GUTTER_PX = 14;

export type CalendarPeriod = 'month' | 'week' | 'day';

export type TimedStaySpanPosition = 'single' | 'start' | 'middle' | 'end';

export type TimedStaySlice<T> = {
  item: T;
  /** Inclusive start, minutes from midnight on this calendar day. */
  startMin: number;
  /** Exclusive end, minutes from midnight on this calendar day. */
  endMin: number;
  /** True when this slice overlaps another booking on the same day (layout). */
  clashes: boolean;
  /** Side-by-side column among overlapping cluster (0-based). */
  column: number;
  /** Total columns in the overlapping cluster. */
  columnCount: number;
  /** Where this day sits on the full stay (for seamless multi-night chrome). */
  spanPosition: TimedStaySpanPosition;
};

/** Position of `day` within a stay for continuous week/day block styling. */
export function staySpanPositionOnDay(
  stayStart: Date,
  stayEnd: Date,
  day: Date
): TimedStaySpanPosition {
  const dayStart = startOfDay(day);
  const isStart = isSameDay(stayStart, dayStart);
  const isEnd = stayEnd > dayStart && stayEnd <= addDays(dayStart, 1);
  if (isStart && isEnd) return 'single';
  if (isStart) return 'start';
  if (isEnd) return 'end';
  return 'middle';
}

/** Parse guest time strings (`HH:mm`, `h:mm A`, etc.) → minutes from midnight. */
export function parseStayTimeToMinutes(
  value: string | null | undefined,
  fallbackMinutes: number
): number {
  const raw = (value ?? '').trim();
  if (!raw) return fallbackMinutes;
  const hm = toGuestSubmissionTime(raw);
  if (!/^\d{2}:\d{2}$/.test(hm)) return fallbackMinutes;
  const [h, m] = hm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return fallbackMinutes;
  return Math.min(23 * 60 + 59, Math.max(0, h * 60 + m));
}

export function bookingStayBounds<T>(
  item: T,
  getCheckIn: (item: T) => string | null | undefined,
  getCheckOut: (item: T) => string | null | undefined,
  getCheckInTime: (item: T) => string | null | undefined,
  getCheckOutTime: (item: T) => string | null | undefined
): { start: Date; end: Date; startMin: number; endMin: number } | null {
  const checkInDate = parseOccupancyDate(getCheckIn(item));
  const checkOutDate = parseOccupancyDate(getCheckOut(item));
  if (!checkInDate || !checkOutDate || checkInDate > checkOutDate) return null;

  const startMin = parseStayTimeToMinutes(getCheckInTime(item), CALENDAR_DEFAULT_CHECK_IN_MINUTES);
  const endMin = parseStayTimeToMinutes(getCheckOutTime(item), CALENDAR_DEFAULT_CHECK_OUT_MINUTES);

  const start = new Date(checkInDate);
  start.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0);

  const end = new Date(checkOutDate);
  end.setHours(Math.floor(endMin / 60), endMin % 60, 0, 0);

  if (end <= start) return null;
  return { start, end, startMin, endMin };
}

/**
 * Slice a stay onto one calendar day for the hour grid.
 * Check-in day: check-in → 24:00 · middle nights: 00:00 → 24:00 · check-out day: 00:00 → check-out.
 */
export function sliceStayOntoDay(
  stayStart: Date,
  stayEnd: Date,
  day: Date
): { startMin: number; endMin: number } | null {
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);
  const sliceStart = stayStart > dayStart ? stayStart : dayStart;
  const sliceEnd = stayEnd < dayEnd ? stayEnd : dayEnd;
  if (sliceEnd <= sliceStart) return null;

  const startMin = (sliceStart.getTime() - dayStart.getTime()) / 60000;
  const endMin = (sliceEnd.getTime() - dayStart.getTime()) / 60000;
  return {
    startMin: Math.max(0, Math.min(24 * 60, startMin)),
    endMin: Math.max(0, Math.min(24 * 60, endMin)),
  };
}

type LayoutSliceInput<T> = {
  item: T;
  startMin: number;
  endMin: number;
  spanPosition: TimedStaySpanPosition;
};

/** Assign side-by-side columns for overlapping slices (Google Calendar–style). */
export function layoutTimedSlices<T>(slices: LayoutSliceInput<T>[]): TimedStaySlice<T>[] {
  if (slices.length === 0) return [];

  const sorted = [...slices].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);

  type Cluster = {
    slices: typeof sorted;
    endMax: number;
  };

  const clusters: Cluster[] = [];
  for (const slice of sorted) {
    const last = clusters[clusters.length - 1];
    if (!last || slice.startMin >= last.endMax) {
      clusters.push({ slices: [slice], endMax: slice.endMin });
    } else {
      last.slices.push(slice);
      last.endMax = Math.max(last.endMax, slice.endMin);
    }
  }

  const result: TimedStaySlice<T>[] = [];

  for (const cluster of clusters) {
    const columns: Array<{ endMin: number }> = [];
    const assigned: Array<{ slice: (typeof sorted)[number]; column: number }> = [];

    for (const slice of cluster.slices) {
      let placed = false;
      for (let col = 0; col < columns.length; col++) {
        if (columns[col].endMin <= slice.startMin) {
          columns[col].endMin = slice.endMin;
          assigned.push({ slice, column: col });
          placed = true;
          break;
        }
      }
      if (!placed) {
        columns.push({ endMin: slice.endMin });
        assigned.push({ slice, column: columns.length - 1 });
      }
    }

    const columnCount = columns.length;
    const clashes = columnCount > 1;

    for (const entry of assigned) {
      result.push({
        item: entry.slice.item,
        startMin: entry.slice.startMin,
        endMin: entry.slice.endMin,
        clashes,
        column: entry.column,
        columnCount,
        spanPosition: entry.slice.spanPosition,
      });
    }
  }

  return result;
}

export function buildTimedSlicesForDay<T>(
  rows: T[],
  day: Date,
  getCheckIn: (item: T) => string | null | undefined,
  getCheckOut: (item: T) => string | null | undefined,
  getCheckInTime: (item: T) => string | null | undefined,
  getCheckOutTime: (item: T) => string | null | undefined
): TimedStaySlice<T>[] {
  const raw: LayoutSliceInput<T>[] = [];

  for (const item of rows) {
    const bounds = bookingStayBounds(
      item,
      getCheckIn,
      getCheckOut,
      getCheckInTime,
      getCheckOutTime
    );
    if (!bounds) continue;
    const slice = sliceStayOntoDay(bounds.start, bounds.end, day);
    if (!slice || slice.endMin - slice.startMin < 1) continue;
    raw.push({
      item,
      startMin: slice.startMin,
      endMin: slice.endMin,
      spanPosition: staySpanPositionOnDay(bounds.start, bounds.end, day),
    });
  }

  return layoutTimedSlices(raw);
}

export function weekDaysFor(anchor: Date): Date[] {
  const start = startOfWeek(anchor, { weekStartsOn: 0 });
  const end = endOfWeek(anchor, { weekStartsOn: 0 });
  return eachDayOfInterval({ start, end });
}

export function calendarGridHours(): number[] {
  const hours: number[] = [];
  for (let h = CALENDAR_GRID_HOUR_START; h < CALENDAR_GRID_HOUR_END; h++) {
    hours.push(h);
  }
  return hours;
}

export function formatHourLabel(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

export function minutesToTopPx(minutesFromMidnight: number): number {
  const clamped = Math.max(
    CALENDAR_GRID_HOUR_START * 60,
    Math.min(CALENDAR_GRID_HOUR_END * 60, minutesFromMidnight)
  );
  return (
    CALENDAR_GRID_TOP_GUTTER_PX +
    ((clamped - CALENDAR_GRID_HOUR_START * 60) / 60) * CALENDAR_PX_PER_HOUR
  );
}

export function durationToHeightPx(startMin: number, endMin: number): number {
  const top = minutesToTopPx(startMin);
  const bottom = minutesToTopPx(endMin);
  return Math.max(18, bottom - top);
}

export function calendarGridBodyHeightPx(): number {
  return (
    CALENDAR_GRID_TOP_GUTTER_PX +
    (CALENDAR_GRID_HOUR_END - CALENDAR_GRID_HOUR_START) * CALENDAR_PX_PER_HOUR
  );
}

export function isSameCalendarDay(a: Date, b: Date): boolean {
  return isSameDay(a, b);
}

export function dayKey(day: Date): string {
  return format(day, 'yyyy-MM-dd');
}

/** Detect whether two absolute stays overlap (true clash). */
export function staysOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function markClashingRows<T>(
  rows: T[],
  getCheckIn: (item: T) => string | null | undefined,
  getCheckOut: (item: T) => string | null | undefined,
  getCheckInTime: (item: T) => string | null | undefined,
  getCheckOutTime: (item: T) => string | null | undefined,
  getKey: (item: T) => string
): Set<string> {
  const bounds = rows
    .map((item) => {
      const b = bookingStayBounds(item, getCheckIn, getCheckOut, getCheckInTime, getCheckOutTime);
      return b ? { item, ...b, key: getKey(item) } : null;
    })
    .filter(Boolean) as Array<{
    item: T;
    start: Date;
    end: Date;
    key: string;
  }>;

  const clashKeys = new Set<string>();
  for (let i = 0; i < bounds.length; i++) {
    for (let j = i + 1; j < bounds.length; j++) {
      if (staysOverlap(bounds[i].start, bounds[i].end, bounds[j].start, bounds[j].end)) {
        clashKeys.add(bounds[i].key);
        clashKeys.add(bounds[j].key);
      }
    }
  }
  return clashKeys;
}
