import { PostHog } from 'https://esm.sh/posthog-node@5.51.5';

import { runAfterResponse } from './backgroundTask.ts';

import type { PostHogEventName } from './posthogCatalog.ts';
import { sanitizePostHogProperties } from './posthogSanitize.ts';

/**
 * Server-side PostHog for edge functions — **product events only**.
 *
 * PostHog owns outcomes; Sentry owns faults (`docs/architecture/observability.md`). There
 * is deliberately no exception helper here: an error must never be reported to both
 * vendors, because that produces two histories that disagree.
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

export async function capturePostHogEvent(
  event: PostHogEventName,
  options: {
    logPrefix: string;
    distinctId?: string;
    request?: Request;
    properties?: Record<string, unknown>;
    /**
     * PostHog groups, so an event is attributable to a tenant and not only to a person.
     * Ids only, never names. Set at the call site where the scope is known.
     */
    groups?: {
      organization?: string | null;
      property?: string | null;
      parking?: string | null;
    };
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
    const builtGroups = {
      ...(options.groups?.organization ? { organization: options.groups.organization } : {}),
      ...(options.groups?.property ? { property: options.groups.property } : {}),
      ...(options.groups?.parking ? { parking: options.groups.parking } : {}),
    };
    const hasGroups = Object.keys(builtGroups).length > 0;

    // An outcome is worth recording, but it is not worth making the guest wait: the
    // analytics write must never sit on the response path. `runAfterResponse` hands the
    // capture to the isolate where the platform supports it and runs inline otherwise.
    await runAfterResponse(`posthog:${event}`, async () => {
      ph.capture({
        distinctId,
        event,
        properties: sanitizePostHogProperties({
          environment: environmentTag(),
          app_track: 'mt',
          app_release: (Deno.env.get('APP_RELEASE') ?? '').trim() || undefined,
          persona: systemEvent ? 'system' : 'host',
          surface: 'edge',
          log_prefix: options.logPrefix,
          ...(hasGroups ? { $groups: builtGroups } : {}),
          ...(sessionId ? { $session_id: sessionId } : {}),
          ...(systemEvent ? { $process_person_profile: false } : {}),
          ...options.properties,
        }),
      });
      await flushWithTimeout(ph);
    });
  } catch (captureError) {
    console.error('[posthog] failed to capture event', captureError);
  }
}
