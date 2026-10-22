import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  classifyBearer,
  classifyGemini,
  classifyJamendo,
  classifyMetaAppToken,
  classifyMetaPageTokens,
  classifyPaymongo,
  classifyResend,
  classifySupabaseAuth,
  classifyTelegramBots,
  classifyTelegramGetMe,
  classifyTurnstile,
  metaTokenProblem,
} from './probeClassifiers.ts';

Deno.test('classifyResend', () => {
  const domains = { data: [{ name: 'kamehomes.space', status: 'verified' }] };
  assertEquals(classifyResend(200, domains, 'Kame <hello@kamehomes.space>').status, 'ok');
  assertEquals(classifyResend(200, domains, 'hello@other.com').status, 'error');
  assertEquals(
    classifyResend(
      200,
      { data: [{ name: 'kamehomes.space', status: 'pending' }] },
      'a@kamehomes.space'
    ).status,
    'error'
  );
  assertEquals(classifyResend(401, { name: 'validation_error' }).status, 'error');
  assertEquals(classifyResend(401, { name: 'restricted_api_key' }).status, 'ok');
  assertEquals(classifyResend(429, null).status, 'warn');
});

Deno.test('classifyGemini', () => {
  assertEquals(classifyGemini(200, {}).status, 'ok');
  assertEquals(classifyGemini(429, {}).status, 'warn');
  assertEquals(
    classifyGemini(400, { error: { details: [{ reason: 'API_KEY_INVALID' }] } }).detail,
    'Key invalid or deleted'
  );
  assertEquals(classifyGemini(403, {}).status, 'error');
});

Deno.test('classifyBearer', () => {
  assertEquals(classifyBearer('Groq', 200).status, 'ok');
  assertEquals(classifyBearer('Groq', 401).status, 'error');
  assertEquals(classifyBearer('Groq', 429).status, 'warn');
  assertEquals(classifyBearer('Groq', 503).status, 'warn');
});

Deno.test('classifyPaymongo checks for an enabled webhook', () => {
  const hook = (status: string) => ({
    data: [{ attributes: { status, url: 'https://x.supabase.co/functions/v1/paymongo-webhook' } }],
  });
  assertEquals(classifyPaymongo(200, hook('enabled')).status, 'ok');
  assertEquals(classifyPaymongo(200, hook('disabled')).status, 'warn');
  assertEquals(classifyPaymongo(401, null).status, 'error');
});

Deno.test('classifyMetaAppToken', () => {
  assertEquals(classifyMetaAppToken(200, { access_token: 'x' }).status, 'ok');
  assertEquals(classifyMetaAppToken(400, { error: {} }).status, 'error');
});

Deno.test('classifyMetaPageTokens', () => {
  const now = 1_000_000;
  assertEquals(classifyMetaPageTokens([], now).status, 'off');
  assertEquals(classifyMetaPageTokens([{ is_valid: true, expires_at: 0 }], now).status, 'ok');
  assertEquals(
    classifyMetaPageTokens([{ is_valid: true, expires_at: now + 3600 }], now).status,
    'warn'
  );
  assertEquals(
    classifyMetaPageTokens([{ is_valid: true }, { is_valid: false }], now).status,
    'error'
  );
});

Deno.test('classifyTurnstile', () => {
  assertEquals(
    classifyTurnstile(200, { success: false, 'error-codes': ['invalid-input-response'] }).status,
    'ok'
  );
  assertEquals(
    classifyTurnstile(200, { success: false, 'error-codes': ['invalid-input-secret'] }).status,
    'error'
  );
});

Deno.test('classifyJamendo and classifySupabaseAuth', () => {
  assertEquals(classifyJamendo(200, { headers: { status: 'success' } }).status, 'ok');
  assertEquals(classifyJamendo(200, { headers: { status: 'failed' } }).status, 'error');
  assertEquals(classifySupabaseAuth(200, { external: { google: true } }).status, 'ok');
  assertEquals(classifySupabaseAuth(200, { external: { google: false } }).status, 'warn');
  assertEquals(classifySupabaseAuth(500, null).status, 'error');
});

Deno.test('metaTokenProblem', () => {
  const now = 1_000_000;
  assertEquals(metaTokenProblem({ is_valid: false }, now), 'Token invalid');
  assertEquals(
    metaTokenProblem({ is_valid: true, expires_at: now + 86400 }, now),
    'Expires within 7 days'
  );
  assertEquals(metaTokenProblem({ is_valid: true, expires_at: 0 }, now), null);
  assertEquals(
    metaTokenProblem({ is_valid: true, data_access_expires_at: now + 30 * 86400 }, now),
    null
  );
});

Deno.test('classifyTelegramGetMe', () => {
  assertEquals(classifyTelegramGetMe(200, { ok: true }), true);
  assertEquals(classifyTelegramGetMe(401, { ok: false }), false);
  assertEquals(classifyTelegramGetMe(404, { ok: false }), false);
  assertEquals(classifyTelegramGetMe(429, null), null);
  assertEquals(classifyTelegramGetMe(0, null), null);
});

Deno.test('classifyTelegramBots', () => {
  assertEquals(classifyTelegramBots([]).status, 'off');
  assertEquals(classifyTelegramBots([true, true]).status, 'ok');
  assertEquals(classifyTelegramBots([true, null]).status, 'warn');
  assertEquals(classifyTelegramBots([false, null]).status, 'error');
});
