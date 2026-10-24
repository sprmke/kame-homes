import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  expenseCategoriesFromItems,
  lastNFinanceMonthRanges,
  type FinanceLineItemRow,
} from './financeService.ts';

Deno.test('lastNFinanceMonthRanges is oldest-first and includes this month', () => {
  const ranges = lastNFinanceMonthRanges('2026-10-19', 6);
  assertEquals(
    ranges.map((row) => row.month),
    ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']
  );
  assertEquals(ranges[0]?.label, 'May');
  assertEquals(ranges[5]?.from, '2026-10-01');
  assertEquals(ranges[5]?.to, '2026-10-31');
});

Deno.test('lastNFinanceMonthRanges clamps to 2–12 months', () => {
  assertEquals(lastNFinanceMonthRanges('2026-03-01', 1).length, 2);
  assertEquals(lastNFinanceMonthRanges('2026-03-01', 20).length, 12);
});

Deno.test('expenseCategoriesFromItems groups expenses and skips income', () => {
  const row = (
    kind: FinanceLineItemRow['kind'],
    category: string | null,
    amount: number
  ): FinanceLineItemRow => ({ kind, category, amount }) as FinanceLineItemRow;
  const cats = expenseCategoriesFromItems([
    row('expense', 'cleaning', 6400),
    row('expense', 'utilities', 3900),
    row('expense', 'Cleaning', 200),
    row('expense', 'cleaning fee', 100),
    row('income', 'parking', 900),
  ]);
  assertEquals(cats, [
    { label: 'Cleaning', amount: 6700 },
    { label: 'Utilities', amount: 3900 },
  ]);
});
