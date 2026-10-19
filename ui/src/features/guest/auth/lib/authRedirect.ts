/** Browsers read `\` as `/` and drop tab/newline in URLs, so `/\evil.com` or `/\t/evil.com` become `//evil.com`. */
function hasUnsafeRedirectChar(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code === 0x5c || code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

/** Safe in-app redirect target (no open redirects). Shared by host + guest auth paths. */
export function safeRedirect(raw: string | null, fallback: string): string {
  if (!raw) return fallback;
  if (!raw.startsWith('/') || raw.startsWith('//')) return fallback;
  if (hasUnsafeRedirectChar(raw)) return fallback;
  return raw;
}
