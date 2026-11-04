import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  shouldShowCalendarConflictRealtimeToast,
  suppressCalendarConflictRealtimeToasts,
} from '@/features/dashboard/pricing/lib/calendarConflictToastGate';

describe('calendarConflictToastGate', () => {
  afterEach(() => {
    vi.useRealTimers();
    // Expire any active suppress window from prior tests.
    suppressCalendarConflictRealtimeToasts(-1);
  });

  it('allows conflict toasts by default', () => {
    expect(shouldShowCalendarConflictRealtimeToast()).toBe(true);
  });

  it('suppresses while the window is open, then allows again', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-04T00:00:00Z'));
    suppressCalendarConflictRealtimeToasts(8_000);
    expect(shouldShowCalendarConflictRealtimeToast()).toBe(false);
    vi.setSystemTime(new Date('2026-11-04T00:00:09Z'));
    expect(shouldShowCalendarConflictRealtimeToast()).toBe(true);
  });
});
