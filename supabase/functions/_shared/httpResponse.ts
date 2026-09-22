import { corsHeaders } from './cors.ts';
import { capturePostHogException } from './posthog.ts';
import { logEvent, resolveRequestId } from './requestLog.ts';
import { captureSentryException } from './sentry.ts';

/**
 * Response cache classification (production-readiness doc 11, Phase 11.1).
 *
 * Every JSON response gets an explicit `Cache-Control` — the safe default is
 * `private` (`private, no-store`), so a call site that forgets to classify
 * fails closed rather than letting an intermediary heuristically cache
 * tenant/guest PII. Only genuinely public, non-personalized data should ever
 * pass one of the `public*` classes — treat each one as a security-reviewed
 * decision (an accidental `publicDynamic` on an authenticated read is a
 * cross-tenant data leak), not a performance tweak.
 */
export type CacheClass =
  /** Plan catalog, platform brand, public app config, amenity/house-rule vocabularies. */
  | 'publicStatic'
  /** Property/parking listings, search results, public host profiles, public pages. */
  | 'publicDynamic'
  /** Calendar availability, pricing — short TTL; stale availability causes double bookings. */
  | 'publicAvailability'
  /** Every admin/host/org/property/parking read. Also the default. */
  | 'private'
  /** `get-form`, stay guide, signed-URL issuers, anything with a capability token. */
  | 'guestToken'
  /** All POST/PATCH/DELETE mutations. */
  | 'mutation';

const CACHE_CONTROL: Record<CacheClass, string> = {
  publicStatic: 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
  publicDynamic: 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
  publicAvailability: 'public, max-age=30, s-maxage=60',
  private: 'private, no-store',
  guestToken: 'no-store',
  mutation: 'no-store',
};

/** Classes considered cacheable by a shared/browser cache — everything else is a `no-store` shape. */
const PUBLIC_CACHE_CLASSES = new Set<CacheClass>([
  'publicStatic',
  'publicDynamic',
  'publicAvailability',
]);

/**
 * `Vary` for a cacheable response (Phase 11.2). CORS already varies the
 * response by `Origin` (`_shared/cors.ts`); `Accept-Encoding` covers
 * gzip/br variants a shared cache might store separately. Pass
 * `varyAuthorization: true` when a shared cache could ever see both an
 * authenticated and an anonymous variant of the same URL.
 */
function varyHeader(varyAuthorization: boolean): string {
  return varyAuthorization ? 'Origin, Accept-Encoding, Authorization' : 'Origin, Accept-Encoding';
}

/**
 * Cache-related headers for a given class. Non-public classes still get an
 * explicit `Cache-Control` (that's the whole point — fail closed, don't rely
 * on absence) but no `Vary`, since a `no-store` response is never stored by
 * anything that would need to disambiguate variants.
 */
function cacheHeaders(cacheClass: CacheClass, varyAuthorization = false): Record<string, string> {
  const headers: Record<string, string> = { 'Cache-Control': CACHE_CONTROL[cacheClass] };
  if (PUBLIC_CACHE_CLASSES.has(cacheClass)) {
    headers.Vary = varyHeader(varyAuthorization);
  }
  return headers;
}

export function jsonResponse(
  req: Request,
  body: unknown,
  status = 200,
  cacheClass: CacheClass = 'private'
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      'Content-Type': 'application/json',
      ...cacheHeaders(cacheClass),
    },
  });
}

/**
 * @param cacheClass Explicit cache classification — see `CacheClass`. Defaults to
 *   `'private'` (`private, no-store`) when omitted, which is the safe/fail-closed
 *   choice for every admin/tenant/guest-PII-scoped read. Pass one of the `public*`
 *   classes only for genuinely public, non-personalized data (see doc 11's
 *   classification table) — `scripts/dev/check-cache-class.sh` flags call sites
 *   that pass neither an explicit class nor go through the documented default.
 */
export function jsonSuccess(
  req: Request,
  data: unknown,
  extra?: Record<string, unknown>,
  cacheClass: CacheClass = 'private'
): Response {
  return jsonResponse(req, { success: true, data, ...extra }, 200, cacheClass);
}

export function jsonError(req: Request, error: string, status = 400, requestId?: string): Response {
  return jsonResponse(
    req,
    { success: false, error, ...(requestId ? { requestId } : {}) },
    status,
    'private'
  );
}

/**
 * FNV-1a over the serialized payload — fast, dependency-free, collision rate is
 * irrelevant here (ETag only needs to change when the payload changes, a false
 * "unchanged" is the only failure mode that matters and FNV-1a over a whole
 * JSON payload makes that astronomically unlikely for this use case). Not a
 * cryptographic hash and must never be used as one.
 */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * `jsonSuccess` + ETag/If-None-Match 304 handling for **Public dynamic** reads
 * (Phase 11.3). Only call this for a payload that is stable across requests for
 * the same query — **never** for a payload embedding a timestamp (`fetchedAt`,
 * `now`) or a freshly signed URL (both change every call and make the ETag
 * permanently non-matching, i.e. pure overhead with zero 304s). Those endpoints
 * should call `jsonSuccess(..., 'publicDynamic')` directly and skip ETag.
 */
export function jsonSuccessWithETag(
  req: Request,
  data: unknown,
  cacheClass: Extract<CacheClass, 'publicStatic' | 'publicDynamic' | 'publicAvailability'>,
  extra?: Record<string, unknown>
): Response {
  const body = { success: true, data, ...extra };
  const serialized = JSON.stringify(body);
  const etag = `"${fnv1a(serialized)}"`;
  const ifNoneMatch = req.headers.get('if-none-match');
  if (ifNoneMatch === etag) {
    return new Response(null, {
      status: 304,
      headers: { ...corsHeaders(req), ...cacheHeaders(cacheClass), ETag: etag },
    });
  }
  return new Response(serialized, {
    status: 200,
    headers: {
      ...corsHeaders(req),
      'Content-Type': 'application/json',
      ...cacheHeaders(cacheClass),
      ETag: etag,
    },
  });
}

/** Plan-tier or AI quota upgrade prompt — matches client `parseEdgeJsonOrQuota` / `upgradeHook` envelope. */
export function jsonUpgradeHook(
  req: Request,
  error: string,
  options?: { feature?: string; status?: number }
): Response {
  return jsonResponse(
    req,
    {
      success: false,
      error,
      upgradeHook: true,
      ...(options?.feature ? { feature: options.feature } : {}),
    },
    options?.status ?? 429
  );
}

export function handleOptions(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }
  return null;
}

/**
 * Several public GET endpoints accept an unguessable bearer-capability token via query
 * string (`?token=`/`?complete=` — get-guest-stay-guide, get-form-completion,
 * get-guest-booking-document, get-team-invite-preview, ical-export). `handleEdgeError`
 * forwards `req.url` to PostHog on captured exceptions, so a raw URL would leak that
 * token into a third-party system on any unexpected error. Redact every query param
 * *value* (keep the key names, still useful for diagnosing which params a failing
 * request carried) rather than maintaining a param-name denylist that a future
 * token-accepting endpoint could easily miss.
 */
function sanitizeUrlForTelemetry(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    for (const key of Array.from(new Set(url.searchParams.keys()))) {
      url.searchParams.set(key, '[redacted]');
    }
    return url.toString();
  } catch {
    return rawUrl;
  }
}

/**
 * Declares an intended HTTP status at the throw site instead of inferring one from the
 * message text. Prefer this over `throw new Error(...)` in new code: `errorMessageFromThrown`
 * has to guess a status for a bare Error, and its only safe guess for a handler-authored
 * message is 400 (see the status-inference notes there).
 *
 * `code` is a stable machine-readable slug (`booking_status_conflict`) that clients and
 * alerting can branch on without matching prose, which changes freely.
 */
export class EdgeError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, message: string, code = 'edge_error') {
    super(message);
    this.name = 'EdgeError';
    this.status = status;
    this.code = code;
  }
}

/** 400 — the request itself is malformed or fails validation. */
export function badRequest(message: string, code = 'bad_request'): EdgeError {
  return new EdgeError(400, message, code);
}

/** 409 — the request was valid but lost a race against concurrent state. */
export function statusConflict(message: string, code = 'status_conflict'): EdgeError {
  return new EdgeError(409, message, code);
}

/**
 * 500 — an invariant this code believes should hold did not. Distinct from an unexpected
 * throw only in that it is deliberate; both are traceable and both page.
 */
export function internalError(message: string, code = 'internal_error'): EdgeError {
  return new EdgeError(500, message, code);
}

export async function errorMessageFromThrown(
  error: unknown,
  unauthorizedFallback = 'Unauthorized'
): Promise<{ status: number; message: string; code?: string }> {
  if (error instanceof Response) {
    const status = error.status;
    const message = await error
      .clone()
      .json()
      .then((body: { error?: string }) => body.error ?? unauthorizedFallback)
      .catch(() => unauthorizedFallback);
    return { status, message };
  }

  // Explicit intent from the throw site always wins over inference.
  if (error instanceof EdgeError) {
    return { status: error.status, message: error.message, code: error.code };
  }

  // A non-Error throw (`throw 'oops'`, a rejected non-Error, a TypeError surfacing as a
  // bare object) cannot carry handler intent, so it is a crash. Returning 400 here used to
  // both mislabel it and — because handleEdgeError attaches a requestId on 5xx only —
  // strip the one identifier that made it traceable. Generic message: an unexpected throw
  // can carry internals (SQL, stack text) that should not reach a client.
  if (!(error instanceof Error)) {
    return { status: 500, message: 'Internal server error', code: 'unexpected_throw' };
  }

  const message = error.message || 'Request failed';

  // Legacy string-prefix path. Superseded by `statusConflict()`; kept because
  // `databaseService.ts` and `bookingDetailsPatch.ts` still throw the prefixed string.
  if (message.startsWith('STATUS_CONFLICT:')) {
    return {
      status: 409,
      message: message.replace(/^STATUS_CONFLICT:\s*/, ''),
      code: 'status_conflict',
    };
  }

  // A bare `new Error(...)` is overwhelmingly handler-authored validation in this codebase
  // ("property_id is required"), so 400 stays the default and its message is passed through.
  // The cost is that a genuine runtime Error (a TypeError from a bad property access) is
  // also reported as 400. Narrowing that needs the throw sites converted to `EdgeError`
  // first — a blanket flip to 500 here would turn every validation failure into a false
  // 5xx alert. Native runtime error types are the unambiguous subset, so they go now.
  if (
    error instanceof TypeError ||
    error instanceof RangeError ||
    error instanceof ReferenceError ||
    error instanceof SyntaxError
  ) {
    return { status: 500, message: 'Internal server error', code: 'runtime_error' };
  }

  return { status: 400, message };
}

export async function handleEdgeError(
  req: Request,
  error: unknown,
  logPrefix: string,
  unauthorizedFallback = 'Unauthorized'
): Promise<Response> {
  const { status, message, code } = await errorMessageFromThrown(error, unauthorizedFallback);
  const requestId = resolveRequestId(req);
  // Response-instance throws are intentional control flow (401/403/expected 400s).
  // Logging the Response object as console.error looks like a crash in `functions serve`.
  // An EdgeError below 500 is the same: a status the handler chose on purpose.
  const isDeliberate4xx = (error instanceof Response || error instanceof EdgeError) && status < 500;
  if (isDeliberate4xx) {
    console.warn(`${logPrefix} ${status} ${message}`);
    logEvent('warn', { fn: logPrefix, requestId, event: 'request_failed', status, meta: { code } });
  } else {
    console.error(logPrefix, error);
    logEvent('error', {
      fn: logPrefix,
      requestId,
      event: 'request_failed',
      status,
      meta: { code },
    });
    const safeUrl = sanitizeUrlForTelemetry(req.url);
    // PostHog keeps the exception history; Sentry carries the alert (doc 28 records
    // PostHog alerting as operator-blocked). Settled together so one vendor being slow
    // or down cannot make the other wait, and neither can fail the response — both
    // swallow their own errors internally.
    await Promise.allSettled([
      capturePostHogException(error, {
        logPrefix,
        request: req,
        extra: { status, message, code, url: safeUrl, requestId },
      }),
      captureSentryException(error, {
        logPrefix,
        requestId,
        url: safeUrl,
        method: req.method,
        extra: { status, message, code },
      }),
    ]);
  }
  // 5xx only — a 4xx is often expected client-side flow (validation, not-found) and
  // showing "Reference: <id>" there would be noise, not a debugging aid.
  return jsonError(req, message, status, status >= 500 ? requestId : undefined);
}

export async function readJsonBody(req: Request): Promise<Record<string, unknown>> {
  return (await req.json().catch(() => ({}))) as Record<string, unknown>;
}

export function requireHttpMethod(req: Request, method: string): void {
  if (req.method !== method) {
    throw new Error(`Method ${req.method} not allowed`);
  }
}

export function parseAction(body: Record<string, unknown>): string {
  return typeof body.action === 'string' ? body.action : '';
}

export function parseDraftText(body: Record<string, unknown>, maxLength = 8000): string | null {
  const text = typeof body.text === 'string' ? body.text : '';
  if (!text.trim()) return null;
  return text.slice(0, maxLength);
}

export function parseDraftScenario(body: Record<string, unknown>, defaultScenario = ''): string {
  return typeof body.scenario === 'string' ? body.scenario : defaultScenario;
}

/** Shared list pagination from URL search params (super-admin + bookings lists). */
export function parsePageLimit(
  searchParams: URLSearchParams,
  defaults: { page?: number; limit?: number; maxLimit?: number } = {}
): { page: number; limit: number } {
  const defaultPage = defaults.page ?? 1;
  const defaultLimit = defaults.limit ?? 31;
  const maxLimit = defaults.maxLimit ?? 100;
  const page = Math.max(
    1,
    parseInt(searchParams.get('page') ?? String(defaultPage), 10) || defaultPage
  );
  const limit = Math.min(
    maxLimit,
    Math.max(1, parseInt(searchParams.get('limit') ?? String(defaultLimit), 10) || defaultLimit)
  );
  return { page, limit };
}

export function readInvitationId(body: Record<string, unknown>, url?: URL): string {
  if (typeof body.invitationId === 'string' && body.invitationId.trim()) {
    return body.invitationId.trim();
  }
  return url?.searchParams.get('invitationId')?.trim() ?? '';
}

export function jsonErrorFromCatch(
  req: Request,
  error: unknown,
  fallback: string,
  options?: { conflictOnAlready?: boolean }
): Response {
  const message = error instanceof Error ? error.message : fallback;
  const status = options?.conflictOnAlready && message.includes('already') ? 409 : 400;
  return jsonError(req, message, status);
}
