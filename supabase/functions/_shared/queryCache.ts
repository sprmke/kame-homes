/**
 * Generic read-through query cache (doc 12, Phase 12.3).
 *
 * Shape mirrors `_shared/aiQuotaCache.ts` (content-addressed key, explicit TTL, best-effort
 * writes) over the `query_cache` table (migration
 * `20261316121700_query_cache_table.sql`).
 *
 * SECURITY — read the migration's header comment before adding a new call site. The cache
 * key must fold in every scope + permission dimension of the read it caches: org id,
 * property/parking id, filters, date range, AND the viewer's resolved permission set. A key
 * missing a permission dimension serves privileged data to an unprivileged viewer — the
 * single most dangerous bug class this file exists to prevent. `buildCacheKey` takes an
 * explicit `permissionScope` argument for exactly this reason; do not build a key by hand
 * that omits it for an endpoint where permissions vary per viewer.
 *
 * Stampede protection — v1, honestly scoped: this is "first request wins, close-together
 * duplicates both compute" plus a short soft lock, NOT true single-flight. A row is written
 * with a `computing` sentinel payload and a short (`LOCK_TTL_MS`) expiry before the actual
 * compute starts; a second request landing inside that window sees the sentinel and falls
 * through to computing itself rather than waiting on the first request's result (edge
 * functions have no shared in-memory signal to wait on, and a durable wait/notify would need
 * infra this pass doesn't have — Postgres LISTEN/NOTIFY or an advisory-lock-based blocking
 * wait). This still bounds the worst case (a request never blocks on another instance) at the
 * cost of not fully deduping a true thundering herd. Documented here per the doc's explicit
 * instruction to be honest about which variant was built.
 */

import { createServiceClient } from './orgAuth.ts';

/** Bump whenever a cached payload's shape changes — invalidates every existing key on deploy. */
export const QUERY_CACHE_SCHEMA_VERSION = 1;

const COMPUTING_SENTINEL = '__query_cache_computing__';
/** How long a "computing" placeholder row blocks a second writer before being treated as stale
 *  (falls through to recompute rather than truly waiting — see file header). */
const LOCK_TTL_MS = 10_000;

export type QueryCacheScope = {
  orgId?: string | null;
  propertyId?: string | null;
  parkingId?: string | null;
};

/**
 * Build a schema-versioned, scope-complete cache key. `permissionScope` must capture
 * anything that changes what the viewer is allowed to see for the same org/property/parking —
 * e.g. a scoped org admin's resolved assigned-listing id set. Pass a stable, sorted
 * representation (this function does not sort for you) so equivalent scopes hash identically.
 */
export function buildCacheKey(parts: {
  namespace: string;
  scope: QueryCacheScope;
  /** Free-form request-shape discriminator: filters, date range, sort, etc. */
  params?: Record<string, unknown>;
  /** REQUIRED whenever the endpoint's result can differ by viewer permission (e.g. a
   *  scoped-vs-all-listings org admin). Pass `null` only for endpoints with no such variance
   *  (e.g. a single-property request already fully scoped by propertyId, where property-level
   *  access was already verified pre-cache-read and doesn't change the payload shape). */
  permissionScope: string[] | null;
}): string {
  const { namespace, scope, params, permissionScope } = parts;
  const canonical = JSON.stringify({
    v: QUERY_CACHE_SCHEMA_VERSION,
    ns: namespace,
    org: scope.orgId ?? null,
    property: scope.propertyId ?? null,
    parking: scope.parkingId ?? null,
    // Sorted so key order never changes the hash for logically-identical scope sets.
    perm: permissionScope ? [...permissionScope].sort() : null,
    params: params ?? null,
  });
  return `v${QUERY_CACHE_SCHEMA_VERSION}:${namespace}:${simpleHash(canonical)}`;
}

/** Small, fast, non-cryptographic hash — this key only needs to be collision-resistant for
 *  cache correctness, not tamper-proof (unlike aiQuotaCache's SHA-256 content-addressing,
 *  which fingerprints untrusted-ish AI prompt inputs). Deno's crypto.subtle is async-only; a
 *  sync hash keeps buildCacheKey callable from hot, synchronous call sites. */
function simpleHash(input: string): string {
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

/** ±10% TTL jitter (doc 12, Phase 12.4) so entries created together don't expire together. */
function jitteredTtlMs(baseTtlMs: number): number {
  const jitter = baseTtlMs * 0.1;
  const offset = (Math.random() * 2 - 1) * jitter;
  return Math.max(1_000, Math.round(baseTtlMs + offset));
}

async function readRow(
  cacheKey: string
): Promise<{ payload: unknown; expiresAt: string; computing: boolean } | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('query_cache')
    .select('payload, expires_at, computed_at')
    .eq('cache_key', cacheKey)
    .maybeSingle();
  if (error) {
    console.warn('[queryCache] read failed:', error.message);
    return null;
  }
  if (!data) return null;
  const computing =
    typeof data.payload === 'object' &&
    data.payload !== null &&
    (data.payload as Record<string, unknown>).__sentinel === COMPUTING_SENTINEL;
  return { payload: data.payload, expiresAt: data.expires_at as string, computing };
}

/** Best-effort write — a failed cache write must never fail the caller (mirrors aiQuotaCache). */
async function writeRow(args: {
  cacheKey: string;
  payload: unknown;
  ttlMs: number;
  scope: QueryCacheScope;
}): Promise<void> {
  try {
    const supabase = createServiceClient();
    const expiresAt = new Date(Date.now() + args.ttlMs).toISOString();
    const { error } = await supabase.from('query_cache').upsert(
      {
        cache_key: args.cacheKey,
        payload: args.payload,
        scope_org_id: args.scope.orgId ?? null,
        scope_property_id: args.scope.propertyId ?? null,
        scope_parking_id: args.scope.parkingId ?? null,
        computed_at: new Date().toISOString(),
        expires_at: expiresAt,
        schema_version: QUERY_CACHE_SCHEMA_VERSION,
      },
      { onConflict: 'cache_key' }
    );
    if (error) console.warn('[queryCache] write failed:', error.message);
  } catch (err) {
    console.warn('[queryCache] write threw:', (err as Error).message);
  }
}

export type ReadThroughOptions = {
  cacheKey: string;
  scope: QueryCacheScope;
  ttlMs: number;
  compute: () => Promise<unknown>;
};

/**
 * Read-through get-or-compute. On a miss (or expired/stale-lock row), writes a short-lived
 * "computing" sentinel first (soft single-flight, see file header), computes, then writes the
 * real payload with jittered TTL. On any cache read/write failure, falls back to computing
 * directly — a broken cache must never break the underlying feature.
 */
export async function readThrough<T>(options: ReadThroughOptions): Promise<T> {
  const { cacheKey, scope, ttlMs, compute } = options;

  const existing = await readRow(cacheKey);
  const now = Date.now();
  if (existing && !existing.computing && new Date(existing.expiresAt).getTime() > now) {
    return existing.payload as T;
  }
  if (existing?.computing && new Date(existing.expiresAt).getTime() > now) {
    // Another request is (probably) already computing this key and the soft lock hasn't
    // expired yet. No durable wait available (see file header) — compute independently
    // rather than block. This is the documented "both compute" branch of the v1 tradeoff.
  }

  // Soft lock: best-effort, never blocks the caller if it fails.
  await writeRow({
    cacheKey,
    payload: { __sentinel: COMPUTING_SENTINEL },
    ttlMs: LOCK_TTL_MS,
    scope,
  });

  const result = await compute();
  await writeRow({ cacheKey, payload: result, ttlMs: jitteredTtlMs(ttlMs), scope });
  return result as T;
}

/** Wholesale purge for one scope dimension — used by invalidation (doc 12, Phase 12.5). */
export async function purgeCacheByScope(scope: QueryCacheScope): Promise<void> {
  try {
    const supabase = createServiceClient();
    let query = supabase.from('query_cache').delete();
    if (scope.propertyId) {
      query = query.eq('scope_property_id', scope.propertyId);
    } else if (scope.parkingId) {
      query = query.eq('scope_parking_id', scope.parkingId);
    } else if (scope.orgId) {
      query = query.eq('scope_org_id', scope.orgId);
    } else {
      return;
    }
    const { error } = await query;
    if (error) console.warn('[queryCache] purge failed:', error.message);
  } catch (err) {
    console.warn('[queryCache] purge threw:', (err as Error).message);
  }
}

/** Sweep expired rows — called by the nightly `query-cache-sweep-cron` function. Also caps
 *  table growth (doc 12, Phase 12.3's "a cache table that grows forever becomes the next
 *  expensive query"). */
export async function sweepExpiredCacheRows(): Promise<{ deleted: number }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('query_cache')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .select('cache_key');
  if (error) throw new Error(`query_cache sweep failed: ${error.message}`);
  return { deleted: data?.length ?? 0 };
}
