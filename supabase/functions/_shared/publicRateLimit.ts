/**
 * Lightweight in-memory per-IP rate limiter for public edge functions.
 *
 * Deno isolate memory is not shared across instances and resets on cold start —
 * this is a best-effort throttle for burst keystroke abuse (search-suggestions),
 * not a durable global quota. Prefer platform WAF / API gateway limits for prod hardening.
 *
 * Pattern: first of its kind in this codebase (search-suggestions). Reuse for other
 * high-frequency public GETs when needed.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
};

/**
 * Sliding fixed-window counter keyed by `${scope}:${ip}`.
 * Default: 60 requests / 60s (enough for debounced typeahead, tight enough to blunt scrapers).
 */
export function checkIpRateLimit(
  scope: string,
  ip: string,
  limit = 60,
  windowMs = 60_000
): RateLimitResult {
  const key = `${scope}:${ip || 'unknown'}`;
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSec: Math.ceil(windowMs / 1000) };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
}

/**
 * Best-effort client IP from edge-trusted headers first.
 * Prefer `cf-connecting-ip` / `x-real-ip` (set by Supabase/Kong/Cloudflare) over
 * `x-forwarded-for`, which clients can spoof when it is the only signal.
 */
export function clientIpFromRequest(req: Request): string {
  const cf = req.headers.get('cf-connecting-ip')?.trim();
  if (cf) return cf;
  const realIp = req.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return 'unknown';
}

/** Periodically drop expired buckets to avoid unbounded Map growth in long-lived isolates. */
export function pruneExpiredRateLimitBuckets(now = Date.now()): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}
