/**
 * cutoverWatermark — pure-helper coverage (no Supabase / network).
 * Plan §5.6: historic-blast guards for the legacy → mt-prod cutover.
 * Run: deno test --no-check --allow-env supabase/functions/_shared/cutoverWatermark_test.ts
 */

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { shouldSkipForCutoverWatermark } from './cutoverWatermark.ts';

Deno.test('cutoverWatermark: guard inactive without a cutover timestamp', () => {
  assert(!shouldSkipForCutoverWatermark('2026-08-01', null));
  assert(!shouldSkipForCutoverWatermark('2026-08-01', undefined));
});

Deno.test('cutoverWatermark: missing/invalid checkout date never skips', () => {
  assert(!shouldSkipForCutoverWatermark(null, '2026-10-25T10:00:00Z'));
  assert(!shouldSkipForCutoverWatermark('', '2026-10-25T10:00:00Z'));
});

Deno.test('cutoverWatermark: pre-cutover check-outs are settled history', () => {
  assertEquals(shouldSkipForCutoverWatermark('2026-08-01', '2026-10-25T10:00:00Z'), true);
});

Deno.test('cutoverWatermark: check-out on/after cutover day is a live guest', () => {
  assertEquals(shouldSkipForCutoverWatermark('2026-10-25', '2026-10-25T10:00:00Z'), false);
  assertEquals(shouldSkipForCutoverWatermark('2026-10-26', '2026-10-25T10:00:00Z'), false);
});

Deno.test('cutoverWatermark: legacy MM-DD-YYYY dates handled', () => {
  assertEquals(shouldSkipForCutoverWatermark('08-01-2026', '2026-10-25T10:00:00Z'), true);
  assertEquals(shouldSkipForCutoverWatermark('10-26-2026', '2026-10-25T10:00:00Z'), false);
});
