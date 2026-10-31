import { describe, expect, it } from 'vitest';

import {
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
