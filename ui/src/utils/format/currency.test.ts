import { describe, expect, it } from 'vitest';

import { formatMoney, formatMoneyCompact } from '@/utils/format/currency';

describe('formatMoney', () => {
  it('returns dash for empty values', () => {
    expect(formatMoney(null)).toBe('-');
    expect(formatMoney(undefined)).toBe('-');
    expect(formatMoney('')).toBe('-');
  });

  it('formats numeric and string amounts as PHP', () => {
    expect(formatMoney(1500)).toMatch(/1,500\.00/);
    expect(formatMoney('2500.5')).toMatch(/2,500\.50/);
  });

  it('returns dash for NaN', () => {
    expect(formatMoney('not-a-number')).toBe('-');
  });
});

describe('formatMoneyCompact', () => {
  it('formats whole pesos without decimals', () => {
    expect(formatMoneyCompact(1500)).toMatch(/1,500/);
    expect(formatMoneyCompact(1500)).not.toMatch(/\.00/);
  });
});
