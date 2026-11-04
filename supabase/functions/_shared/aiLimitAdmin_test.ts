/**
 * aiLimitAdmin — pure validator coverage (no Supabase / network).
 */

import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  AiLimitAdminError,
  KILL_SWITCH_KEYS,
  MAX_BULK_TARGETS,
  ORG_OVERRIDE_KEYS,
  parseKillSwitchOverrides,
  parseLimitsMap,
  parseProfileInput,
  parseScope,
  parseTargetIds,
  PROPERTY_OVERRIDE_KEYS,
  requireOverrideReason,
} from './aiLimitAdmin.ts';

Deno.test('parseLimitsMap accepts numbers, strings and null clears', () => {
  assertEquals(
    parseLimitsMap({ dailyCallLimit: 25, monthlyCreditLimit: '1000', dailyCostUsdLimit: null }),
    {
      dailyCallLimit: 25,
      monthlyCreditLimit: 1000,
      dailyCostUsdLimit: null,
    }
  );
});

Deno.test('parseLimitsMap rejects unknown, out-of-scope and invalid values', () => {
  assertThrows(() => parseLimitsMap({ bogus: 1 }), AiLimitAdminError, 'Unknown limit');
  assertThrows(
    () => parseLimitsMap({ voiceMaxSessionSeconds: 120 }, ORG_OVERRIDE_KEYS),
    AiLimitAdminError,
    'cannot be set at this level'
  );
  assertThrows(
    () => parseLimitsMap({ assistantDailyMessageLimit: 5 }, PROPERTY_OVERRIDE_KEYS),
    AiLimitAdminError,
    'cannot be set at this level'
  );
  assertThrows(() => parseLimitsMap({ dailyCallLimit: 0 }), AiLimitAdminError);
  assertThrows(() => parseLimitsMap({ voiceMaxSessionSeconds: 30 }), AiLimitAdminError);
  assertThrows(() => parseLimitsMap([]), AiLimitAdminError, 'limits must be an object');
});

Deno.test('parseProfileInput validates code, name, description and limits', () => {
  assertEquals(
    parseProfileInput(
      { code: ' Growth-2 ', name: ' Growth ', limits: { dailyCallLimit: 10 } },
      'create'
    ),
    { code: 'growth-2', name: 'Growth', limits: { dailyCallLimit: 10 } }
  );
  assertThrows(() => parseProfileInput({ name: 'x' }, 'create'), AiLimitAdminError, 'code');
  assertThrows(
    () => parseProfileInput({ code: 'Bad Code', name: 'x' }, 'create'),
    AiLimitAdminError
  );
  assertThrows(
    () => parseProfileInput({ code: 'ok', name: '' }, 'create'),
    AiLimitAdminError,
    'name'
  );
  assertThrows(
    () => parseProfileInput({ description: 'x'.repeat(301) }, 'update'),
    AiLimitAdminError,
    'description'
  );
  assertEquals(parseProfileInput({ description: '  ' }, 'update'), { description: null });
  assertEquals(parseProfileInput({}, 'update'), {});
});

Deno.test('parseTargetIds dedupes, requires ids and caps batch size', () => {
  assertEquals(parseTargetIds(['a', 'b', 'a']), ['a', 'b']);
  assertThrows(() => parseTargetIds([]), AiLimitAdminError);
  assertThrows(() => parseTargetIds('a'), AiLimitAdminError);
  assertThrows(() => parseTargetIds([1]), AiLimitAdminError);
  assertThrows(
    () => parseTargetIds(Array.from({ length: MAX_BULK_TARGETS + 1 }, (_, i) => `id-${i}`)),
    AiLimitAdminError,
    'At most'
  );
});

Deno.test('parseScope restricts to the allowed scopes', () => {
  assertEquals(parseScope('property', ['organization', 'property'] as const), 'property');
  assertThrows(
    () => parseScope('development', ['organization', 'property'] as const),
    AiLimitAdminError
  );
});

Deno.test('requireOverrideReason: reason needed only when a value is set', () => {
  assertEquals(requireOverrideReason({ dailyCallLimit: 5 }, 'Negotiated deal'), 'Negotiated deal');
  assertThrows(() => requireOverrideReason({ dailyCallLimit: 5 }, ''), AiLimitAdminError);
  assertThrows(() => requireOverrideReason({ dailyCallLimit: 5 }, 'ab'), AiLimitAdminError);
  assertEquals(requireOverrideReason({ dailyCallLimit: null }, undefined), null);
  assertThrows(() => requireOverrideReason({}, 'x'.repeat(201)), AiLimitAdminError, '200');
});

Deno.test('parseKillSwitchOverrides accepts booleans and null, ignores undefined', () => {
  assertEquals(
    parseKillSwitchOverrides({
      agenticModeEnabled: true,
      planApprovalEnabled: null,
      guestActionsEnabled: undefined,
    }),
    { agenticModeEnabled: true, planApprovalEnabled: null }
  );
  assertEquals(parseKillSwitchOverrides({}), {});
  for (const key of KILL_SWITCH_KEYS) {
    assertEquals(parseKillSwitchOverrides({ [key]: false }), { [key]: false });
  }
});

Deno.test('parseKillSwitchOverrides rejects non-boolean, non-null values and non-objects', () => {
  assertThrows(
    () => parseKillSwitchOverrides({ agenticModeEnabled: 'true' }),
    AiLimitAdminError,
    'agenticModeEnabled must be a boolean or null'
  );
  assertThrows(() => parseKillSwitchOverrides({ guestActionsEnabled: 1 }), AiLimitAdminError);
  assertThrows(() => parseKillSwitchOverrides(null), AiLimitAdminError, 'must be an object');
  assertThrows(() => parseKillSwitchOverrides([]), AiLimitAdminError, 'must be an object');
});

Deno.test('parseKillSwitchOverrides ignores unknown keys (no throw)', () => {
  assertEquals(parseKillSwitchOverrides({ bogus: true }), {});
});
