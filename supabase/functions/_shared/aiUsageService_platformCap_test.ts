import { platformDailyCostUsdCap } from './aiUsageService.ts';
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';

Deno.test('platformDailyCostUsdCap defaults to 150', () => {
  Deno.env.delete('AI_PLATFORM_DAILY_COST_USD_CAP');
  assertEquals(platformDailyCostUsdCap(), 150);
});

Deno.test('platformDailyCostUsdCap reads env override', () => {
  Deno.env.set('AI_PLATFORM_DAILY_COST_USD_CAP', '200');
  assertEquals(platformDailyCostUsdCap(), 200);
  Deno.env.set('AI_PLATFORM_DAILY_COST_USD_CAP', '0');
  assertEquals(platformDailyCostUsdCap(), 0);
});
