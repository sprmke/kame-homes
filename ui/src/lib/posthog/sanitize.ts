/** Strip PII and sensitive keys before PostHog capture. */

const DENYLIST = new Set([
  'email',
  'phone',
  'guest_email',
  'guest_phone',
  'guest_phone_number',
  'primary_guest_name',
  'guest_facebook_name',
  'message',
  'body',
  'description',
  'caption',
  'subject',
  'query',
  'search_query',
  'access',
  'token',
  'complete',
  'password',
  'receipt_url',
  'valid_id_url',
  'url',
  'file_url',
  'media_url',
]);

const DENYLIST_PREFIXES = ['guest_', 'owner_'];

export function sanitizeAnalyticsProperties(
  input: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    const lower = key.toLowerCase();
    if (DENYLIST.has(lower)) continue;
    if (lower.includes('token') || lower.includes('password')) continue;
    if (DENYLIST_PREFIXES.some((p) => lower.startsWith(p) && lower.endsWith('_name'))) continue;
    if (value === undefined) continue;
    if (typeof value === 'string' && value.length > 512) continue;
    out[key] = value;
  }
  return out;
}
