import { scrubRecord } from '@/lib/telemetry/scrub';

/**
 * PostHog property sanitizer. The deny list itself lives in `@/lib/telemetry/scrub` so
 * PostHog and Sentry cannot drift apart; this adds the analytics-only rule that a value
 * long enough to be a pasted message body is dropped rather than sent.
 */

/** Above this a string is almost certainly a message body, a caption, or a stack dump. */
const MAX_STRING_LENGTH = 512;

export function sanitizeAnalyticsProperties(
  input: Record<string, unknown>
): Record<string, unknown> {
  return dropLongStrings(scrubRecord(input));
}

function dropLongStrings(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string') {
      if (value.length > MAX_STRING_LENGTH) continue;
      out[key] = value;
      continue;
    }
    if (Array.isArray(value)) {
      out[key] = value.filter(
        (item) => !(typeof item === 'string' && item.length > MAX_STRING_LENGTH)
      );
      continue;
    }
    if (value && typeof value === 'object') {
      out[key] = dropLongStrings(value as Record<string, unknown>);
      continue;
    }
    out[key] = value;
  }
  return out;
}
