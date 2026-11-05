import { describe, expect, it } from 'vitest';

import {
  createDisabledCheckoutDateMatcher,
  createDisabledDateMatcher,
  formatDateToMMDDYYYY,
  formatDateToYYYYMMDD,
  formatIsoDateForDisplay,
  formatManilaLongDate,
  formatYmdToFullLongDate,
} from '@/utils/format/dates';

describe('formatDateToYYYYMMDD', () => {
  it('formats Date to ISO date', () => {
    expect(formatDateToYYYYMMDD(new Date('2026-01-15T12:00:00Z'))).toBe('2026-01-15');
  });
});

describe('formatIsoDateForDisplay', () => {
  it('returns empty for missing iso', () => {
    expect(formatIsoDateForDisplay(null)).toBe('');
  });

  it('formats YYYY-MM-DD to MM/DD/YYYY', () => {
    expect(formatIsoDateForDisplay('2026-03-05')).toBe('03/05/2026');
  });
});

describe('formatDateToMMDDYYYY', () => {
  it('formats guest DB style date', () => {
    expect(formatDateToMMDDYYYY('2026-03-05')).toBe('03-05-2026');
  });

  it('returns empty for invalid', () => {
    expect(formatDateToMMDDYYYY('')).toBe('');
    expect(formatDateToMMDDYYYY('not-a-date')).toBe('');
  });
});

describe('formatYmdToFullLongDate', () => {
  it('formats full long date', () => {
    expect(formatYmdToFullLongDate('2026-01-01')).toBe('January 1, 2026');
  });
});

describe('formatManilaLongDate', () => {
  it('returns empty for invalid timestamp', () => {
    expect(formatManilaLongDate(undefined)).toBe('');
  });

  it('formats valid ISO in Manila', () => {
    const out = formatManilaLongDate('2026-06-15T00:00:00.000Z');
    expect(out).toMatch(/Jun/);
    expect(out).toMatch(/2026/);
  });
});


describe('booked-date matchers - same-day stays', () => {
  const sameDay = [{ id: 'b1', checkInDate: '2026-01-15', checkOutDate: '2026-01-15' }];
  const normal = [{ id: 'b2', checkInDate: '2026-01-15', checkOutDate: '2026-01-17' }];

  it('blocks the check-in day of a same-day stay', () => {
    expect(createDisabledDateMatcher(sameDay)(new Date('2026-01-15T12:00:00'))).toBe(true);
    expect(createDisabledDateMatcher(sameDay)(new Date('2026-01-16T12:00:00'))).toBe(false);
  });

  it('still blocks every night of a multi-night stay', () => {
    expect(createDisabledDateMatcher(normal)(new Date('2026-01-15T12:00:00'))).toBe(true);
    expect(createDisabledDateMatcher(normal)(new Date('2026-01-16T12:00:00'))).toBe(true);
    expect(createDisabledDateMatcher(normal)(new Date('2026-01-17T12:00:00'))).toBe(false);
  });

  it('never blocks the booking being edited', () => {
    expect(createDisabledDateMatcher(sameDay, 'b1')(new Date('2026-01-15T12:00:00'))).toBe(false);
  });

  it('checkout matcher keeps the same-day night out of range', () => {
    // Checkout on the same-day booking's date means leaving that morning: allowed.
    expect(
      createDisabledCheckoutDateMatcher(sameDay)(new Date('2026-01-15T12:00:00'))
    ).toBe(false);
  });
});
