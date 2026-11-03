import { describe, expect, it } from 'vitest';

import { formatStaleAge, staleAge } from '@/lib/pwa/staleData';

const NOW = Date.UTC(2026, 10, 2, 12, 0, 0);
const minute = 60_000;

describe('staleAge', () => {
  it('buckets minutes, hours, and days', () => {
    expect(staleAge(NOW - 10_000, NOW)).toEqual({ unit: 'just-now', value: 0 });
    expect(staleAge(NOW - 5 * minute, NOW)).toEqual({ unit: 'minutes', value: 5 });
    expect(staleAge(NOW - 3 * 60 * minute, NOW)).toEqual({ unit: 'hours', value: 3 });
    expect(staleAge(NOW - 50 * 60 * minute, NOW)).toEqual({ unit: 'days', value: 2 });
  });

  it('returns null for missing or invalid timestamps', () => {
    expect(staleAge(0, NOW)).toBeNull();
    expect(staleAge(Number.NaN, NOW)).toBeNull();
  });

  it('treats a future timestamp as just now (clock skew)', () => {
    expect(staleAge(NOW + 5 * minute, NOW)).toEqual({ unit: 'just-now', value: 0 });
  });
});

describe('formatStaleAge', () => {
  it('formats each bucket', () => {
    expect(formatStaleAge(NOW - 10_000, NOW)).toBe('Updated just now');
    expect(formatStaleAge(NOW - 5 * minute, NOW)).toBe('Updated 5m ago');
    expect(formatStaleAge(NOW - 3 * 60 * minute, NOW)).toBe('Updated 3h ago');
    expect(formatStaleAge(NOW - 50 * 60 * minute, NOW)).toBe('Updated 2d ago');
    expect(formatStaleAge(0, NOW)).toBeNull();
  });
});
