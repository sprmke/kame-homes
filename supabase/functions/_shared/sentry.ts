import { sanitizePostHogProperties } from './posthogSanitize.ts';

/**
 * Server-side Sentry for edge functions — alerting on unexpected faults.
 *
 * **Why this exists alongside PostHog.** `posthog.ts` already captures the same
 * exceptions, but PostHog alerting is operator-blocked (doc 28), so today nothing
 * pages when the edge starts throwing. Sentry is added for the alert path, not to
 * replace PostHog's exception history — both receive the capture from the single
 * `handleEdgeError` choke point.
 *
 * **Fails silent and open.** No DSN configured, a malformed DSN, or an unreachable
 * Sentry all degrade to a no-op: telemetry must never turn a working request into a
 * failed one. Every entry point swallows its own errors.
 *
 * Uses the Sentry **envelope HTTP API** directly rather than an SDK: the Deno SDK
 * pulls a large dependency tree into every one of ~300 isolates for what is one
 * POST of a JSON envelope, and cold-start cost is paid per isolate here.
 *
 * Never send PII. `captureSentryException` runs `extra` through the shared
 * `sanitizePostHogProperties` denylist (email/phone/name/token/url/...) — the same
 * one guarding PostHog, reused so the two cannot drift apart.
 */

const CAPTURE_TIMEOUT_MS = 3000;

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

function environmentTag(): 'local' | 'preview' | 'production' | 'development' {
  const explicit = Deno.env.get('ENVIRONMENT') ?? Deno.env.get('DENO_ENV');
  if (explicit === 'production' || explicit === 'preview' || explicit === 'local') {
    return explicit;
  }
  if (explicit === 'development') return 'local';
  return Deno.env.get('DENO_DEPLOYMENT_ID') ? 'production' : 'local';
}

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

export async function captureSentryException(
  error: unknown,
  options: {
    logPrefix: string;
    requestId?: string;
    /** Already-sanitized URL — pass `sanitizeUrlForTelemetry(req.url)`, never `req.url`. */
    url?: string;
    method?: string;
    extra?: Record<string, unknown>;
  }
): Promise<void> {
  const dsn = getDsn();
  if (!dsn) return;

  try {
    const err = error instanceof Error ? error : new Error(String(error));
    const eventId = crypto.randomUUID().replace(/-/g, '');
    const timestamp = new Date().toISOString();

    const event = {
      event_id: eventId,
      timestamp,
      platform: 'javascript',
      level: 'error',
      logger: options.logPrefix,
      environment: environmentTag(),
      server_name: 'supabase-edge',
      transaction: options.logPrefix,
      tags: {
        runtime: 'deno-edge-function',
        surface: 'edge',
        fn: options.logPrefix,
        ...(options.requestId ? { request_id: options.requestId } : {}),
      },
      exception: {
        values: [
          {
            type: err.name || 'Error',
            value: err.message,
            stacktrace: { frames: stackFrames(err) },
          },
        ],
      },
      ...(options.url || options.method
        ? {
            request: {
              ...(options.url ? { url: options.url } : {}),
              ...(options.method ? { method: options.method } : {}),
            },
          }
        : {}),
      extra: sanitizePostHogProperties({
        ...(options.extra ?? {}),
        ...(options.requestId ? { requestId: options.requestId } : {}),
      }),
    };

    // Envelope = newline-delimited JSON: header, item header, item payload.
    // Auth travels in the X-Sentry-Auth header, so the envelope header needs no `dsn`.
    // `length` is byte length, not String.length — a non-ASCII error message (a guest
    // name in a constraint violation, a vendor's localized text) would otherwise declare
    // a short count and get the envelope rejected.
    const payload = JSON.stringify(event);
    const payloadBytes = new TextEncoder().encode(payload).length;
    const envelope =
      `${JSON.stringify({ event_id: eventId, sent_at: timestamp })}\n` +
      `${JSON.stringify({ type: 'event', length: payloadBytes })}\n` +
      `${payload}\n`;

    const response = await fetch(dsn.envelopeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_client=gfm-edge/1.0, sentry_key=${dsn.publicKey}`,
      },
      body: envelope,
      // Vendor calls elsewhere in this codebase have no timeout; a hung socket here
      // would hold the isolate open after the response is already sent.
      signal: AbortSignal.timeout(CAPTURE_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error(`[sentry] capture rejected: ${response.status}`);
    }
  } catch (captureError) {
    console.error('[sentry] failed to capture exception', captureError);
  }
}

/** Test seam — clears the memoized DSN so a test can vary `SENTRY_DSN`. */
export function resetSentryDsnCacheForTests(): void {
  parsedDsn = undefined;
}
