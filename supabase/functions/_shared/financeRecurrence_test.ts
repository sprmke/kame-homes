import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';

import {
  addDaysToIso,
  addRecurrenceInterval,
  generateRecurrenceDates,
} from './financeRecurrence.ts';

Deno.test('addRecurrenceInterval advances monthly', () => {
  assertEquals(addRecurrenceInterval('2026-01-15', 'monthly'), '2026-02-15');
});

Deno.test('generateRecurrenceDates produces inclusive range', () => {
  const dates = generateRecurrenceDates('2026-01-01', 'monthly', '2026-03-01');
  assertEquals(dates, ['2026-01-01', '2026-02-01', '2026-03-01']);
});

Deno.test('addDaysToIso shifts calendar days', () => {
  assertEquals(addDaysToIso('2026-01-31', 1), '2026-02-01');
});
