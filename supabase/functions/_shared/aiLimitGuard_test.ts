/**
 * aiLimitGuard — host write rejection (no Supabase / network).
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  AI_LIMIT_PLATFORM_MANAGED_CODE,
  findPlatformManagedLimitFields,
  HOST_ASSISTANT_LIMIT_FIELDS,
  HOST_ORG_AI_LIMIT_FIELDS,
  HOST_PROPERTY_AI_LIMIT_FIELDS,
  HOST_VOICE_LIMIT_FIELDS,
  rejectPlatformManagedLimits,
} from './aiLimitGuard.ts';

const req = new Request('https://example.test/fn', { method: 'PATCH' });

Deno.test('toggle-only bodies pass every host guard', () => {
  const body = { enabled: false, disabledPropertyIds: [], voiceId: 'Kore', personaPrompt: 'x' };
  for (const fields of [
    HOST_ORG_AI_LIMIT_FIELDS,
    HOST_PROPERTY_AI_LIMIT_FIELDS,
    HOST_ASSISTANT_LIMIT_FIELDS,
    HOST_VOICE_LIMIT_FIELDS,
  ]) {
    assertEquals(rejectPlatformManagedLimits(req, body, fields), null);
  }
});

Deno.test('a present limit field is rejected even when null', () => {
  assertEquals(findPlatformManagedLimitFields({ dailyCallLimit: null }, HOST_ORG_AI_LIMIT_FIELDS), [
    'dailyCallLimit',
  ]);
});

Deno.test('rejection is a 403 with the stable code and offending fields', async () => {
  const res = rejectPlatformManagedLimits(
    req,
    { enabled: true, imageMonthlyCreditCap: 10, dailyCostUsdLimit: 5 },
    HOST_PROPERTY_AI_LIMIT_FIELDS
  );
  assertEquals(res?.status, 403);
  const json = await res?.json();
  assertEquals(json.code, AI_LIMIT_PLATFORM_MANAGED_CODE);
  assertEquals(json.fields, ['dailyCostUsdLimit', 'imageMonthlyCreditCap']);
  assertEquals(json.success, false);
});

Deno.test('org guard does not flag property-only cap fields', () => {
  assertEquals(
    findPlatformManagedLimitFields({ imageMonthlyCreditCap: 1 }, HOST_ORG_AI_LIMIT_FIELDS),
    []
  );
});

Deno.test('assistant and voice fields are guarded', () => {
  assertEquals(
    findPlatformManagedLimitFields({ dailyMessageLimit: 1 }, HOST_ASSISTANT_LIMIT_FIELDS),
    ['dailyMessageLimit']
  );
  assertEquals(
    findPlatformManagedLimitFields({ maxConcurrentSessions: 9 }, HOST_VOICE_LIMIT_FIELDS),
    ['maxConcurrentSessions']
  );
});
