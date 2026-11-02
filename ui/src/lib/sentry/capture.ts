import type { ErrorInfo } from 'react';

import * as Sentry from '@sentry/react';

import { scrubRecord } from '@/lib/telemetry/scrub';

import { isSentrySdkEnabled } from './init';

/**
 * The only SDK call surface for the app. Everything else imports from here, so the
 * `@sentry/*` import stays inside `lib/sentry/**` and the bundle keeps one entry point.
 *
 * Every function is a no-op without `VITE_SENTRY_DSN` and swallows its own errors:
 * telemetry must never turn a working interaction into a failing one.
 *
 * `captureError` is for a fault the app handled and decided to keep going from. Errors that
 * reach a React boundary or a fetch choke point are captured there instead, so one fault is
 * not reported twice.
 */

export type CaptureOptions = {
  tags?: Record<string, string | undefined>;
  extra?: Record<string, unknown>;
  level?: Sentry.SeverityLevel;
  /** Stable grouping when the message text varies between occurrences. */
  fingerprint?: string[];
};

function cleanTags(tags: Record<string, string | undefined> | undefined) {
  if (!tags) return undefined;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tags)) {
    if (typeof value === 'string' && value) out[key] = value;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Returns the event id so support can quote a reference, or undefined when disabled. */
export function captureError(error: unknown, options: CaptureOptions = {}): string | undefined {
  if (!isSentrySdkEnabled) return undefined;

  try {
    return Sentry.captureException(error, {
      level: options.level ?? 'error',
      tags: cleanTags(options.tags),
      extra: options.extra ? scrubRecord(options.extra) : undefined,
      fingerprint: options.fingerprint,
    });
  } catch {
    return undefined;
  }
}

/** For degraded states that are not exceptions: provider 429, fail-open limiter. */
export function captureMessage(
  message: string,
  options: CaptureOptions = {}
): string | undefined {
  if (!isSentrySdkEnabled) return undefined;

  try {
    return Sentry.captureMessage(message, {
      level: options.level ?? 'warning',
      tags: cleanTags(options.tags),
      extra: options.extra ? scrubRecord(options.extra) : undefined,
      fingerprint: options.fingerprint,
    });
  } catch {
    return undefined;
  }
}

/**
 * React 19 root error hooks. `reactErrorHandler` already recurses `error.cause` and attaches
 * the component stack, and `dedupeIntegration` drops a repeat a boundary already sent.
 *
 * Empty object when disabled so `createRoot` keeps its defaults instead of receiving
 * undefined callbacks.
 */
export function reactRootErrorHandlers(): {
  onUncaughtError?: (error: unknown, errorInfo: ErrorInfo) => void;
  onCaughtError?: (error: unknown, errorInfo: ErrorInfo) => void;
  onRecoverableError?: (error: unknown, errorInfo: ErrorInfo) => void;
} {
  if (!isSentrySdkEnabled) return {};

  const handler = Sentry.reactErrorHandler();
  return {
    onUncaughtError: handler,
    onCaughtError: handler,
    onRecoverableError: handler,
  };
}

/**
 * Capture from an error boundary, which knows the component stack. Separate from
 * `captureError` because the SDK attaches `contexts.react` here.
 */
export function captureRenderError(error: unknown, componentStack: string | null | undefined) {
  if (!isSentrySdkEnabled) return undefined;

  try {
    return Sentry.captureReactException(error, { componentStack: componentStack ?? '' });
  } catch {
    return undefined;
  }
}
