import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  addYears,
  subYears,
  format,
  isSameDay,
  isSameMonth,
  isThisWeek,
  isThisMonth,
  isThisYear,
} from 'date-fns';

import { formatDateRangeFromDates } from '@/utils/format/dates';

export type DatePreset = 'week' | 'month' | 'year' | 'custom';

export interface DateRange {
  from: Date;
  to: Date;
}

/** Props interface that any date navigation consumer must provide. */
export interface DateNavigationState {
  dateRange: DateRange;
  datePreset: DatePreset;
  setDatePreset: (preset: DatePreset) => void;
  setDateRange: (range: DateRange) => void;
  navigatePeriod: (direction: 'prev' | 'next') => void;
  goToToday: () => void;
}

/**
 * Infer week / month / year preset from an applied range so URL-hydrated
 * filters still show "June 2026" + ←/→ instead of a custom "Jun 1 – 30" label.
 */
export function detectPresetFromRange(from: Date, to: Date): DatePreset {
  const weekStart = startOfWeek(from, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(from, { weekStartsOn: 0 });
  if (isSameDay(from, weekStart) && isSameDay(to, weekEnd)) {
    return 'week';
  }

  const monthStart = startOfMonth(from);
  const monthEnd = endOfMonth(from);
  if (isSameDay(from, monthStart) && isSameDay(to, monthEnd) && isSameMonth(from, to)) {
    return 'month';
  }

  const yearStart = startOfYear(from);
  const yearEnd = endOfYear(from);
  if (isSameDay(from, yearStart) && isSameDay(to, yearEnd)) {
    return 'year';
  }

  return 'custom';
}

export function getDateRangeFromPreset(preset: DatePreset, referenceDate: Date): DateRange {
  switch (preset) {
    case 'week':
      // Sunday-first week (Sun → Sat) to match the calendar + range picker.
      return {
        from: startOfWeek(referenceDate, { weekStartsOn: 0 }),
        to: endOfWeek(referenceDate, { weekStartsOn: 0 }),
      };
    case 'month':
      return {
        from: startOfMonth(referenceDate),
        to: endOfMonth(referenceDate),
      };
    case 'year':
      return {
        from: startOfYear(referenceDate),
        to: endOfYear(referenceDate),
      };
    case 'custom':
    default:
      return {
        from: startOfMonth(referenceDate),
        to: endOfMonth(referenceDate),
      };
  }
}

export function navigateReferenceDate(
  referenceDate: Date,
  preset: DatePreset,
  direction: 'prev' | 'next'
): Date {
  switch (preset) {
    case 'week':
      return direction === 'next' ? addWeeks(referenceDate, 1) : subWeeks(referenceDate, 1);
    case 'month':
      return direction === 'next' ? addMonths(referenceDate, 1) : subMonths(referenceDate, 1);
    case 'year':
      return direction === 'next' ? addYears(referenceDate, 1) : subYears(referenceDate, 1);
    case 'custom':
    default:
      return referenceDate;
  }
}

/**
 * Format the date range display for the selected preset.
 * Adapted verbatim from property-management-app's `formatDateRangeDisplay`
 * so behavior matches the calendar dashboard exactly.
 */
export type DateRangeDisplayOptions = {
  /** Shorter month labels (e.g. Sep 2026) for narrow dashboard chrome. */
  compact?: boolean;
};

export function formatDateRangeDisplay(
  from: Date,
  to: Date,
  preset: DatePreset,
  options?: DateRangeDisplayOptions
): string {
  const compact = options?.compact ?? false;
  switch (preset) {
    case 'week':
    case 'custom':
    default:
      return formatDateRangeFromDates(from, to);
    case 'month': {
      return format(from, compact ? 'MMM yyyy' : 'MMMM yyyy');
    }
    case 'year': {
      return format(from, 'yyyy');
    }
  }
}

export function isCurrentPeriod(from: Date, preset: DatePreset): boolean {
  switch (preset) {
    case 'week':
      return isThisWeek(from, { weekStartsOn: 0 });
    case 'month':
      return isThisMonth(from);
    case 'year':
      return isThisYear(from);
    default:
      return false;
  }
}

/** Format a Date as YYYY-MM-DD (used for URL params + edge function query). */
export function toIsoDate(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

/** Parse a YYYY-MM-DD string into a Date at local midnight. Returns null on bad input. */
export function fromIsoDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return Number.isNaN(date.getTime()) ? null : date;
}
