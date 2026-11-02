import { createRoutesFromChildren, matchRoutes, useLocation, useNavigationType } from 'react-router-dom';

import * as Sentry from '@sentry/react';

import { detectAnalyticsEnvironment, detectAppTrack } from '@/lib/posthog/env';
import { scrubRecord, scrubUrl } from '@/lib/telemetry/scrub';

/**
 * Browser Sentry initialisation.
 *
 * Sentry owns faults; PostHog owns outcomes (see `docs/architecture/observability.md`).
 * Unset or malformed `VITE_SENTRY_DSN` disables the whole thing: telemetry must never be a
 * reason a page fails to boot.
 *
 * Kept in one module so the SDK is imported exactly once — the bundle budget is enforced
 * in the build, and a second static import would defeat the chunk plan.
 */

const dsn = ((import.meta.env.VITE_SENTRY_DSN as string | undefined) ?? '').trim();

export const isSentrySdkEnabled = Boolean(dsn);

/** True once `initSentry` has run, so call sites can skip building payloads. */
let initialised = false;

export function isSentryInitialised(): boolean {
  return initialised;
}

/**
 * Production samples 5%, preview 20%, local nothing. An explicit
 * `VITE_SENTRY_TRACES_SAMPLE_RATE` wins so a drill can raise it without a rebuild.
 */
function resolveTracesSampleRate(): number {
  const raw = ((import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE as string | undefined) ?? '').trim();
  if (raw) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) return parsed;
  }
  const environment = detectAnalyticsEnvironment();
  if (environment === 'production') return 0.05;
  if (environment === 'preview') return 0.2;
  return 0;
}

/** Only our own edge functions get trace headers. Never third parties, never PostHog. */
function resolveTracePropagationTargets(): string[] {
  const functionsUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  if (!functionsUrl) return [];
  try {
    return [new URL(functionsUrl).origin + '/functions/v1'];
  } catch {
    return [];
  }
}

function scrubBreadcrumb(breadcrumb: Sentry.Breadcrumb): Sentry.Breadcrumb | null {
  const data = breadcrumb.data;
  if (!data || typeof data !== 'object') return breadcrumb;
  const nextData: Record<string, unknown> = { ...data };
  if (typeof nextData.url === 'string') nextData.url = scrubUrl(nextData.url);
  if (typeof nextData.from === 'string') nextData.from = scrubUrl(nextData.from);
  if (typeof nextData.to === 'string') nextData.to = scrubUrl(nextData.to);
  return { ...breadcrumb, data: nextData };
}

function scrubEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  if (event.request?.url) event.request.url = scrubUrl(event.request.url);
  if (event.tags && typeof event.tags.url === 'string') event.tags.url = scrubUrl(event.tags.url);
  if (event.extra) event.extra = scrubRecord(event.extra as Record<string, unknown>);

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs
      .map(scrubBreadcrumb)
      .filter((crumb): crumb is Sentry.Breadcrumb => crumb !== null);
  }

  return event;
}

export function initSentry(): void {
  if (!dsn || initialised) return;

  try {
    Sentry.init({
      dsn,
      release: (import.meta.env.VITE_APP_VERSION as string | undefined) ?? undefined,
      environment: detectAnalyticsEnvironment(),
      sendDefaultPii: false,
      maxBreadcrumbs: 50,
      initialScope: {
        tags: { app_track: detectAppTrack(), runtime: 'browser' },
      },
      integrations: [
        // Route-aware: transactions are named by route pattern
        // (`/org/:orgSlug/property/:propertySlug/bookings`), never by slug. A raw pathname
        // would create one transaction per tenant and make latency unreadable.
        Sentry.reactRouterBrowserTracingIntegration({
          useLocation,
          useNavigationType,
          createRoutesFromChildren,
          matchRoutes,
        }),
        Sentry.breadcrumbsIntegration({ console: false, dom: true, fetch: true, history: true }),
        Sentry.dedupeIntegration(),
        Sentry.httpContextIntegration(),
      ],
      tracesSampleRate: resolveTracesSampleRate(),
      tracePropagationTargets: resolveTracePropagationTargets(),
      // Browser extensions throw constantly and nothing in them is ours to fix.
      denyUrls: [/^chrome-extension:/, /^moz-extension:/, /^safari-extension:/, /^safari-web-extension:/],
      // Deliberately small. Grow it from real data, not from guesses.
      ignoreErrors: [
        'ResizeObserver loop limit exceeded',
        'ResizeObserver loop completed with undelivered notifications',
        'Non-Error promise rejection captured with value: undefined',
      ],
      beforeSend: scrubEvent,
      beforeBreadcrumb: scrubBreadcrumb,
    });
    initialised = true;
  } catch {
    // telemetry must never break the app
  }
}
