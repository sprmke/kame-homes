import type { DatePreset } from '@/lib/date/navigation';

/** One key per tenant and page, so a year on the dashboard does not rewrite bookings. */
export type DateViewSurface = 'dashboard' | 'bookings' | 'finance' | 'maintenance' | 'analytics';

export type StoredDatePreset = DatePreset | 'all';

export type RememberedDateRange = {
  preset: StoredDatePreset;
  from: string;
  to: string;
};

export type DateRangeStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

const RANGE_PREFIX = 'kh-date-range:v1:';
const CALENDAR_PERIOD_PREFIX = 'kh-calendar-period:v1:';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const PRESETS = new Set<StoredDatePreset>(['week', 'month', 'year', 'custom', 'all']);
const CALENDAR_PERIODS = new Set(['month', 'week', 'day']);

export function dateViewScope(input: {
  orgSlug?: string | null;
  propertySlug?: string | null;
  parkingSlug?: string | null;
}): string | null {
  const org = input.orgSlug?.trim();
  if (!org) return null;
  const parking = input.parkingSlug?.trim();
  if (parking) return `parking:${org}:${parking}`;
  const property = input.propertySlug?.trim();
  if (property) return `property:${org}:${property}`;
  return `org:${org}`;
}

function rangeKey(scope: string, surface: DateViewSurface): string {
  return `${RANGE_PREFIX}${surface}:${scope}`;
}

export function browserDateStorage(): DateRangeStorage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

function storageOrBrowser(storage?: DateRangeStorage | null): DateRangeStorage | null {
  if (storage === null) return null;
  return storage ?? browserDateStorage();
}

export function readRememberedDateRange(
  scope: string,
  surface: DateViewSurface,
  storage?: DateRangeStorage | null
): RememberedDateRange | null {
  const store = storageOrBrowser(storage);
  if (!store) return null;
  try {
    const raw = store.getItem(rangeKey(scope, surface));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RememberedDateRange>;
    if (!parsed.preset || !PRESETS.has(parsed.preset)) return null;
    if (parsed.preset === 'all') return { preset: 'all', from: '', to: '' };
    if (!isIsoDateParam(parsed.from) || !isIsoDateParam(parsed.to) || parsed.from > parsed.to) {
      return null;
    }
    return { preset: parsed.preset, from: parsed.from, to: parsed.to };
  } catch {
    return null;
  }
}

export function rememberDateRange(
  scope: string,
  surface: DateViewSurface,
  value: RememberedDateRange,
  storage?: DateRangeStorage | null
): void {
  const store = storageOrBrowser(storage);
  if (!store) return;
  if (value.preset !== 'all') {
    if (!isIsoDateParam(value.from) || !isIsoDateParam(value.to) || value.from > value.to) return;
  }
  try {
    store.setItem(rangeKey(scope, surface), JSON.stringify(value));
  } catch {
    // Quota or private mode. The URL still holds the current range.
  }
}

/** Last applied range, ignoring a stored "no filter" choice. */
export function rememberedAppliedRange(
  scope: string | null,
  surface: DateViewSurface,
  storage?: DateRangeStorage | null
): { from: string; to: string; preset: DatePreset } | null {
  if (!scope) return null;
  const saved = readRememberedDateRange(scope, surface, storage);
  if (!saved || saved.preset === 'all') return null;
  return { from: saved.from, to: saved.to, preset: saved.preset };
}

/**
 * URL `from`/`to` win. Otherwise the last range saved for this page.
 * A stored clear (`preset: all`) and a missing key both use `fallback`.
 */
export function resolveRangeWithMemory(
  params: URLSearchParams,
  scope: string | null,
  surface: DateViewSurface,
  fallback: () => { from: string; to: string },
  storage?: DateRangeStorage | null
): { from: string; to: string } {
  const from = params.get('from');
  const to = params.get('to');
  if (isIsoDateParam(from) && isIsoDateParam(to) && from <= to) {
    return { from, to };
  }
  const saved = rememberedAppliedRange(scope, surface, storage);
  if (saved) return { from: saved.from, to: saved.to };
  return fallback();
}

export function readCalendarPeriod(
  scope: string | null,
  storage?: DateRangeStorage | null
): 'month' | 'week' | 'day' | null {
  if (!scope) return null;
  const store = storageOrBrowser(storage);
  if (!store) return null;
  try {
    const value = store.getItem(`${CALENDAR_PERIOD_PREFIX}${scope}`);
    if (value && CALENDAR_PERIODS.has(value)) return value as 'month' | 'week' | 'day';
    return null;
  } catch {
    return null;
  }
}

export function rememberCalendarPeriod(
  scope: string,
  period: 'month' | 'week' | 'day',
  storage?: DateRangeStorage | null
): void {
  const store = storageOrBrowser(storage);
  if (!store || !CALENDAR_PERIODS.has(period)) return;
  try {
    store.setItem(`${CALENDAR_PERIOD_PREFIX}${scope}`, period);
  } catch {
    // Ignore quota failures. The toggle still works for this visit.
  }
}

function isIsoDateParam(value: unknown): value is string {
  return typeof value === 'string' && ISO_DATE.test(value);
}
