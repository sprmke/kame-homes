import { PostHog } from 'https://esm.sh/posthog-node@5.51.5';

import type { PostHogEventName } from './posthogCatalog.ts';
import { sanitizePostHogProperties } from './posthogSanitize.ts';

/**
 * Server-side PostHog for edge functions — exceptions + product events.
 *
 * Prefer routing new functions through `serveEdge.ts` / `handleEdgeError` choke points.
 * Deno Edge isolates can terminate after the response; every capture awaits flush()
 * with a bounded timeout.
 */

const CAPTURE_TIMEOUT_MS = 3000;

let client: PostHog | null | undefined;

function getClient(): PostHog | null {
  if (client !== undefined) return client;
  const apiKey = Deno.env.get('POSTHOG_API_KEY');
  if (!apiKey) {
    client = null;
    return client;
  }
  const host = Deno.env.get('POSTHOG_HOST');
  client = new PostHog(apiKey, {
    ...(host ? { host } : {}),
    flushAt: 1,
    flushInterval: 0,
  });
  return client;
}

function environmentTag(): 'local' | 'preview' | 'production' | 'development' {
  const explicit = Deno.env.get('ENVIRONMENT') ?? Deno.env.get('DENO_ENV');
  if (explicit === 'production' || explicit === 'preview' || explicit === 'local') {
    return explicit;
  }
  if (explicit === 'development') return 'local';
  return Deno.env.get('DENO_DEPLOYMENT_ID') ? 'production' : 'local';
}

async function flushWithTimeout(ph: PostHog): Promise<void> {
  await Promise.race([
    ph.flush(),
    new Promise((_resolve, reject) =>
      setTimeout(() => reject(new Error('posthog flush timed out')), CAPTURE_TIMEOUT_MS)
    ),
  ]);
}

function distinctIdFromRequest(
  request: Request | undefined,
  fallback: string
): { distinctId: string; sessionId?: string; hasUserContext: boolean } {
  const requestDistinctId = request?.headers.get('X-POSTHOG-DISTINCT-ID')?.trim();
  const requestSessionId = request?.headers.get('X-POSTHOG-SESSION-ID')?.trim();
  const distinctId = requestDistinctId || fallback;
  return {
    distinctId,
    sessionId: requestSessionId || undefined,
    hasUserContext: Boolean(requestDistinctId),
  };
}

export async function capturePostHogException(
  error: unknown,
  options: {
    logPrefix: string;
    distinctId?: string;
    request?: Request;
    extra?: Record<string, unknown>;
  }
): Promise<void> {
  const ph = getClient();
  if (!ph) return;

  try {
    const { distinctId, sessionId, hasUserContext } = distinctIdFromRequest(
      options.request,
      options.distinctId ?? `edge:${options.logPrefix}`
    );
    const err = error instanceof Error ? error : new Error(String(error));
    ph.captureException(err, distinctId, {
      logPrefix: options.logPrefix,
      environment: environmentTag(),
      runtime: 'deno-edge-function',
      persona: 'system',
      surface: 'edge',
      ...(sessionId ? { $session_id: sessionId } : {}),
      ...(hasUserContext ? {} : { $process_person_profile: false }),
      ...sanitizePostHogProperties(options.extra ?? {}),
    });
    await flushWithTimeout(ph);
  } catch (captureError) {
    console.error('[posthog] failed to capture exception', captureError);
  }
}

export async function capturePostHogEvent(
  event: PostHogEventName,
  options: {
    logPrefix: string;
    distinctId?: string;
    request?: Request;
    properties?: Record<string, unknown>;
    /** Cron/webhook/system events — no person profile. */
    system?: boolean;
  }
): Promise<void> {
  const ph = getClient();
  if (!ph) return;

  try {
    const { distinctId, sessionId, hasUserContext } = distinctIdFromRequest(
      options.request,
      options.distinctId ?? `edge:${options.logPrefix}`
    );
    const systemEvent = options.system ?? !hasUserContext;
    ph.capture({
      distinctId,
      event,
      properties: sanitizePostHogProperties({
        environment: environmentTag(),
        app_track: 'mt',
        persona: systemEvent ? 'system' : 'host',
        surface: 'edge',
        log_prefix: options.logPrefix,
        ...(sessionId ? { $session_id: sessionId } : {}),
        ...(systemEvent ? { $process_person_profile: false } : {}),
        ...options.properties,
      }),
    });
    await flushWithTimeout(ph);
  } catch (captureError) {
    console.error('[posthog] failed to capture event', captureError);
  }
}
