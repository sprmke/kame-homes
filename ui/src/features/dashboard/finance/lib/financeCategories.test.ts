import { describe, expect, it } from 'vitest';

import { FINANCE_CATEGORY_SUGGESTIONS } from '@/features/dashboard/finance/lib/financeCategories';

describe('FINANCE_CATEGORY_SUGGESTIONS', () => {
  it('keeps the original defaults hosts already use', () => {
    expect(FINANCE_CATEGORY_SUGGESTIONS).toEqual(
      expect.arrayContaining([
        'Rent',
        'Amortization',
        'Utilities',
        'Supplies',
        'Maintenance',
        'Marketing',
        'Staff',
      ])
    );
  });

  it('includes the common short-stay operating buckets', () => {
    expect(FINANCE_CATEGORY_SUGGESTIONS).toEqual(
      expect.arrayContaining([
        'Cleaning',
        'Management fee',
        'Platform fees',
        'Taxes',
        'Insurance',
        'Software',
      ])
    );
  });

  it('ends with Other and never repeats a value', () => {
    expect(FINANCE_CATEGORY_SUGGESTIONS.at(-1)).toBe('Other');

    const normalized = FINANCE_CATEGORY_SUGGESTIONS.map((value) => value.trim().toLowerCase());
    expect(new Set(normalized).size).toBe(normalized.length);
  });

  it('fits the category field limits', () => {
    for (const value of FINANCE_CATEGORY_SUGGESTIONS) {
      expect(value).toBe(value.trim());
      expect(value.length).toBeGreaterThan(0);
      expect(value.length).toBeLessThanOrEqual(80);
    }
  });
});
