/**
 * Platform product name defaults.
 * Run: deno test --allow-env supabase/functions/_shared/platformBrand_test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { DEFAULT_PLATFORM_APP_NAME, resolvePlatformAppName } from './platformBrand.ts';

Deno.test('resolvePlatformAppName defaults to Kame Homes when unset or blank', () => {
  assertEquals(resolvePlatformAppName(undefined), DEFAULT_PLATFORM_APP_NAME);
  assertEquals(resolvePlatformAppName(null), DEFAULT_PLATFORM_APP_NAME);
  assertEquals(resolvePlatformAppName(''), DEFAULT_PLATFORM_APP_NAME);
  assertEquals(resolvePlatformAppName('   '), DEFAULT_PLATFORM_APP_NAME);
});

Deno.test('resolvePlatformAppName replaces the retired Stays placeholder', () => {
  assertEquals(resolvePlatformAppName('Stays'), DEFAULT_PLATFORM_APP_NAME);
  assertEquals(resolvePlatformAppName('stays'), DEFAULT_PLATFORM_APP_NAME);
  assertEquals(resolvePlatformAppName(' STAYS '), DEFAULT_PLATFORM_APP_NAME);
});

Deno.test('resolvePlatformAppName keeps a configured operator name', () => {
  assertEquals(resolvePlatformAppName('Acme Hosts'), 'Acme Hosts');
});
