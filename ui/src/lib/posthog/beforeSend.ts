import { scrubUrl } from '@/lib/telemetry/scrub';

/**
 * PostHog sends `$current_url`, `$referrer`, `$initial_current_url` and `$initial_referrer`
 * with every event by default. On guest routes those URLs carry capability tokens
 * (`?access=`, `?complete=`, `?token=`), so without this the analytics vendor collects
 * working links to guest bookings and SD forms.
 *
 * Two rules:
 * 1. Scrub the known URL properties.
 * 2. If anything throws, drop the entire event. An analytics event is never worth leaking a
 *    token, and "sanitizer crashed so we sent it anyway" is the worst possible outcome.
 */

const URL_PROPERTIES = [
  '$current_url',
  '$initial_current_url',
  '$referrer',
  '$initial_referrer',
] as const;

/** `$pathname` and friends are already token-free, but a future prop could join the list. */
function scrubProperties(properties: Record<string, unknown> | undefined): void {
  if (!properties) return;

  for (const key of URL_PROPERTIES) {
    const value = properties[key];
    if (typeof value === 'string' && value) {
      properties[key] = scrubUrl(value);
    }
  }

  // Referrer can also arrive as `$referring_domain` plus a path; scrub it if present.
  const referringDomain = properties.$referring_domain;
  if (typeof referringDomain === 'string' && referringDomain.includes('?')) {
    properties.$referring_domain = referringDomain.split('?')[0] ?? referringDomain;
  }
}

type PostHogLikeEvent = {
  properties?: Record<string, unknown>;
  [key: string]: unknown;
};

/**
 * posthog-js `before_send`. Returns the event, or `null` to drop it.
 */
export function scrubPostHogEvent<T extends PostHogLikeEvent>(event: T | null): T | null {
  if (!event) return null;
  try {
    scrubProperties(event.properties);
    return event;
  } catch {
    // Dropping one event is cheaper than shipping a guest's access token.
    return null;
  }
}
