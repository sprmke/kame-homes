import { describe, expect, it } from 'vitest';

import {
  buildSearchValues,
  formatDateRange,
  formatGuestSummary,
  formatGuestSummaryCompact,
  parseDateParam,
  parseGuestBreakdown,
  readWhereParam,
} from '@/features/guest/marketing/guest-landing/lib/heroSearchState';

describe('heroSearchState', () => {
  it('parses dates and rejects garbage', () => {
    expect(parseDateParam('2026-08-05')?.getDate()).toBe(5);
    expect(parseDateParam('nope')).toBeUndefined();
    expect(parseDateParam(null)).toBeUndefined();
  });

  it('reads the guest breakdown with a legacy guests fallback', () => {
    expect(parseGuestBreakdown(new URLSearchParams('adults=0&children=2&pets=1'))).toEqual({
      adults: 1,
      children: 2,
      infants: 0,
      pets: 1,
    });
    expect(parseGuestBreakdown(new URLSearchParams('guests=4')).adults).toBe(4);
    expect(parseGuestBreakdown(new URLSearchParams('')).adults).toBe(2);
  });

  it('prefers where over legacy location and falls back to the default', () => {
    expect(readWhereParam(new URLSearchParams('where=Makati&location=Cebu'))).toBe('Makati');
    expect(readWhereParam(new URLSearchParams('location=Cebu'))).toBe('Cebu');
    expect(readWhereParam(new URLSearchParams('where=%20%20'), 'Tagaytay')).toBe('Tagaytay');
  });

  it('builds submit values and summaries', () => {
    const range = { from: new Date(2026, 7, 5), to: new Date(2026, 7, 7) };
    const counts = { adults: 2, children: 1, infants: 0, pets: 1 };
    expect(buildSearchValues(' Makati ', range, counts)).toEqual({
      location: 'Makati',
      checkIn: '2026-08-05',
      checkOut: '2026-08-07',
      guests: '3',
    });
    expect(formatGuestSummary(counts)).toBe('3 guests, 1 pet');
    expect(formatGuestSummaryCompact({ adults: 0, children: 0, infants: 0, pets: 2 })).toBe('2 pet');
    expect(formatDateRange(range)).toBe('Aug 5 – Aug 7');
    expect(formatDateRange(undefined)).toBe('');
  });
});
