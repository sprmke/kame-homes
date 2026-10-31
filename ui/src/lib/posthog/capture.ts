import { shouldCaptureProductEvents } from '@/lib/posthog/analyticsMode';
import type { AppAnalyticsEventName } from '@/lib/posthog/catalog';
import { isPostHogEnabled, posthog } from '@/lib/posthog/client';
import { buildSharedAnalyticsProperties } from '@/lib/posthog/context';
import { sanitizeAnalyticsProperties } from '@/lib/posthog/sanitize';

/**
 * Typed product analytics capture. Never throws; strips PII keys; no-ops when disabled.
 */
export function captureAppEvent(
  event: AppAnalyticsEventName,
  properties?: Record<string, unknown>
): void {
  if (!isPostHogEnabled || !shouldCaptureProductEvents()) return;

  try {
    const shared = buildSharedAnalyticsProperties();
    const extra = properties ? sanitizeAnalyticsProperties(properties) : {};
    posthog.capture(event, { ...shared, ...extra });
  } catch {
    // telemetry must never break UX
  }
}

export function captureAppException(error: unknown, properties?: Record<string, unknown>): void {
  if (!isPostHogEnabled) return;
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    const extra = properties ? sanitizeAnalyticsProperties(properties) : {};
    posthog.captureException(err, extra);
  } catch {
    // ignore
  }
}
