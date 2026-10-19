/**
 * Deno tests for _shared/botHeuristics.ts — run with `deno test` (not Bun's runner).
 * Plan: docs/workflow/in-progress/production-readiness/audits/captcha-anti-spam-hardening.md (Phase 6)
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';

import {
  DEFAULT_MIN_ELAPSED_MS,
  FORM_LOADED_AT_FIELD,
  HONEYPOT_FIELD,
  checkBotHeuristics,
  checkHoneypot,
  checkMinElapsed,
} from './botHeuristics.ts';

Deno.test('checkHoneypot: empty decoy passes', () => {
  assertEquals(checkHoneypot({}).ok, true);
  assertEquals(checkHoneypot({ [HONEYPOT_FIELD]: '' }).ok, true);
  assertEquals(checkHoneypot({ [HONEYPOT_FIELD]: '   ' }).ok, true);
});

Deno.test('checkHoneypot: filled decoy fails', () => {
  const r = checkHoneypot({ [HONEYPOT_FIELD]: 'http://spam.example' });
  assertEquals(r.ok, false);
  assertEquals(r.ok === false && r.reason, 'honeypot_filled');
});

Deno.test('checkHoneypot: reads FormData and URLSearchParams', () => {
  const fd = new FormData();
  fd.set(HONEYPOT_FIELD, 'x');
  assertEquals(checkHoneypot(fd).ok, false);

  const usp = new URLSearchParams({ [HONEYPOT_FIELD]: '' });
  assertEquals(checkHoneypot(usp).ok, true);
});

Deno.test('checkMinElapsed: absent / garbage / future timestamps pass', () => {
  assertEquals(checkMinElapsed({}).ok, true);
  assertEquals(checkMinElapsed({ [FORM_LOADED_AT_FIELD]: 'not-a-number' }).ok, true);
  assertEquals(checkMinElapsed({ [FORM_LOADED_AT_FIELD]: '0' }).ok, true);
  assertEquals(checkMinElapsed({ [FORM_LOADED_AT_FIELD]: String(Date.now() + 60_000) }).ok, true);
});

Deno.test('checkMinElapsed: too-old timestamp is treated as untrusted (passes)', () => {
  const thirteenHoursAgo = Date.now() - 13 * 60 * 60 * 1000;
  assertEquals(checkMinElapsed({ [FORM_LOADED_AT_FIELD]: String(thirteenHoursAgo) }).ok, true);
});

Deno.test('checkMinElapsed: sub-threshold submit fails', () => {
  const justNow = Date.now() - 200;
  const r = checkMinElapsed({ [FORM_LOADED_AT_FIELD]: String(justNow) });
  assertEquals(r.ok, false);
  assertEquals(r.ok === false && r.reason, 'submitted_too_fast');
});

Deno.test('checkMinElapsed: comfortably-elapsed submit passes', () => {
  const enough = Date.now() - (DEFAULT_MIN_ELAPSED_MS + 1_000);
  assertEquals(checkMinElapsed({ [FORM_LOADED_AT_FIELD]: String(enough) }).ok, true);
});

Deno.test('checkBotHeuristics: honeypot failure wins over timing', () => {
  const r = checkBotHeuristics({
    [HONEYPOT_FIELD]: 'bot',
    [FORM_LOADED_AT_FIELD]: String(Date.now() - 50),
  });
  assertEquals(r.ok, false);
  assertEquals(r.ok === false && r.reason, 'honeypot_filled');
});

Deno.test('checkBotHeuristics: clean payload passes', () => {
  const r = checkBotHeuristics({
    [HONEYPOT_FIELD]: '',
    [FORM_LOADED_AT_FIELD]: String(Date.now() - 5_000),
  });
  assertEquals(r.ok, true);
});

Deno.test('checkBotHeuristics: custom minElapsedMs is honored', () => {
  const body = { [FORM_LOADED_AT_FIELD]: String(Date.now() - 3_000) };
  assertEquals(checkBotHeuristics(body, { minElapsedMs: 10_000 }).ok, false);
  assertEquals(checkBotHeuristics(body, { minElapsedMs: 1_000 }).ok, true);
});
