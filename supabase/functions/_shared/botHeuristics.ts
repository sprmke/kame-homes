/**
 * Cheap, invisible first-line bot filters for public forms — no IO, no external calls.
 * Plan: docs/workflow/in-progress/production-readiness/audits/captcha-anti-spam-hardening.md (Phase 1, Layer 0)
 *
 * These run *before* the CAPTCHA `siteverify` round-trip so obvious scripted
 * submissions are rejected without spending a network call or a provider quota.
 * They are intentionally forgiving — a real user must never trip them — so they
 * are a signal, not the whole defense (CAPTCHA + durable rate limit sit behind).
 *
 * Client contract (see `ui/src/lib/security/useCaptchaToken.ts` +
 * `ui/src/components/security/HoneypotField.tsx`):
 *   - a decoy input named `contact_time` (HONEYPOT_FIELD) that is visually hidden,
 *     `tabindex=-1`, `autocomplete=off` — real users never fill it, many bots do.
 *   - a hidden `formLoadedAt` field stamped with `Date.now()` when the form mounts.
 */

export const HONEYPOT_FIELD = 'contact_time';
export const FORM_LOADED_AT_FIELD = 'formLoadedAt';

/** Minimum plausible time a human needs between form render and submit. */
export const DEFAULT_MIN_ELAPSED_MS = 1_500;
/**
 * Upper bound guard: a `formLoadedAt` further in the past than this is treated as
 * missing/replayed rather than a genuine long-lived tab (which would re-stamp on
 * interaction anyway). 12h comfortably covers a form left open overnight.
 */
export const MAX_ELAPSED_MS = 12 * 60 * 60 * 1000;

export type HeuristicResult = { ok: true } | { ok: false; reason: string };

type BodyLike =
  Record<string, unknown> | FormData | URLSearchParams | { get(key: string): unknown };

function readField(body: BodyLike, key: string): string {
  if (body instanceof FormData || body instanceof URLSearchParams) {
    const v = body.get(key);
    return typeof v === 'string' ? v : '';
  }
  if (typeof (body as { get?: unknown }).get === 'function') {
    const v = (body as { get(k: string): unknown }).get(key);
    return typeof v === 'string' ? v : '';
  }
  const v = (body as Record<string, unknown>)[key];
  return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '';
}

/** Decoy field must be empty. Trims first so a stray space from an autofill quirk still passes. */
export function checkHoneypot(body: BodyLike, field: string = HONEYPOT_FIELD): HeuristicResult {
  const value = readField(body, field).trim();
  if (value.length > 0) {
    return { ok: false, reason: 'honeypot_filled' };
  }
  return { ok: true };
}

/**
 * Reject implausibly fast submits. Absent/garbage/again-in-the-future timestamps are
 * treated as *pass* — we never want to block a real user because a hidden field was
 * stripped by a privacy extension; the CAPTCHA + rate limiter still apply.
 */
export function checkMinElapsed(
  body: BodyLike,
  minMs: number = DEFAULT_MIN_ELAPSED_MS,
  field: string = FORM_LOADED_AT_FIELD
): HeuristicResult {
  const raw = readField(body, field).trim();
  if (!raw) return { ok: true };

  const loadedAt = Number(raw);
  if (!Number.isFinite(loadedAt) || loadedAt <= 0) return { ok: true };

  const elapsed = Date.now() - loadedAt;
  // Future timestamp (client clock skew) or older than the sanity ceiling → can't
  // trust it, don't punish it.
  if (elapsed < 0 || elapsed > MAX_ELAPSED_MS) return { ok: true };

  if (elapsed < minMs) {
    return { ok: false, reason: 'submitted_too_fast' };
  }
  return { ok: true };
}

/** Run both filters; first failure wins. */
export function checkBotHeuristics(
  body: BodyLike,
  options: { minElapsedMs?: number; honeypotField?: string; loadedAtField?: string } = {}
): HeuristicResult {
  const honeypot = checkHoneypot(body, options.honeypotField);
  if (!honeypot.ok) return honeypot;
  return checkMinElapsed(body, options.minElapsedMs, options.loadedAtField);
}
