export type RecurrenceInterval =
  | 'none'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'twice_monthly'
  | 'every_2_months'
  | 'quarterly'
  | 'every_6_months'
  | 'yearly';

export type RecurrenceEditScope = 'this' | 'this_and_future' | 'all';

export type FinanceReminderInterval =
  'hourly' | 'every_2_hours' | 'every_4_hours' | 'every_12_hours' | 'daily_noon';

export const FINANCE_REMINDER_INTERVAL_OPTIONS: {
  value: FinanceReminderInterval;
  label: string;
  description: string;
}[] = [
  {
    value: 'hourly',
    label: 'Every hour',
    description: 'Up to one reminder per hour in the days-before window through the due date.',
  },
  {
    value: 'every_2_hours',
    label: 'Every 2 hours',
    description: 'Up to one reminder every 2 hours in that window.',
  },
  {
    value: 'every_4_hours',
    label: 'Every 4 hours',
    description: 'Up to one reminder every 4 hours in that window.',
  },
  {
    value: 'every_12_hours',
    label: 'Every 12 hours',
    description: 'Up to one reminder every 12 hours in that window.',
  },
  {
    value: 'daily_noon',
    label: 'Daily at 12:00 PM',
    description: 'One reminder each day at noon, Manila time.',
  },
];

/** Coerce API/legacy values to a supported reminder interval. */
export function normalizeFinanceReminderInterval(
  interval: string | null | undefined
): FinanceReminderInterval {
  const v = typeof interval === 'string' ? interval.trim().toLowerCase() : interval;
  if (
    v === 'hourly' ||
    v === 'every_2_hours' ||
    v === 'every_4_hours' ||
    v === 'every_12_hours' ||
    v === 'daily_noon'
  ) {
    return v;
  }
  if (v === 'once' || v === 'daily' || v === 'weekly' || v === 'until_paid') {
    return 'daily_noon';
  }
  return 'daily_noon';
}

export const RECURRENCE_INTERVAL_OPTIONS: {
  value: RecurrenceInterval;
  label: string;
}[] = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'twice_monthly', label: 'Twice a month' },
  { value: 'every_2_months', label: 'Every 2 months' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'every_6_months', label: 'Twice a year' },
  { value: 'yearly', label: 'Yearly' },
];

export const RECURRENCE_SCOPE_OPTIONS: {
  value: RecurrenceEditScope;
  label: string;
  description: string;
}[] = [
  {
    value: 'this',
    label: 'This occurrence only',
    description: 'Update or delete only the selected date.',
  },
  {
    value: 'this_and_future',
    label: 'This and future',
    description: 'Apply from this date forward in the series.',
  },
  {
    value: 'all',
    label: 'All occurrences',
    description: 'Apply to every past and future entry in the series.',
  },
];

export function recurrenceIntervalLabel(
  interval: RecurrenceInterval | string | null | undefined
): string | null {
  if (!interval || interval === 'none') return null;
  return RECURRENCE_INTERVAL_OPTIONS.find((o) => o.value === interval)?.label ?? interval;
}

/** True when repeat interval or series end changed on a recurring edit. */
export function isRecurrenceScheduleDirty(params: {
  isRecurringEdit: boolean;
  recurrenceInterval: RecurrenceInterval;
  recurrenceUntil?: string;
  initialInterval: RecurrenceInterval | string | null | undefined;
  initialUntil?: string | null;
}): boolean {
  if (!params.isRecurringEdit) return false;
  const initial =
    !params.initialInterval || params.initialInterval === 'none' ? 'none' : params.initialInterval;
  const untilA = params.recurrenceUntil?.slice(0, 10) ?? '';
  const untilB = params.initialUntil?.slice(0, 10) ?? '';
  return params.recurrenceInterval !== initial || untilA !== untilB;
}

/** Scope + recurrence patch when updating a recurring row. */
export function recurrenceScheduleUpdateFields(params: {
  hasSeries: boolean;
  recurrenceInterval: RecurrenceInterval;
  recurrenceUntil?: string;
  initialInterval: RecurrenceInterval | string | null | undefined;
  initialUntil?: string | null;
  editScope: RecurrenceEditScope;
}): {
  scope: RecurrenceEditScope;
  recurrence_interval?: RecurrenceInterval;
  recurrence_until?: string | null;
} {
  if (!params.hasSeries) return { scope: 'this' };

  const scheduleDirty = isRecurrenceScheduleDirty({
    isRecurringEdit: true,
    recurrenceInterval: params.recurrenceInterval,
    recurrenceUntil: params.recurrenceUntil,
    initialInterval: params.initialInterval,
    initialUntil: params.initialUntil,
  });

  if (scheduleDirty) {
    // A repeat interval / end-date change is a series-level property — "this
    // occurrence only" can't carry it, so fall back to "this and future" rather
    // than always widening to "all" for a host who explicitly chose the narrower
    // valid scope.
    return {
      scope: params.editScope === 'this' ? 'this_and_future' : params.editScope,
      recurrence_interval: params.recurrenceInterval,
      recurrence_until: params.recurrenceUntil ?? null,
    };
  }

  return { scope: params.editScope };
}

function parseIso(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
}

function formatIso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

function twiceMonthlySlots(
  primaryDay: number,
  y: number,
  m: number
): { first: number; second: number } {
  const dim = daysInMonth(y, m);
  const first = Math.min(primaryDay, dim);
  const second = Math.min(primaryDay + 15, dim);
  return { first, second };
}

function addTwiceMonthly(iso: string, primaryDay: number): string {
  const { y, m, d } = parseIso(iso);
  const { first, second } = twiceMonthlySlots(primaryDay, y, m);
  if (d === first && second > first) {
    return formatIso(y, m, second);
  }
  let nm = m + 1;
  let ny = y;
  if (nm > 12) {
    nm = 1;
    ny += 1;
  }
  const { first: nextFirst } = twiceMonthlySlots(primaryDay, ny, nm);
  return formatIso(ny, nm, nextFirst);
}

function subtractTwiceMonthly(iso: string, primaryDay: number): string {
  const { y, m, d } = parseIso(iso);
  const { first, second } = twiceMonthlySlots(primaryDay, y, m);
  if (d === second && second > first) {
    return formatIso(y, m, first);
  }
  let nm = m - 1;
  let ny = y;
  if (nm < 1) {
    nm = 12;
    ny -= 1;
  }
  const { first: prevFirst, second: prevSecond } = twiceMonthlySlots(primaryDay, ny, nm);
  return formatIso(ny, nm, prevSecond > prevFirst ? prevSecond : prevFirst);
}

function addInterval(
  iso: string,
  interval: Exclude<RecurrenceInterval, 'none'>,
  primaryDay?: number
): string {
  const { y, m, d } = parseIso(iso);
  const date = new Date(y, m - 1, d);
  switch (interval) {
    case 'daily':
      date.setDate(date.getDate() + 1);
      break;
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'monthly': {
      const day = date.getDate();
      date.setMonth(date.getMonth() + 1);
      const last = daysInMonth(date.getFullYear(), date.getMonth() + 1);
      date.setDate(Math.min(day, last));
      break;
    }
    case 'twice_monthly':
      return addTwiceMonthly(iso, primaryDay ?? d);
    case 'every_2_months': {
      const day = date.getDate();
      date.setMonth(date.getMonth() + 2);
      const last = daysInMonth(date.getFullYear(), date.getMonth() + 1);
      date.setDate(Math.min(day, last));
      break;
    }
    case 'quarterly': {
      const day = date.getDate();
      date.setMonth(date.getMonth() + 3);
      const last = daysInMonth(date.getFullYear(), date.getMonth() + 1);
      date.setDate(Math.min(day, last));
      break;
    }
    case 'every_6_months': {
      const day = date.getDate();
      date.setMonth(date.getMonth() + 6);
      const last = daysInMonth(date.getFullYear(), date.getMonth() + 1);
      date.setDate(Math.min(day, last));
      break;
    }
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1);
      break;
  }
  return formatIso(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function subtractInterval(
  iso: string,
  interval: Exclude<RecurrenceInterval, 'none'>,
  primaryDay?: number
): string {
  const { y, m, d } = parseIso(iso);
  const date = new Date(y, m - 1, d);
  switch (interval) {
    case 'daily':
      date.setDate(date.getDate() - 1);
      break;
    case 'weekly':
      date.setDate(date.getDate() - 7);
      break;
    case 'monthly': {
      const day = date.getDate();
      date.setMonth(date.getMonth() - 1);
      const last = daysInMonth(date.getFullYear(), date.getMonth() + 1);
      date.setDate(Math.min(day, last));
      break;
    }
    case 'twice_monthly':
      return subtractTwiceMonthly(iso, primaryDay ?? d);
    case 'every_2_months': {
      const day = date.getDate();
      date.setMonth(date.getMonth() - 2);
      const last = daysInMonth(date.getFullYear(), date.getMonth() + 1);
      date.setDate(Math.min(day, last));
      break;
    }
    case 'quarterly': {
      const day = date.getDate();
      date.setMonth(date.getMonth() - 3);
      const last = daysInMonth(date.getFullYear(), date.getMonth() + 1);
      date.setDate(Math.min(day, last));
      break;
    }
    case 'every_6_months': {
      const day = date.getDate();
      date.setMonth(date.getMonth() - 6);
      const last = daysInMonth(date.getFullYear(), date.getMonth() + 1);
      date.setDate(Math.min(day, last));
      break;
    }
    case 'yearly':
      date.setFullYear(date.getFullYear() - 1);
      break;
  }
  return formatIso(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/** Default target when extending a series earlier (12 steps back). */
export function suggestExtendBefore(
  seriesStart: string,
  interval: Exclude<RecurrenceInterval, 'none'>
): string {
  const primaryDay = parseIso(seriesStart).d;
  let cur = seriesStart;
  for (let i = 0; i < 12; i += 1) {
    cur = subtractInterval(cur, interval, primaryDay);
  }
  return cur;
}

/** Default target when extending a series later (12 steps forward). */
export function suggestExtendAfter(
  seriesEnd: string,
  interval: Exclude<RecurrenceInterval, 'none'>,
  seriesStart?: string
): string {
  const primaryDay = parseIso(seriesStart ?? seriesEnd).d;
  let cur = seriesEnd;
  for (let i = 0; i < 12; i += 1) {
    cur = addInterval(cur, interval, primaryDay);
  }
  return cur;
}

function addDaysToIso(iso: string, delta: number): string {
  const { y, m, d } = parseIso(iso);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + delta);
  return formatIso(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function generateRecurrenceDates(
  start: string,
  interval: Exclude<RecurrenceInterval, 'none'>,
  until: string,
  maxCount = 500,
  seriesPrimaryDay?: number
): string[] {
  if (until < start) return [start];
  const primaryDay = seriesPrimaryDay ?? parseIso(start).d;
  const dates: string[] = [];
  let cur = start;
  while (cur <= until && dates.length < maxCount) {
    dates.push(cur);
    const next = addInterval(cur, interval, primaryDay);
    if (next <= cur) break;
    cur = next;
  }
  return dates;
}

export type TelegramReminderWindow = {
  windowStart: string;
  windowEnd: string;
};

export type TelegramReminderSchedulePreview = {
  windows: TelegramReminderWindow[];
  totalCount: number;
  isRecurring: boolean;
  recurrenceLabel: string | null;
  seriesEndDate: string | null;
};

/** Preview reminder send windows from the line-item date + repeat settings. */
export function buildTelegramReminderSchedule(params: {
  anchorDate: string;
  recurrenceInterval: RecurrenceInterval;
  recurrenceUntil?: string;
  daysBefore: number;
  singleOccurrenceOnly?: boolean;
  maxPreview?: number;
}): TelegramReminderSchedulePreview | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.anchorDate)) return null;

  const daysBefore = Math.max(0, Math.min(90, params.daysBefore));
  const windowForDue = (due: string): TelegramReminderWindow => ({
    windowStart: addDaysToIso(due, -daysBefore),
    windowEnd: due,
  });

  if (params.singleOccurrenceOnly || params.recurrenceInterval === 'none') {
    return {
      windows: [windowForDue(params.anchorDate)],
      totalCount: 1,
      isRecurring: false,
      recurrenceLabel: null,
      seriesEndDate: null,
    };
  }

  const until = params.recurrenceUntil?.slice(0, 10);
  if (!until || until < params.anchorDate) return null;

  const dates = generateRecurrenceDates(params.anchorDate, params.recurrenceInterval, until);
  if (dates.length === 0) return null;

  const maxPreview = params.maxPreview ?? 3;
  return {
    windows: dates.slice(0, maxPreview).map(windowForDue),
    totalCount: dates.length,
    isRecurring: true,
    recurrenceLabel: recurrenceIntervalLabel(params.recurrenceInterval),
    seriesEndDate: dates[dates.length - 1] ?? null,
  };
}

export function reminderIntervalLabel(interval: FinanceReminderInterval): string {
  return FINANCE_REMINDER_INTERVAL_OPTIONS.find((o) => o.value === interval)?.label ?? interval;
}

/** Suggested end date when creating a new recurring series. */
export function defaultRecurrenceUntil(
  start: string,
  interval: Exclude<RecurrenceInterval, 'none'>
): string {
  if (interval === 'daily') {
    let cur = start;
    for (let i = 0; i < 89; i++) cur = addInterval(cur, interval);
    return cur;
  }
  if (interval === 'weekly') {
    let cur = start;
    for (let i = 0; i < 51; i++) cur = addInterval(cur, interval);
    return cur;
  }
  const { y, m, d } = parseIso(start);
  if (
    interval === 'monthly' ||
    interval === 'twice_monthly' ||
    interval === 'every_2_months' ||
    interval === 'quarterly'
  ) {
    const months = 24;
    const date = new Date(y, m - 1 + months, Math.min(d, 28));
    return formatIso(date.getFullYear(), date.getMonth() + 1, date.getDate());
  }
  return formatIso(y + 5, m, Math.min(d, daysInMonth(y + 5, m)));
}
