/**
 * Durable fixed-window rate limiting for public + lightly-authenticated writes.
 * Plan: docs/workflow/for-testing/captcha-anti-spam-hardening.md (Phase 1, Layer 3)
 *
 * Backed by `request_rate_limits` + the `bump_rate_limit()` SQL function
 * (migration 20261304120000). Unlike `_shared/publicRateLimit.ts` (per-isolate,
 * memory-only) this counter is shared across every edge isolate and survives
 * cold starts, so it is a real quota rather than a burst dampener.
 *
 * Fixed-window (not sliding): cheap, one RPC per request, good enough for
 * anti-abuse where the exact boundary doesn't matter. Worst case a caller gets
 * ~2x `limit` across a window edge — acceptable.
 *
 * Fails OPEN on any DB error (logged): a transient problem with the counter
 * table must never take down a booking form. CAPTCHA + bot heuristics still run.
 *
 * Fail-open vs fail-closed (production-readiness doc 23):
 * - This primitive (public GET/write, authenticated-wrapper log-only) fails OPEN.
 * - AI spend is a different control: `assertOrgAndPropertyAiQuota` fails CLOSED
 *   before the model call (`AiQuotaExceededError` / `AiPlatformDisabledError`).
 * - Cron secret gate fails CLOSED in production when the secret is unset.
 */

import { corsHeaders } from './cors.ts';
import { createServiceClient } from './orgAuth.ts';
import { capturePostHogException } from './posthog.ts';
import { clientIpFromRequest } from './publicRateLimit.ts';

export type RateLimitDecision = {
  allowed: boolean;
  /** Requests used in the current window (best-effort; 0 when the check failed open). */
  count: number;
  limit: number;
  /** Seconds until the current window resets. */
  retryAfterSec: number;
};

export type RateLimitOptions = {
  scope: string;
  identity: string;
  limit: number;
  windowSec: number;
};

let sweptAt = 0;
const SWEEP_MIN_INTERVAL_MS = 5 * 60_000;
const SWEEP_RETENTION_MS = 24 * 60 * 60_000;

function windowStartIso(windowSec: number, now = Date.now()): string {
  const windowMs = windowSec * 1000;
  return new Date(Math.floor(now / windowMs) * windowMs).toISOString();
}

function retryAfterSec(windowSec: number, now = Date.now()): number {
  const windowMs = windowSec * 1000;
  const elapsed = now % windowMs;
  return Math.max(1, Math.ceil((windowMs - elapsed) / 1000));
}

/**
 * Identity key for a limit bucket: the authenticated user id when we have one,
 * otherwise the best-effort client IP. Prefixed so an IP and a UUID can never
 * collide across scopes.
 */
export function identityFromRequest(req: Request, user?: { id?: string | null } | null): string {
  const uid = user?.id?.trim();
  if (uid) return `u:${uid}`;
  return `ip:${clientIpFromRequest(req)}`;
}

async function maybeSweep(supabase: ReturnType<typeof createServiceClient>): Promise<void> {
  const now = Date.now();
  if (now - sweptAt < SWEEP_MIN_INTERVAL_MS) return;
  if (Math.random() > 0.05) return;
  sweptAt = now;
  const cutoff = new Date(now - SWEEP_RETENTION_MS).toISOString();
  await supabase
    .from('request_rate_limits')
    .delete()
    .lt('window_start', cutoff)
    .then(
      () => {},
      () => {}
    );
}

/** Non-throwing check. Returns a decision; fails open (`allowed: true`) on error. */
export async function checkRateLimit(options: RateLimitOptions): Promise<RateLimitDecision> {
  const { scope, identity, limit, windowSec } = options;
  const now = Date.now();
  const base: RateLimitDecision = {
    allowed: true,
    count: 0,
    limit,
    retryAfterSec: retryAfterSec(windowSec, now),
  };

  try {
    const supabase = createServiceClient();
    void maybeSweep(supabase);

    const { data, error } = await supabase.rpc('bump_rate_limit', {
      p_scope: scope,
      p_identity: identity,
      p_window_start: windowStartIso(windowSec, now),
    });

    if (error) {
      // Function missing (older env) or transient failure → fail open, logged.
      await capturePostHogException(error, {
        logPrefix: 'rateLimit:bump',
        extra: { scope, code: (error as { code?: string }).code },
      });
      return base;
    }

    const count = typeof data === 'number' ? data : Number(data ?? 0);
    return {
      allowed: count <= limit,
      count,
      limit,
      retryAfterSec: retryAfterSec(windowSec, now),
    };
  } catch (error) {
    await capturePostHogException(error, { logPrefix: 'rateLimit:bump', extra: { scope } });
    return base;
  }
}

/**
 * Non-throwing gate for edge handlers: returns a ready-to-send CORS-headed 429
 * `Response` (full envelope + `Retry-After`) when the caller is over the limit,
 * or `null` when they may proceed. Fails open (returns `null`) on any counter
 * error. Use as:
 *
 *   const limited = await rateLimitGate(req, { scope, identity, limit, windowSec });
 *   if (limited) return limited;
 *
 * Do NOT throw a 429 `Response` from a handler instead — `handleEdgeError`
 * preserves the status + `error` string but drops the `rateLimited` /
 * `retryAfterSec` fields and the `Retry-After` header the UI keys off.
 */
export async function rateLimitGate(
  req: Request,
  options: RateLimitOptions
): Promise<Response | null> {
  const decision = await checkRateLimit(options);
  if (decision.allowed) return null;

  return new Response(
    JSON.stringify({
      success: false,
      error: 'Too many requests. Please wait a moment and try again.',
      retryAfterSec: decision.retryAfterSec,
      rateLimited: true,
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders(req),
        'Content-Type': 'application/json',
        'Retry-After': String(decision.retryAfterSec),
      },
    }
  );
}
