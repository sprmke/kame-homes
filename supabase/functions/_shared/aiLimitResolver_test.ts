/**
 * aiLimitResolver — pure precedence + validation coverage (no Supabase / network).
 * Run: deno test --no-check --allow-env --allow-net supabase/functions/_shared/aiLimitResolver_test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  AI_LIMIT_CACHE_TTL_MS,
  AI_LIMIT_CONSTANT_DEFAULTS,
  clearAiLimitCache,
  withAiLimitCache,
  type AiLimitOrgInputs,
  type AiLimitProfile,
  AI_LIMIT_KEYS,
  buildOrgLayers,
  buildPropertyLayers,
  mapProfileRow,
  orgOverrideValues,
  parseAiLimitValue,
  propertyOverrideValues,
  resolveFromLayers,
} from './aiLimitResolver.ts';

const GLOBAL = {
  defaultDailyCallLimit: 200,
  defaultMonthlyCallLimit: 5000,
  defaultDailyCostUsdLimit: 10,
  defaultDailyCreditLimit: 100000,
  defaultMonthlyCreditLimit: 1000000,
};

function profile(code: string, limits: Partial<AiLimitProfile['limits']> = {}): AiLimitProfile {
  const base = {} as AiLimitProfile['limits'];
  for (const key of AI_LIMIT_KEYS) base[key] = null;
  return {
    id: `id-${code}`,
    code,
    name: code,
    description: null,
    isDefault: code === 'default',
    updatedAt: null,
    limits: { ...base, ...limits },
  };
}

function orgInputs(overrides: Partial<AiLimitOrgInputs> = {}): AiLimitOrgInputs {
  return {
    organizationId: 'org-1',
    global: GLOBAL,
    orgRow: null,
    assistantRow: null,
    planTier: 'included',
    planAllowance: null,
    orgProfile: null,
    planProfile: null,
    defaultProfile: profile('default', {
      assistantDailyMessageLimit: 50,
      assistantMonthlyMessageLimit: 1000,
      assistantDailyWriteActionLimit: 20,
      voiceMaxSessionSeconds: 300,
      voiceMaxSessionsPerGuestPerDay: 3,
      voiceMaxConcurrentSessions: 3,
    }),
    ...overrides,
  };
}

Deno.test('org scope: nothing set resolves platform defaults with provenance', () => {
  const limits = resolveFromLayers(buildOrgLayers(orgInputs()));
  assertEquals(limits.dailyCallLimit, { value: 200, source: 'global', profileCode: null });
  assertEquals(limits.monthlyCreditLimit.value, 1000000);
  assertEquals(limits.assistantDailyMessageLimit, {
    value: 50,
    source: 'default',
    profileCode: 'default',
  });
  assertEquals(limits.imageMonthlyCreditCap.value, null);
});

Deno.test(
  'org scope: precedence override > org > plan profile > plan allowance > default > global',
  () => {
    const inputs = orgInputs({
      orgRow: { daily_call_limit: 7 },
      orgProfile: profile('vip', { dailyCallLimit: 70, monthlyCallLimit: 700 }),
      planProfile: profile('growth', {
        dailyCallLimit: 80,
        monthlyCallLimit: 800,
        dailyCostUsdLimit: 3,
      }),
      planAllowance: 25000,
    });
    const limits = resolveFromLayers(buildOrgLayers(inputs));
    assertEquals(limits.dailyCallLimit, { value: 7, source: 'override', profileCode: null });
    assertEquals(limits.monthlyCallLimit, { value: 700, source: 'org', profileCode: 'vip' });
    assertEquals(limits.dailyCostUsdLimit, { value: 3, source: 'plan', profileCode: 'growth' });
    assertEquals(limits.monthlyCreditLimit, {
      value: 25000,
      source: 'plan_allowance',
      profileCode: null,
    });
    assertEquals(limits.dailyCreditLimit.source, 'global');
  }
);

Deno.test('org scope: plan allowance of 0 is honored, not treated as blank', () => {
  const limits = resolveFromLayers(buildOrgLayers(orgInputs({ planAllowance: 0 })));
  assertEquals(limits.monthlyCreditLimit, {
    value: 0,
    source: 'plan_allowance',
    profileCode: null,
  });
});

Deno.test('org scope: explicit plan-profile credit limit beats the plan allowance', () => {
  const limits = resolveFromLayers(
    buildOrgLayers(
      orgInputs({
        planProfile: profile('growth', { monthlyCreditLimit: 500 }),
        planAllowance: 25000,
      })
    )
  );
  assertEquals(limits.monthlyCreditLimit, { value: 500, source: 'plan', profileCode: 'growth' });
});

Deno.test('assistant override columns feed the org override layer', () => {
  const inputs = orgInputs({
    assistantRow: { daily_message_limit: 5, monthly_message_limit: null },
  });
  const limits = resolveFromLayers(buildOrgLayers(inputs));
  assertEquals(limits.assistantDailyMessageLimit.source, 'override');
  assertEquals(limits.assistantDailyMessageLimit.value, 5);
  assertEquals(limits.assistantMonthlyMessageLimit.value, 1000);
});

Deno.test('property scope: override > property profile > development profile > org chain', () => {
  const inputs = {
    ...orgInputs({ planProfile: profile('growth', { dailyCallLimit: 80, monthlyCallLimit: 800 }) }),
    propertyRow: { daily_cost_usd_limit: 1.5 },
    propertyProfile: profile('tight', { dailyCostUsdLimit: 2, dailyCallLimit: 20 }),
    developmentProfile: profile('azure', {
      dailyCallLimit: 30,
      monthlyCallLimit: 300,
      dailyCreditLimit: 9,
    }),
  };
  const limits = resolveFromLayers(buildPropertyLayers(inputs));
  assertEquals(limits.dailyCostUsdLimit, { value: 1.5, source: 'override', profileCode: null });
  assertEquals(limits.dailyCallLimit, { value: 20, source: 'property', profileCode: 'tight' });
  assertEquals(limits.monthlyCallLimit, {
    value: 300,
    source: 'development',
    profileCode: 'azure',
  });
  assertEquals(limits.dailyCreditLimit.value, 9);
  // Falls through to the org chain when no property-scope layer sets it.
  assertEquals(limits.voiceMaxSessionSeconds.source, 'default');
});

Deno.test('property scope with no property layers equals the org resolve', () => {
  const inputs = orgInputs({ planProfile: profile('growth', { dailyCallLimit: 80 }) });
  const org = resolveFromLayers(buildOrgLayers(inputs));
  const property = resolveFromLayers(
    buildPropertyLayers({
      ...inputs,
      propertyRow: null,
      propertyProfile: null,
      developmentProfile: null,
    })
  );
  assertEquals(property, org);
});

Deno.test('property override values read voice and generation caps from feature_configs', () => {
  const values = propertyOverrideValues({
    daily_call_limit: null,
    feature_configs: {
      voice_receptionist: { max_session_seconds: 120, max_concurrent_sessions: 2 },
      marketing_image_generate: { monthly_credit_cap: 400, allow_premium_tier: true },
      marketing_video_generate: { allow_premium_tier: true },
    },
  });
  assertEquals(values.voiceMaxSessionSeconds, 120);
  assertEquals(values.voiceMaxConcurrentSessions, 2);
  assertEquals(values.voiceMaxSessionsPerGuestPerDay, null);
  assertEquals(values.imageMonthlyCreditCap, 400);
  assertEquals(values.videoMonthlyCreditCap, null);
});

Deno.test('property override values ignore junk feature_configs', () => {
  const values = propertyOverrideValues({ feature_configs: 'nope' });
  for (const key of AI_LIMIT_KEYS) {
    assertEquals(values[key] ?? null, null);
  }
});

Deno.test('org override values map every overridable column', () => {
  const values = orgOverrideValues(
    {
      daily_call_limit: 1,
      monthly_call_limit: 2,
      daily_cost_usd_limit: '3.5',
      daily_credit_limit: 4,
    },
    { daily_write_action_limit: 6 }
  );
  assertEquals(values.dailyCostUsdLimit, 3.5);
  assertEquals(values.assistantDailyWriteActionLimit, 6);
  assertEquals(values.monthlyCreditLimit, null);
});

Deno.test('mapProfileRow maps columns to camelCase limits', () => {
  const mapped = mapProfileRow({
    id: 'p1',
    code: 'growth',
    name: 'Growth',
    description: null,
    is_default: false,
    updated_at: null,
    daily_call_limit: 10,
    monthly_credit_limit: '250.000',
  });
  assertEquals(mapped.limits.dailyCallLimit, 10);
  assertEquals(mapped.limits.monthlyCreditLimit, 250);
  assertEquals(mapped.limits.voiceMaxSessionSeconds, null);
});

Deno.test('constant defaults mirror the legacy hard-coded assistant/voice values', () => {
  assertEquals(AI_LIMIT_CONSTANT_DEFAULTS.assistantDailyMessageLimit, 50);
  assertEquals(AI_LIMIT_CONSTANT_DEFAULTS.voiceMaxSessionSeconds, 300);
});

Deno.test('parseAiLimitValue: blank clears, bounds and integers enforced', () => {
  assertEquals(parseAiLimitValue('dailyCallLimit', null), { ok: true, value: null });
  assertEquals(parseAiLimitValue('dailyCallLimit', ''), { ok: true, value: null });
  assertEquals(parseAiLimitValue('dailyCallLimit', '25'), { ok: true, value: 25 });
  assertEquals(parseAiLimitValue('dailyCallLimit', 0).ok, false);
  assertEquals(parseAiLimitValue('dailyCallLimit', 1.5).ok, false);
  assertEquals(parseAiLimitValue('dailyCostUsdLimit', 0.25), { ok: true, value: 0.25 });
  assertEquals(parseAiLimitValue('monthlyCreditLimit', 0), { ok: true, value: 0 });
  assertEquals(parseAiLimitValue('voiceMaxSessionSeconds', 59).ok, false);
  assertEquals(parseAiLimitValue('voiceMaxSessionSeconds', 3601).ok, false);
  assertEquals(parseAiLimitValue('voiceMaxConcurrentSessions', 50), { ok: true, value: 50 });
  assertEquals(parseAiLimitValue('dailyCallLimit', 'abc').ok, false);
});

Deno.test('withAiLimitCache memoizes within the TTL and reloads after it', async () => {
  clearAiLimitCache();
  let loads = 0;
  let clock = 1_000;
  const load = () => Promise.resolve(++loads);
  assertEquals(await withAiLimitCache('k', load, () => clock), 1);
  assertEquals(await withAiLimitCache('k', load, () => clock + 100), 1);
  assertEquals(await withAiLimitCache('k', load, () => (clock += AI_LIMIT_CACHE_TTL_MS + 1)), 2);
  clearAiLimitCache();
  assertEquals(await withAiLimitCache('k', load, () => clock), 3);
});

Deno.test('withAiLimitCache does not cache failures', async () => {
  clearAiLimitCache();
  let calls = 0;
  const flaky = () => (++calls === 1 ? Promise.reject(new Error('boom')) : Promise.resolve('ok'));
  let failed = false;
  await withAiLimitCache('f', flaky).catch(() => (failed = true));
  assertEquals(failed, true);
  assertEquals(await withAiLimitCache('f', flaky), 'ok');
});
