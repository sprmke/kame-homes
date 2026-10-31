import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { getFinanceCategoryLabel } from './financeCategoryLabels.ts';

Deno.test('getFinanceCategoryLabel maps known categories', () => {
  assertEquals(getFinanceCategoryLabel('utilities'), 'Utilities');
  assertEquals(getFinanceCategoryLabel('UTILITIES'), 'Utilities');
  assertEquals(getFinanceCategoryLabel('stay net'), 'Stay net');
});

Deno.test('getFinanceCategoryLabel title-cases unknown categories', () => {
  assertEquals(getFinanceCategoryLabel('my custom line'), 'My Custom Line');
});

Deno.test('getFinanceCategoryLabel treats empty as Other', () => {
  assertEquals(getFinanceCategoryLabel(null), 'Other');
  assertEquals(getFinanceCategoryLabel('   '), 'Other');
});
