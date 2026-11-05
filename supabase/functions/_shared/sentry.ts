import { scrubRecord, scrubUrl } from './telemetryScrub.ts';

/**
 * Server-side Sentry for edge functions — alerting on unexpected faults.
 *
 * Sentry owns faults; PostHog owns outcomes (docs/architecture/observability.md). One
 * exception is reported once, here, and never duplicated into PostHog.
 *
 * Uses the Sentry **envelope HTTP API** directly rather than an SDK: the Deno SDK pulls a
 * large dependency tree into every one of ~300 isolates for what is one POST of a JSON
 * envelope, and cold-start cost is paid per isolate.
 *
 * **Fails silent and open.** No DSN, a malformed DSN, a sampler that says no, or an
 * unreachable Sentry all degrade to a no-op. Telemetry must never turn a working request
 * into a failed one, so every entry point swallows its own errors.
 *
 * Never send PII. `extra` runs through the shared `telemetryScrub` deny list, and URLs are
 * scrubbed of capability-token query values before they leave the isolate.
 */

const CAPTURE_TIMEOUT_MS = 3000;

/** Identical `(fingerprint, message)` pairs inside this window are one incident, not N. */
const DEDUPE_WINDOW_MS = 60_000;
const DEDUPE_MAX_ENTRIES = 50;

/**
 * A runaway loop can otherwise spend the whole monthly error quota in minutes and leave
 * the rest of the month blind. Dropping after the cap keeps the signal that something is
 * broken while bounding the cost.
 */
const RATE_CAP_PER_MINUTE = 30;

const DEFAULT_WARNING_SAMPLE_RATE = 0.25;

export type SentryLevel = 'error' | 'warning' | 'info';

export type SentryCaptureOptions = {
  /** Function name. Becomes `logger`, `transaction` and the `fn` tag. */
  logPrefix: string;
  requestId?: string;
  /** Already scrubbed. Pass `sanitizeUrlForTelemetry(req.url)`, never raw `req.url`. */
  url?: string;
  method?: string;
  userAgent?: string;
  /** Pseudonymous Supabase user id only — never an email. */
  userId?: string;
  tags?: Record<string, string | undefined>;
  extra?: Record<string, unknown>;
  level?: SentryLevel;
  /** Stable grouping when the message text varies between occurrences. */
  fingerprint?: string[];
  /** Raw `sentry-trace` header, to link the browser trace with this event. */
  traceHeader?: string | null;
};

type ParsedDsn = {
  envelopeUrl: string;
  publicKey: string;
};

let parsedDsn: ParsedDsn | null | undefined;

/**
 * A Sentry DSN is `https://<publicKey>@<host>/<projectId>`; the ingest endpoint is
 * `https://<host>/api/<projectId>/envelope/`.
 */
function parseDsn(raw: string): ParsedDsn | null {
  try {
    const url = new URL(raw);
    const publicKey = url.username;
    const projectId = url.pathname.replace(/^\/+/, '').trim();
    if (!publicKey || !projectId) return null;
    return {
      envelopeUrl: `${url.protocol}//${url.host}/api/${projectId}/envelope/`,
      publicKey,
    };
  } catch {
    return null;
  }
}

function getDsn(): ParsedDsn | null {
  if (parsedDsn !== undefined) return parsedDsn;
  const raw = (Deno.env.get('SENTRY_DSN') ?? '').trim();
  if (!raw) {
    parsedDsn = null;
    return parsedDsn;
  }
  parsedDsn = parseDsn(raw);
  if (!parsedDsn) {
    // Loud, because a typo'd DSN otherwise looks exactly like "no alerts configured".
    console.error('[sentry] SENTRY_DSN is set but could not be parsed; Sentry disabled');
  }
  return parsedDsn;
}

/** Shared with the browser's `VITE_APP_VERSION` so both sides name the same commit. */
function releaseTag(): string | undefined {
  const value = (Deno.env.get('APP_RELEASE') ?? '').trim();
  return value || undefined;
}

/**
 * True when this isolate is a deployed function rather than `functions serve` on a laptop.
 *
 * `DENO_DEPLOYMENT_ID` is a Deno Deploy variable and Supabase never sets it, so the old
 * check always fell through to "local" and every deployed event was tagged `local`. That
 * makes a laptop indistinguishable from production and silently breaks alert rules scoped
 * to an environment. The Supabase URL is the signal that actually exists here.
 */
function isDeployedRuntime(): boolean {
  if (Deno.env.get('DENO_DEPLOYMENT_ID')) return true;
  const url = (Deno.env.get('SUPABASE_URL') ?? Deno.env.get('API_URL') ?? '').trim();
  if (!url) return false;
  return !/(127\.0\.0\.1|localhost|0\.0\.0\.0)/.test(url);
}

function environmentTag(): 'local' | 'preview' | 'production' {
  const explicit = (Deno.env.get('ENVIRONMENT') ?? Deno.env.get('DENO_ENV') ?? '')
    .trim()
    .toLowerCase();

  if (explicit === 'production' || explicit === 'prod') return 'production';
  if (explicit === 'preview' || explicit === 'staging') return 'preview';
  if (explicit === 'local') return 'local';
  if (explicit === 'dev' || explicit === 'development') {
    // A deployed dev environment is still deployed. Tagging it `local` is what hid every
    // edge event from an environment filter in the first place.
    return isDeployedRuntime() ? 'preview' : 'local';
  }

  // Unset: a deployed project default is production; a laptop is local.
  return isDeployedRuntime() ? 'production' : 'local';
}

/** Fraction of `warning` events to send. Errors are never sampled. */
function warningSampleRate(): number {
  const raw = (Deno.env.get('SENTRY_SAMPLE_RATE_WARNING') ?? '').trim();
  if (!raw) return DEFAULT_WARNING_SAMPLE_RATE;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_WARNING_SAMPLE_RATE;
  return Math.min(1, parsed);
}

/**
 * `EdgeRuntime.waitUntil` is a Supabase-provided global, not in Deno's lib types.
 *
 * Kept local rather than imported from `backgroundTask.ts`: that module now imports this
 * one for `captureSideEffectFailure`, and a cycle between a telemetry module and the
 * background-task runner is not worth the eight saved lines.
 */
function deferToIsolate(promise: Promise<unknown>): void {
  try {
    const runtime = (globalThis as unknown as { EdgeRuntime?: { waitUntil?: unknown } })
      .EdgeRuntime;
    if (typeof runtime?.waitUntil === 'function') {
      (runtime.waitUntil as (p: Promise<unknown>) => void).call(runtime, promise);
      return;
    }
  } catch {
    // fall through to awaiting
  }
  void promise;
}

// ───────────────────────── per-isolate guards ────────────────────────────────

const dedupeSeen = new Map<string, number>();

function isDuplicate(key: string, now: number): boolean {
  for (const [seenKey, at] of dedupeSeen) {
    if (now - at > DEDUPE_WINDOW_MS) dedupeSeen.delete(seenKey);
  }
  const previous = dedupeSeen.get(key);
  if (previous !== undefined && now - previous <= DEDUPE_WINDOW_MS) return true;

  dedupeSeen.set(key, now);
  if (dedupeSeen.size > DEDUPE_MAX_ENTRIES) {
    const oldest = dedupeSeen.keys().next().value;
    if (oldest !== undefined) dedupeSeen.delete(oldest);
  }
  return false;
}

let rateWindowStart = 0;
let rateWindowCount = 0;

function overRateCap(now: number): boolean {
  if (now - rateWindowStart > 60_000) {
    rateWindowStart = now;
    rateWindowCount = 0;
  }
  rateWindowCount += 1;
  return rateWindowCount > RATE_CAP_PER_MINUTE;
}

// ───────────────────────────── event shape ──────────────────────────────────

/** Sentry groups by the first frames, so keep the top of the stack, not the bottom. */
function stackFrames(error: Error): Array<{ filename: string; function: string; lineno?: number }> {
  const lines = (error.stack ?? '').split('\n').slice(1, 21);
  const frames: Array<{ filename: string; function: string; lineno?: number }> = [];
  for (const line of lines) {
    const match = line.match(/at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?$/);
    if (!match) continue;
    frames.push({
      function: match[1] ?? '<anonymous>',
      filename: match[2] ?? '<unknown>',
      lineno: Number(match[3]) || undefined,
    });
  }
  // Sentry renders frames oldest-first.
  return frames.reverse();
}

/**
 * `sentry-trace` is `traceId-spanId-sampled`. Forwarding it is what lets a browser
 * transaction and the edge event behind it appear as one trace instead of two strangers.
 * Malformed headers are ignored rather than guessed at.
 */
function traceContext(
  header: string | null | undefined
): { trace_id: string; span_id: string; op?: string } | null {
  if (!header) return null;
  const [traceId, spanId] = header.trim().split('-');
  if (!traceId || !spanId) return null;
  if (!/^[0-9a-f]{32}$/i.test(traceId) || !/^[0-9a-f]{16}$/i.test(spanId)) return null;
  return { trace_id: traceId, span_id: spanId, op: 'http.server' };
}

function cleanTags(tags: Record<string, string | undefined> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tags ?? {})) {
    if (typeof value === 'string' && value) out[key] = value;
  }
  return out;
}

function buildEvent(
  options: SentryCaptureOptions,
  level: SentryLevel,
  payload: { message?: string; error?: Error }
): Record<string, unknown> {
  const fn = options.logPrefix;
  const timestamp = new Date().toISOString();
  const eventId = crypto.randomUUID().replace(/-/g, '');
  const trace = traceContext(options.traceHeader);

  return {
    event_id: eventId,
    timestamp,
    platform: 'javascript',
    level,
    logger: fn,
    environment: environmentTag(),
    server_name: fn,
    transaction: fn,
    release: releaseTag(),
    ...(options.fingerprint ? { fingerprint: options.fingerprint } : {}),
    ...(options.userId ? { user: { id: options.userId } } : {}),
    tags: {
      runtime: 'deno-edge-function',
      surface: 'edge',
      fn,
      ...(options.requestId ? { request_id: options.requestId } : {}),
      ...cleanTags(options.tags),
    },
    ...(trace ? { contexts: { trace } } : {}),
    ...(payload.error
      ? {
          exception: {
            values: [
              {
                type: payload.error.name || 'Error',
                value: payload.error.message,
                stacktrace: { frames: stackFrames(payload.error) },
              },
            ],
          },
        }
      : { message: payload.message }),
    ...(options.url || options.method || options.userAgent
      ? {
          request: {
            ...(options.url ? { url: scrubUrl(options.url) } : {}),
            ...(options.method ? { method: options.method } : {}),
            // Only the user agent: cookies and authorization must never leave the isolate.
            ...(options.userAgent ? { headers: { 'User-Agent': options.userAgent } } : {}),
          },
        }
      : {}),
    extra: scrubRecord({
      ...(options.extra ?? {}),
      ...(options.requestId ? { requestId: options.requestId } : {}),
    }),
  };
}

// ─────────────────────────────── transport ──────────────────────────────────

function shouldSend(level: SentryLevel, sampleRateSeed = Math.random()): boolean {
  if (level === 'error') return true;
  if (level === 'info') return false; // info is a log line, not an event
  return sampleRateSeed < warningSampleRate();
}

async function sendEnvelope(dsn: ParsedDsn, event: Record<string, unknown>): Promise<void> {
  const payload = JSON.stringify(event);
  const payloadBytes = new TextEncoder().encode(payload).length;
  const envelope =
    `${JSON.stringify({ event_id: event.event_id, sent_at: event.timestamp })}\n` +
    `${JSON.stringify({ type: 'event', length: payloadBytes })}\n` +
    `${payload}\n`;

  const response = await fetch(dsn.envelopeUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-sentry-envelope',
      'X-Sentry-Auth': `Sentry sentry_version=7, sentry_client=gfm-edge/2.0, sentry_key=${dsn.publicKey}`,
    },
    body: envelope,
    // A hung socket would hold the isolate open after the response was already sent.
    signal: AbortSignal.timeout(CAPTURE_TIMEOUT_MS),
  });

  if (!response.ok) {
    console.error(`[sentry] capture rejected: ${response.status}`);
  }
}

async function capture(
  options: SentryCaptureOptions,
  payload: { message?: string; error?: Error }
): Promise<void> {
  const dsn = getDsn();
  if (!dsn) return;

  const level = options.level ?? 'error';
  if (!shouldSend(level)) return;

  const dedupeKey = `${(options.fingerprint ?? []).join('|')}::${payload.message ?? payload.error?.message ?? ''}`;
  const now = Date.now();
  if (isDuplicate(dedupeKey, now)) return;
  if (overRateCap(now)) return;

  const event = buildEvent(options, level, payload);

  try {
    const sending = sendEnvelope(dsn, event);
    // A warning is diagnostic, not an incident: hand it to the isolate's background queue
    // so a slow Sentry never holds a user's response open. Errors stay awaited because the
    // response is already a 5xx and the event is the point.
    if (level !== 'error') {
      deferToIsolate(sending.catch(() => {}));
      return;
    }
    await sending;
  } catch (captureError) {
    console.error('[sentry] failed to capture', captureError);
  }
}

export async function captureSentryException(
  error: unknown,
  options: SentryCaptureOptions
): Promise<void> {
  const err = error instanceof Error ? error : new Error(String(error));
  await capture(options, { error: err, message: err.message });
}

/** For degraded states that are not exceptions: a provider 429, a fail-open limiter. */
export async function captureSentryMessage(
  message: string,
  options: SentryCaptureOptions
): Promise<void> {
  await capture({ ...options, level: options.level ?? 'warning' }, { message });
}

/**
 * A side effect that failed while the request itself succeeded — a workflow transition
 * that still moved the booking but could not send the email, or a calendar sync that gave
 * up. These are the failures nobody notices: the UI says the transition worked, and the
 * guest never receives what they were promised.
 *
 * Fingerprint per effect, so one broken provider is one issue instead of one per booking.
 */
export async function captureSideEffectFailure(
  sideEffect: string,
  error: unknown,
  options: {
    provider?: string;
    level?: SentryLevel;
    bookingStatusTo?: string;
    logPrefix?: string;
    extra?: Record<string, unknown>;
  } = {}
): Promise<void> {
  await captureSentryException(error, {
    logPrefix: options.logPrefix ?? `side_effect:${sideEffect}`,
    level: options.level ?? 'error',
    tags: {
      side_effect: sideEffect,
      ...(options.provider ? { provider: options.provider } : {}),
      ...(options.bookingStatusTo ? { booking_status_to: options.bookingStatusTo } : {}),
    },
    fingerprint: ['side_effect', sideEffect],
    extra: options.extra,
  });
}

/** Test seam — clears memoized DSN and the per-isolate guards. */
export function resetSentryDsnCacheForTests(): void {
  parsedDsn = undefined;
  dedupeSeen.clear();
  rateWindowStart = 0;
  rateWindowCount = 0;
}
