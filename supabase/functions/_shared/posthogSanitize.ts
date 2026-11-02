import { scrubRecord } from './telemetryScrub.ts';

/**
 * Edge PostHog property sanitizer. The deny list lives in `telemetryScrub.ts` so PostHog
 * and Sentry share one rule; this is the seam every edge capture runs through.
 */

export function sanitizePostHogProperties(input: Record<string, unknown>): Record<string, unknown> {
  return scrubRecord(input);
}
