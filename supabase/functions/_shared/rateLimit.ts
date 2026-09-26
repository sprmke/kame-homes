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
 * - This primitive (public GET/write, authenticated-wrapper default) fails OPEN
 *   on a counter/DB error. Enforcement itself (429 vs log-only) is a separate,
 *   super-admin-controlled switch — see `platform_settings.authenticated_rate_limit_enforce`
 *   and `serveEdge.ts`'s `enforceOrLogRateCheck`.
 * - AI spend is a different control: `assertOrgAndPropertyAiQuota` fails CLOSED
 *   before the model call (`AiQuotaExceededError` / `AiPlatformDisabledError`).
 * - Cron secret gate fails CLOSED in production when the secret is unset.
 * - The manual block list (`rate_limit_blocks`, `isIdentityBlocked`) fails OPEN
 *   on a read error — an outage there must not block every authenticated request.
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

/**
 * Manual super-admin block list (`rate_limit_blocks`, doc 23 Phase 23.6) — checked
 * ahead of the rolling-window count so a super admin can immediately cut off an
 * actively-abusive identity without waiting for a window to roll over. Short
 * isolate-local cache (block/unblock is rare and not latency-sensitive) so this
 * never adds a DB round-trip to the hot path for the common "not blocked" case.
 * Fails OPEN on any error — same posture as the rest of this module.
 */
const BLOCK_CACHE_TTL_MS = 30_000;
let blockedCache: { at: number; identities: Set<string> } | null = null;

async function loadBlockedIdentities(
  supabase: ReturnType<typeof createServiceClient>
): Promise<Set<string>> {
  const now = Date.now();
  if (blockedCache && now - blockedCache.at < BLOCK_CACHE_TTL_MS) {
    return blockedCache.identities;
  }
  try {
    const { data, error } = await supabase
      .from('rate_limit_blocks')
      .select('identity, expires_at')
      .or(`expires_at.is.null,expires_at.gt.${new Date(now).toISOString()}`);
    if (error) throw error;
    const identities = new Set((data ?? []).map((row) => row.identity as string));
    blockedCache = { at: now, identities };
    return identities;
  } catch (error) {
    await capturePostHogException(error, { logPrefix: 'rateLimit:blockList' });
    // Fail open: an outage reading the (rarely-written) block list must not
    // itself start blocking every authenticated request.
    return blockedCache?.identities ?? new Set();
  }
}

/** True when `identity` is on the manual super-admin block list right now. */
export async function isIdentityBlocked(identity: string): Promise<boolean> {
  try {
    const supabase = createServiceClient();
    const identities = await loadBlockedIdentities(supabase);
    return identities.has(identity);
  } catch {
    return false;
  }
}

/** Test helper — bust the isolate-local block-list cache between Deno tests. */
export function resetBlockedIdentitiesCacheForTests(): void {
  blockedCache = null;
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
