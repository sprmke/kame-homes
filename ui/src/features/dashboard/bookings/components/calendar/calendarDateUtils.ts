import {
  addDays,
  differenceInCalendarMonths,
  eachDayOfInterval,
  format,
  getDay,
  isSameDay,
  parse,
  startOfMonth,
  subDays,
} from 'date-fns';

import type { DatePreset } from '@/lib/date/navigation';

/** Parse MM-DD-YYYY or YYYY-MM-DD stay dates from the DB. */
export function parseOccupancyDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = parse(value, 'yyyy-MM-dd', new Date());
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (/^\d{2}-\d{2}-\d{4}$/.test(value)) {
    const d = parse(value, 'MM-dd-yyyy', new Date());
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Map each occupied calendar night to its rows.
 * Checkout morning is not an overnight — dates are [check-in, check-out).
 */
/** Map each row to a single calendar day (transactions, maintenance reminders). */
export function buildItemsByDate<T>(
  rows: T[],
  getDate: (row: T) => string | null | undefined
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const parsed = parseOccupancyDate(getDate(row));
    if (!parsed) continue;
    const key = format(parsed, 'yyyy-MM-dd');
    const existing = map.get(key);
    if (existing) existing.push(row);
    else map.set(key, [row]);
  }
  return map;
}

export function buildOccupancyByDay<T>(
  rows: T[],
  getCheckIn: (row: T) => string | null | undefined,
  getCheckOut: (row: T) => string | null | undefined
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const start = parseOccupancyDate(getCheckIn(row));
    const end = parseOccupancyDate(getCheckOut(row));
    if (!start || !end || start >= end) continue;
    const lastNight = subDays(end, 1);
    const days = eachDayOfInterval({ start, end: lastNight });
    for (const day of days) {
      const key = format(day, 'yyyy-MM-dd');
      const existing = map.get(key);
      if (existing) existing.push(row);
      else map.set(key, [row]);
    }
  }
  return map;
}

export const CALENDAR_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export type CalendarWeekRow = {
  weekIndex: number;
  /** Seven calendar days (includes adjacent-month dates so weeks are never empty pads). */
  days: Date[];
};

export type OccupancySegment<T> = {
  item: T;
  weekIndex: number;
  startCol: number;
  endCol: number;
  lane: number;
  /** Guest/price label at the start of each week fragment (continuations stay readable). */
  showLabel: boolean;
  spanStart: boolean;
  spanEnd: boolean;
};

export type CalendarOccupancySpanPosition = 'single' | 'start' | 'middle' | 'end';

export function calendarOccupancySpanPosition(segment: {
  spanStart: boolean;
  spanEnd: boolean;
}): CalendarOccupancySpanPosition {
  if (segment.spanStart && segment.spanEnd) return 'single';
  if (segment.spanStart) return 'start';
  if (segment.spanEnd) return 'end';
  return 'middle';
}

/**
 * Week rows for a month/range grid (Sunday-first, 7 columns).
 * Leading/trailing slots are real adjacent-month dates — never null grey pads.
 */
export function buildCalendarWeekRows(days: Date[], paddingStart: number): CalendarWeekRow[] {
  if (days.length === 0) return [];

  const first = days[0];
  const last = days[days.length - 1];
  const rangeStart = subDays(first, paddingStart);
  const totalWithoutTrailing = paddingStart + days.length;
  const paddingEnd = (7 - (totalWithoutTrailing % 7)) % 7;
  const rangeEnd = addDays(last, paddingEnd);
  const allDays = eachDayOfInterval({ start: rangeStart, end: rangeEnd });

  const weeks: CalendarWeekRow[] = [];
  for (let index = 0; index < allDays.length; index += 7) {
    weeks.push({
      weekIndex: weeks.length,
      days: allDays.slice(index, index + 7),
    });
  }
  return weeks;
}

function occupiedNightRange<T>(
  row: T,
  getCheckIn: (row: T) => string | null | undefined,
  getCheckOut: (row: T) => string | null | undefined
): { start: Date; end: Date } | null {
  const start = parseOccupancyDate(getCheckIn(row));
  const end = parseOccupancyDate(getCheckOut(row));
  if (!start || !end || start >= end) return null;
  return { start, end: subDays(end, 1) };
}

function assignOccupancyLanes<T>(
  segments: Omit<OccupancySegment<T>, 'lane'>[]
): OccupancySegment<T>[] {
  const sorted = [...segments].sort((a, b) => a.startCol - b.startCol || a.endCol - b.endCol);
  const laneEnds: number[] = [];

  return sorted.map((segment) => {
    let lane = laneEnds.findIndex((endCol) => endCol < segment.startCol);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(segment.endCol);
    } else {
      laneEnds[lane] = segment.endCol;
    }
    return { ...segment, lane };
  });
}

function assignOccupancyLanesPerDay<T>(
  week: CalendarWeekRow,
  rows: T[],
  getCheckIn: (row: T) => string | null | undefined,
  getCheckOut: (row: T) => string | null | undefined,
  compareItems: (a: T, b: T) => number
): OccupancySegment<T>[] {
  const rangeByItem = new Map<T, { start: Date; end: Date }>();
  const itemsByCol: T[][] = Array.from({ length: 7 }, () => []);

  for (const row of rows) {
    const range = occupiedNightRange(row, getCheckIn, getCheckOut);
    if (!range) continue;
    rangeByItem.set(row, range);
    for (let col = 0; col < 7; col++) {
      const day = week.days[col];
      if (!day || day < range.start || day > range.end) continue;
      itemsByCol[col].push(row);
    }
  }

  const laneByItemCol = new Map<T, number[]>();
  for (let col = 0; col < 7; col++) {
    const items = [...itemsByCol[col]].sort(compareItems);
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item) continue;
      let lanes = laneByItemCol.get(item);
      if (!lanes) {
        lanes = Array.from({ length: 7 }, () => -1);
        laneByItemCol.set(item, lanes);
      }
      // Lane 0 is the bottom-most visible row for that day; larger lanes stack upward.
      lanes[col] = i;
    }
  }

  const segments: OccupancySegment<T>[] = [];
  for (const [item, lanes] of laneByItemCol) {
    const range = rangeByItem.get(item);
    if (!range) continue;
    let col = 0;
    while (col < 7) {
      const lane = lanes[col] ?? -1;
      if (lane < 0) {
        col += 1;
        continue;
      }
      let endCol = col;
      while (endCol + 1 < 7 && lanes[endCol + 1] === lane) endCol += 1;
      const startDay = week.days[col];
      const endDay = week.days[endCol];
      if (startDay && endDay) {
        segments.push({
          item,
          weekIndex: week.weekIndex,
          startCol: col,
          endCol,
          lane,
          showLabel: true,
          spanStart: isSameDay(startDay, range.start),
          spanEnd: isSameDay(endDay, range.end),
        });
      }
      col = endCol + 1;
    }
  }

  return segments;
}

/** Multi-night stays become one bar segment per calendar week row (not one pill per cell). */
export function buildOccupancySegmentsForWeeks<T>(
  rows: T[],
  weeks: CalendarWeekRow[],
  getCheckIn: (row: T) => string | null | undefined,
  getCheckOut: (row: T) => string | null | undefined,
  compareItems?: (a: T, b: T) => number
): Map<number, OccupancySegment<T>[]> {
  const segmentsByWeek = new Map<number, OccupancySegment<T>[]>();

  for (const week of weeks) {
    if (compareItems) {
      segmentsByWeek.set(
        week.weekIndex,
        assignOccupancyLanesPerDay(week, rows, getCheckIn, getCheckOut, compareItems)
      );
      continue;
    }

    const raw: Omit<OccupancySegment<T>, 'lane'>[] = [];

    for (const row of rows) {
      const range = occupiedNightRange(row, getCheckIn, getCheckOut);
      if (!range) continue;

      let startCol: number | null = null;
      let endCol: number | null = null;

      for (let col = 0; col < 7; col++) {
        const day = week.days[col];
        if (!day) continue;
        if (day < range.start || day > range.end) continue;
        if (startCol === null) startCol = col;
        endCol = col;
      }

      if (startCol === null || endCol === null) continue;

      const spanStart = isSameDay(week.days[startCol]!, range.start);
      const spanEnd = isSameDay(week.days[endCol]!, range.end);

      raw.push({
        item: row,
        weekIndex: week.weekIndex,
        startCol,
        endCol,
        // Label each week fragment so multi-week stays stay readable (no empty bars).
        showLabel: true,
        spanStart,
        spanEnd,
      });
    }

    segmentsByWeek.set(week.weekIndex, assignOccupancyLanes(raw));
  }

  return segmentsByWeek;
}

export type CalendarVisibleRange = {
  from: Date;
  to: Date;
};

/** Leading empty cells before the first day of a month/range grid. */
export function calendarPaddingStart(date: Date, weekStartsOn: 0 | 1 = 0): number {
  const weekday = getDay(date);
  if (weekStartsOn === 1) return weekday === 0 ? 6 : weekday - 1;
  return weekday;
}

/** Week-aligned day list for a visible date range (dashboard filter). */
export function buildRangeCalendarDays(range: CalendarVisibleRange): {
  days: Date[];
  paddingStart: number;
} {
  const days = eachDayOfInterval({ start: range.from, end: range.to });
  return { days, paddingStart: calendarPaddingStart(range.from) };
}

/** Name/Price pills only fit single-month cells; year and multi-month views use dots or dense grids. */
export function calendarSupportsPillLabelToggle(
  datePreset: DatePreset,
  rangeFrom: Date | null,
  rangeTo: Date | null
): boolean {
  if (datePreset === 'year') return false;
  if (!rangeFrom || !rangeTo) return true;
  return differenceInCalendarMonths(startOfMonth(rangeTo), startOfMonth(rangeFrom)) === 0;
}
