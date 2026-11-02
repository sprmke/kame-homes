/**
 * Deno twin of `ui/src/lib/telemetry/scrub.ts`.
 *
 * Edge isolates cannot import from `ui/`, so the lists are duplicated by hand and
 * `ui/src/lib/telemetry/scrubParity.test.ts` fails when the two disagree. Edit both,
 * never one.
 *
 * Same rules as the browser module: denied keys dropped at any depth, credential-shaped
 * keys dropped by substring, denied query params removed from every URL.
 */

/** Keys dropped from every telemetry payload, at any nesting depth. */
export const TELEMETRY_DENY_KEYS = [
  // Identity / contact
  'email',
  'phone',
  'guest_email',
  'guest_phone',
  'guest_phone_number',
  'guest_facebook_name',
  'primary_guest_name',
  // Free text: message bodies, captions, guest-written content
  'message',
  'body',
  'description',
  'caption',
  'subject',
  'query',
  'search_query',
  // Capability tokens / credentials
  'access',
  'complete',
  'token',
  'password',
  'otp',
  'code',
  'signature',
  'secret',
  'authorization',
  'cookie',
  'apikey',
  'x-api-key',
  // Files and documents
  'receipt',
  'receipt_url',
  'valid_id_url',
  'url',
  'file_url',
  'media_url',
  'signed_url',
  // Financial / government identifiers
  'iban',
  'account_number',
  'id_number',
] as const;

/** Query params removed from every URL sent to a vendor. */
export const TELEMETRY_DENY_QUERY_KEYS = [
  'access',
  'complete',
  'token',
  'code',
  'state',
  'signature',
  't',
] as const;

const DENY_KEY_SET: ReadonlySet<string> = new Set(TELEMETRY_DENY_KEYS);
const DENY_QUERY_KEY_SET: ReadonlySet<string> = new Set(TELEMETRY_DENY_QUERY_KEYS);

const DENY_KEY_FRAGMENTS = [
  'token',
  'password',
  'secret',
  'signature',
  'authorization',
  'apikey',
  'api_key',
] as const;

const DENY_NAME_PREFIXES = ['guest_', 'owner_'] as const;

const MAX_DEPTH = 6;

export function isDeniedTelemetryKey(key: string): boolean {
  const lower = key.toLowerCase();
  if (DENY_KEY_SET.has(lower)) return true;
  if (DENY_KEY_FRAGMENTS.some((fragment) => lower.includes(fragment))) return true;
  return DENY_NAME_PREFIXES.some((prefix) => lower.startsWith(prefix) && lower.endsWith('_name'));
}

export function scrubRecord(
  input: Record<string, unknown> | undefined,
  depth = 0
): Record<string, unknown> {
  if (!input || typeof input !== 'object') return {};
  if (depth > MAX_DEPTH) return {};

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (isDeniedTelemetryKey(key)) continue;
    const scrubbed = scrubValue(value, depth);
    if (scrubbed !== undefined) out[key] = scrubbed;
  }
  return out;
}

function scrubValue(value: unknown, depth: number): unknown {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (depth >= MAX_DEPTH) return undefined;

  if (Array.isArray(value)) {
    return value.map((item) => scrubValue(item, depth + 1)).filter((item) => item !== undefined);
  }

  if (value instanceof URL) return scrubUrl(value.toString());

  const proto = Object.getPrototypeOf(value);
  if (proto === Object.prototype || proto === null) {
    return scrubRecord(value as Record<string, unknown>, depth + 1);
  }

  if (value instanceof Date) return value.toISOString();
  return String(value);
}

/**
 * Removes capability-token query params from a URL. Note the edge error path keeps the
 * stricter all-query-values-redacted rule in `httpResponse.ts#sanitizeUrlForTelemetry`,
 * because that runs on raw inbound `req.url` where a future token param name could be
 * missed by this list.
 */
export function scrubUrl(raw: string): string {
  try {
    const url = new URL(raw);
    for (const key of Array.from(new Set(url.searchParams.keys()))) {
      if (DENY_QUERY_KEY_SET.has(key.toLowerCase())) url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    const cut = raw.indexOf('?');
    return cut === -1 ? raw : raw.slice(0, cut);
  }
}
