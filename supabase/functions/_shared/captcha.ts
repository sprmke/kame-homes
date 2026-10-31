/**
 * Cloudflare Turnstile server-side verification for edge functions.
 * Plan: docs/workflow/in-progress/production-readiness/audits/captcha-anti-spam-hardening.md (Phase 1, Layer 2)
 *
 * Supabase Auth verifies its own Turnstile tokens natively (`[auth.captcha]` in
 * config.toml). This helper is for the *non-auth* public write endpoints
 * (`submit-form`, `submit-sd-form`, …) which receive a `captchaToken` in their
 * request body and must call Turnstile's `siteverify` themselves.
 *
 * ── Enforcement modes (env `CAPTCHA_MODE`) ───────────────────────────────────
 *   enforce   — a definitively-bad or missing token is rejected (400).
 *   monitor   — always allowed; the outcome is logged to PostHog for tuning.
 *   disabled  — skipped entirely (helper is a no-op).
 * When `CAPTCHA_MODE` is unset the mode is derived: `enforce` if
 * `TURNSTILE_SECRET_KEY` is set, else `disabled`. This makes turning the feature
 * on a deliberate act (set the secret, or force the flag) and lets ops fall back
 * to `monitor` instantly during a provider incident without a redeploy.
 *
 * ── Fail-open vs fail-closed ─────────────────────────────────────────────────
 * In `enforce` mode:
 *   • missing token, or a definitive negative (`invalid-input-response`,
 *     `timeout-or-duplicate`, `bad-request`) → REJECT.
 *   • siteverify unreachable / 5xx / timeout / malformed → ALLOW (fail open) and
 *     log. Cloudflare being down must not take down our booking form; the durable
 *     rate limiter + bot heuristics are still in force on every protected route.
 */

import { capturePostHogException } from './posthog.ts';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const SITEVERIFY_TIMEOUT_MS = 4_000;
/** Cloudflare's official "always fails" test secret — never counts as configured. */
const TEST_SECRET_ALWAYS_FAILS = '2x0000000000000000000000000000000AA';

export type CaptchaMode = 'enforce' | 'monitor' | 'disabled';

export type CaptchaVerifyResult = {
  /** Whether the caller should be allowed through. */
  ok: boolean;
  /** Machine-readable outcome for logging/metrics. */
  outcome:
    | 'disabled'
    | 'success'
    | 'missing_token'
    | 'rejected'
    | 'provider_error'
    | 'monitored_pass'
    | 'monitored_fail';
  /** Cloudflare error codes when present. */
  errorCodes?: string[];
  reason?: string;
};

export function resolveCaptchaMode(): CaptchaMode {
  const explicit = Deno.env.get('CAPTCHA_MODE')?.trim().toLowerCase();
  if (explicit === 'enforce' || explicit === 'monitor' || explicit === 'disabled') {
    return explicit;
  }
  return hasUsableSecret() ? 'enforce' : 'disabled';
}

function hasUsableSecret(): boolean {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY')?.trim();
  return Boolean(secret) && secret !== TEST_SECRET_ALWAYS_FAILS + '__unused';
}

function turnstileSecret(): string {
  return Deno.env.get('TURNSTILE_SECRET_KEY')?.trim() ?? '';
}

// ── Intra-isolate replay guard ───────────────────────────────────────────────
// Turnstile tokens are single-use server-side (reuse → `timeout-or-duplicate`),
// but a local bounded set lets us reject an obvious replay burst without a
// network round-trip. Not shared across isolates — that's fine, siteverify is
// the source of truth.
const REPLAY_CACHE_MAX = 2_000;
const seenTokens = new Set<string>();

function rememberToken(token: string): void {
  if (seenTokens.size >= REPLAY_CACHE_MAX) {
    // Drop the oldest ~10% (insertion order) to keep the set bounded.
    let toDrop = Math.ceil(REPLAY_CACHE_MAX * 0.1);
    for (const t of seenTokens) {
      seenTokens.delete(t);
      if (--toDrop <= 0) break;
    }
  }
  seenTokens.add(token);
}

type SiteverifyResponse = {
  success: boolean;
  'error-codes'?: string[];
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
};

/**
 * Low-level verify. Never throws — returns a structured result. `remoteIp` is
 * passed to Cloudflare when available (improves scoring, optional).
 */
export async function verifyCaptchaToken(
  token: string | null | undefined,
  options: { remoteIp?: string; expectedAction?: string; mode?: CaptchaMode } = {}
): Promise<CaptchaVerifyResult> {
  const mode = options.mode ?? resolveCaptchaMode();

  if (mode === 'disabled') {
    return { ok: true, outcome: 'disabled' };
  }

  // In monitor mode nothing is blocked, but every outcome (pass and would-be
  // block) is logged to PostHog so ops can size the impact before flipping to
  // `enforce`. Returns an `ok: true` result so callers proceed.
  const monitored = async (
    outcome: 'monitored_pass' | 'monitored_fail',
    extra: Record<string, unknown>
  ): Promise<CaptchaVerifyResult> => {
    await logCaptchaEvent('captcha_monitor', { scope: options.expectedAction, outcome, ...extra });
    return { ok: true, outcome, ...extra } as CaptchaVerifyResult;
  };

  const trimmed = token?.trim() ?? '';

  if (!trimmed) {
    if (mode === 'monitor') return monitored('monitored_fail', { reason: 'missing_token' });
    return { ok: false, outcome: 'missing_token', reason: 'Human verification is required.' };
  }

  if (seenTokens.has(trimmed)) {
    if (mode === 'monitor') {
      return monitored('monitored_fail', { reason: 'replayed_token' });
    }
    return {
      ok: false,
      outcome: 'rejected',
      errorCodes: ['timeout-or-duplicate'],
      reason: 'This verification was already used. Please try again.',
    };
  }

  const secret = turnstileSecret();
  if (!secret) {
    // Mode was forced to enforce/monitor without a secret — can't verify.
    await logCaptchaEvent('captcha_misconfigured', {
      mode,
      note: 'CAPTCHA_MODE set without TURNSTILE_SECRET_KEY',
    });
    // Enforce-without-secret is a config error, not a reason to hard-block real
    // users: fail open but loudly.
    return { ok: true, outcome: 'provider_error', reason: 'captcha_secret_missing' };
  }

  let data: SiteverifyResponse | null = null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SITEVERIFY_TIMEOUT_MS);
    try {
      const form = new URLSearchParams();
      form.set('secret', secret);
      form.set('response', trimmed);
      if (options.remoteIp && options.remoteIp !== 'unknown') {
        form.set('remoteip', options.remoteIp);
      }
      const res = await fetch(SITEVERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form,
        signal: controller.signal,
      });
      if (!res.ok) {
        await logCaptchaEvent('captcha_provider_error', { status: res.status });
        return { ok: true, outcome: 'provider_error', reason: `siteverify_http_${res.status}` };
      }
      data = (await res.json()) as SiteverifyResponse;
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    await capturePostHogException(error, { logPrefix: 'captcha:siteverify' });
    // Network / abort / parse failure → fail open.
    return { ok: true, outcome: 'provider_error', reason: 'siteverify_unreachable' };
  }

  const errorCodes = data['error-codes'] ?? [];

  if (data.success) {
    rememberToken(trimmed);
    if (options.expectedAction && data.action && data.action !== options.expectedAction) {
      // Action mismatch = token minted for a different form. Treat as rejected in
      // enforce, note it in monitor.
      if (mode === 'monitor') {
        return monitored('monitored_fail', { reason: 'action_mismatch' });
      }
      return {
        ok: false,
        outcome: 'rejected',
        errorCodes: ['action-mismatch'],
        reason: 'Human verification did not match this form. Please retry.',
      };
    }
    if (mode === 'monitor') return monitored('monitored_pass', {});
    return { ok: true, outcome: 'success' };
  }

  // Definitive negative.
  rememberToken(trimmed); // a bad token is still spent — don't re-hit the network for it
  if (mode === 'monitor') {
    return monitored('monitored_fail', { errorCodes, reason: 'siteverify_failed' });
  }
  return {
    ok: false,
    outcome: 'rejected',
    errorCodes,
    reason: 'Human verification failed. Please retry.',
  };
}

// Handlers do not call this module directly — the sanctioned entry point is
// `antiSpamGate()` in `_shared/antiSpam.ts`, which composes this with the bot
// heuristics and the durable rate limiter and RETURNS a ready `Response` (a
// thrown `Response` would lose the `captchaFailed` flag through `handleEdgeError`).

export function readCaptchaToken(
  body: Record<string, unknown> | FormData | URLSearchParams
): string {
  if (body instanceof FormData || body instanceof URLSearchParams) {
    const v = body.get('captchaToken') ?? body.get('cf-turnstile-response');
    return typeof v === 'string' ? v : '';
  }
  const v = body['captchaToken'] ?? body['cf-turnstile-response'];
  return typeof v === 'string' ? v : '';
}

async function logCaptchaEvent(name: string, props: Record<string, unknown>): Promise<void> {
  // Reuse the exception pipeline as a lightweight structured logger (it no-ops
  // without POSTHOG_API_KEY). A synthetic Error keeps the call signature simple.
  try {
    await capturePostHogException(new Error(name), {
      logPrefix: `captcha:${name}`,
      extra: props,
    });
  } catch {
    // never let logging break verification
  }
}
