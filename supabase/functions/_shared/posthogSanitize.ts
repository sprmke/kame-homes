const DENYLIST = new Set([
  'email',
  'phone',
  'guest_email',
  'guest_phone_number',
  'primary_guest_name',
  'message',
  'body',
  'description',
  'caption',
  'subject',
  'access',
  'token',
  'complete',
  'url',
]);

export function sanitizePostHogProperties(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    const lower = key.toLowerCase();
    if (DENYLIST.has(lower)) continue;
    if (lower.includes('token') || lower.includes('password')) continue;
    if (value === undefined) continue;
    out[key] = value;
  }
  return out;
}
