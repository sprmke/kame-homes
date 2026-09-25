/**
 * Browser Sentry — alerting on unhandled render crashes.
 *
 * **Why this exists alongside PostHog.** `lib/posthog/capture.ts#captureAppException`
 * already records the same exceptions, but PostHog alerting is operator-blocked
 * (production-readiness doc 28), so nothing pages when the app starts crashing.
 * Sentry carries the alert; PostHog keeps the history. Deliberately independent of
 * `isPostHogEnabled` so either can be configured without the other.
 *
 * **Disabled unless `VITE_SENTRY_DSN` is set**, and every entry point swallows its
 * own errors — telemetry must never break UX.
 *
 * Posts the Sentry **envelope HTTP API** directly instead of pulling in
 * `@sentry/browser` (~30 KB gzip). The initial-bundle budget is enforced in the
 * build command (500 KiB entry / 1200 KiB initial gzip), and an error reporter is
 * not worth that much of it for what is one `fetch` of newline-delimited JSON.
 *
 * Note: this reports explicitly-passed errors, so it does not replace an SDK's
 * automatic `window.onerror` / `unhandledrejection` hooks. `AppErrorBoundary` is the
 * one caller today, matching the existing PostHog wiring.
 */

type ParsedDsn = { envelopeUrl: string; publicKey: string };

const CAPTURE_TIMEOUT_MS = 3000;

/** `https://<publicKey>@<host>/<projectId>` → `https://<host>/api/<projectId>/envelope/`. */
function parseDsn(raw: string): ParsedDsn | null {
  try {
    const url = new URL(raw);
    const publicKey = url.username;
    const projectId = url.pathname.replace(/^\/+/, '').trim();
    if (!publicKey || !projectId) return null;
    return { envelopeUrl: `${url.protocol}//${url.host}/api/${projectId}/envelope/`, publicKey };
  } catch {
    return null;
  }
}

const dsn = parseDsn(((import.meta.env.VITE_SENTRY_DSN as string | undefined) ?? '').trim());

export const isSentryEnabled = dsn !== null;

function environmentTag(): 'local' | 'preview' | 'production' {
  if (import.meta.env.DEV) return 'local';
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  if (host.includes('dev.kamehomes.space') || host.includes('vercel.app')) return 'preview';
  return 'production';
}

/**
 * Strips a URL to origin + path. Query strings on guest routes carry capability
 * tokens (`?token=`, `?complete=`) and the edge does the same redaction before
 * sending a URL to telemetry.
 */
function safeLocation(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const url = new URL(window.location.href);
    return `${url.origin}${url.pathname}`;
  } catch {
    return undefined;
  }
}

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
  return frames.reverse(); // Sentry renders oldest-first.
}

export function captureSentryException(error: unknown, extra?: Record<string, unknown>): void {
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
      environment: environmentTag(),
      release: (import.meta.env.VITE_APP_VERSION as string | undefined) ?? undefined,
      tags: { surface: 'browser' },
      exception: {
        values: [
          {
            type: err.name || 'Error',
            value: err.message,
            stacktrace: { frames: stackFrames(err) },
          },
        ],
      },
      request: { url: safeLocation() },
      extra: extra ?? {},
    };

    // `length` must be byte length, not String.length, or a non-ASCII message
    // desyncs the declared size and the envelope is rejected.
    const payload = JSON.stringify(event);
    const payloadBytes = new TextEncoder().encode(payload).length;
    const envelope =
      `${JSON.stringify({ event_id: eventId, sent_at: timestamp })}\n` +
      `${JSON.stringify({ type: 'event', length: payloadBytes })}\n` +
      `${payload}\n`;

    // `keepalive` so the report survives the page teardown that often follows a
    // crash (the boundary offers a reload button).
    void fetch(dsn.envelopeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_client=gfm-browser/1.0, sentry_key=${dsn.publicKey}`,
      },
      body: envelope,
      keepalive: true,
      signal: AbortSignal.timeout(CAPTURE_TIMEOUT_MS),
    }).catch(() => {
      // telemetry must never break UX
    });
  } catch {
    // telemetry must never break UX
  }
}
