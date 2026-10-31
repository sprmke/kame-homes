import { useCallback, useEffect, useRef, useState } from 'react';

import {
  type DatePreset,
  type DateRange,
  type DateNavigationState,
  detectPresetFromRange,
  fromIsoDate,
  getDateRangeFromPreset,
  navigateReferenceDate,
  toIsoDate,
} from '@/lib/date/navigation';

type Options = {
  /** Initial preset when neither `from` nor `to` are present in the URL. */
  initialPreset?: DatePreset;
  /** Initial range parsed from URL (`from`/`to` query params, YYYY-MM-DD). */
  initialRange?: DateRange | null;
};

/**
 * Generic hook for date navigation state. Mirrors the
 * `useDateNavigation` from property-management-app (apps/web/src/hooks/use-date-navigation.ts)
 * with two small adaptations for this repo:
 *
 * 1. Accepts `initialRange` so the hook can be hydrated from URL search params
 *    (this app stores filter state in the URL, not Zustand).
 * 2. Exposes the current ISO `{from, to}` strings via `getIsoRange()` for the
 *    Supabase edge function which expects `YYYY-MM-DD`.
 */
export function useDateNavigation(options: Options = {}): DateNavigationState {
  const { initialPreset = 'month', initialRange = null } = options;

  const [datePreset, setDatePresetState] = useState<DatePreset>(() => {
    if (!initialRange) return initialPreset;
    return detectPresetFromRange(initialRange.from, initialRange.to);
  });
  const [dateRange, setDateRangeState] = useState<DateRange>(
    () => initialRange ?? getDateRangeFromPreset(initialPreset, new Date())
  );
  const [, setReferenceDate] = useState<Date>(() => initialRange?.from ?? new Date());

  const setDatePreset = useCallback((preset: DatePreset) => {
    const now = new Date();
    setDatePresetState(preset);
    setReferenceDate(now);
    setDateRangeState(getDateRangeFromPreset(preset, now));
  }, []);

  const setDateRange = useCallback((range: DateRange) => {
    setDateRangeState(range);
    setReferenceDate(range.from);
    setDatePresetState(detectPresetFromRange(range.from, range.to));
  }, []);

  const navigatePeriod = useCallback(
    (direction: 'prev' | 'next') => {
      if (datePreset === 'custom') return;
      setReferenceDate((prev) => {
        const newRef = navigateReferenceDate(prev, datePreset, direction);
        setDateRangeState(getDateRangeFromPreset(datePreset, newRef));
        return newRef;
      });
    },
    [datePreset]
  );

  const goToToday = useCallback(() => {
    const today = new Date();
    setReferenceDate(today);
    setDateRangeState(getDateRangeFromPreset(datePreset, today));
  }, [datePreset]);

  return {
    dateRange,
    datePreset,
    setDatePreset,
    setDateRange,
    navigatePeriod,
    goToToday,
  };
}

/**
 * Helper hook: keeps the current ISO `{from, to}` pair in sync with a callback
 * (typically `patch` on `BookingsQuery`).
 *
 * `urlFrom` / `urlTo` represent the *currently* applied filter from the URL.
 * Tracking them prevents two failure modes:
 *
 * 1. **First-render echo** — if the URL already has from/to, the hook is
 *    hydrated with the same values and we skip the very first render so we
 *    don't write back the same data.
 * 2. **No-op preset clicks** — if the URL has no filter but the hook's
 *    internal state defaults to "this month", clicking the "Month" preset
 *    must still apply the filter even though the date strings didn't change.
 *    We compare against the URL state, not the previous hook state.
 */
export function useSyncDateRangeWithQuery(
  state: DateNavigationState,
  urlFrom: string | null,
  urlTo: string | null,
  onChange: (next: { from: string | null; to: string | null }) => void
) {
  const firstEmit = useRef(true);
  const hydratingFromUrl = useRef(false);
  const dateRangeRef = useRef(state.dateRange);
  dateRangeRef.current = state.dateRange;

  // Keep the picker aligned when URL dates change (deep links, back/forward).
  // Only react to urlFrom/urlTo — not local dateRange changes from ←/→ navigation.
  // Otherwise we revert the new range before the sync effect writes the URL.
  useEffect(() => {
    if (!urlFrom || !urlTo) return;
    const from = fromIsoDate(urlFrom);
    const to = fromIsoDate(urlTo);
    if (!from || !to) return;
    const curFrom = toIsoDate(dateRangeRef.current.from);
    const curTo = toIsoDate(dateRangeRef.current.to);
    if (curFrom === urlFrom && curTo === urlTo) return;
    hydratingFromUrl.current = true;
    state.setDateRange({ from, to });
  }, [urlFrom, urlTo, state.setDateRange]);

  useEffect(() => {
    if (firstEmit.current) {
      firstEmit.current = false;
      return;
    }
    if (hydratingFromUrl.current) {
      hydratingFromUrl.current = false;
      return;
    }
    const next = {
      from: toIsoDate(state.dateRange.from),
      to: toIsoDate(state.dateRange.to),
    };
    if (next.from === urlFrom && next.to === urlTo) {
      return;
    }
    onChange(next);
  }, [state.dateRange, urlFrom, urlTo, onChange]);
}
