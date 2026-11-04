/**
 * Correlation ids for edge calls.
 *
 * `x-request-id` is generated per call and echoed by `handleEdgeError` on a 5xx (body
 * `requestId` and, from S1.6, the `x-request-id` response header). It is the join key
 * between a Sentry issue, the edge structured log line, and a PostHog outcome event, so
 * one incident is one story instead of three unrelated records.
 */

/** UUID v4. Cheap, unguessable, and safe to show a user as a reference. */
export function newRequestId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    // Older Safari without `crypto.randomUUID` — correlation still works, just uglier.
    return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

/**
 * The server's id wins: it is what the edge logged and what Sentry tagged. The body field
 * is the fallback for responses that predate the expose header.
 */
export function readServerRequestId(res: Response, body?: unknown): string | null {
  const fromHeader = res.headers.get('x-request-id')?.trim();
  if (fromHeader) return fromHeader;
  if (body && typeof body === 'object' && 'requestId' in body) {
    const value = (body as { requestId?: unknown }).requestId;
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

const FUNCTIONS_PATH = '/functions/v1/';

/**
 * `/submit-form?x=1` → `submit-form`. Used as the Sentry `fn` tag and in fingerprints.
 *
 * Callers may also pass the absolute URL they fetch (the guest form builds one from its
 * `apiUrl`). Reading the first path segment of that shape yielded `https:`, which created a
 * junk Sentry issue instead of naming the function that failed.
 */
export function edgeFunctionName(path: string): string {
  const withoutQuery = path.split('?')[0] ?? path;
  let pathname = withoutQuery;
  if (/^https?:\/\//i.test(withoutQuery)) {
    try {
      pathname = new URL(withoutQuery).pathname;
    } catch {
      // Not a parseable URL after all — fall through with the raw string.
    }
  }

  const marker = pathname.indexOf(FUNCTIONS_PATH);
  const tail = marker >= 0 ? pathname.slice(marker + FUNCTIONS_PATH.length) : pathname;
  const trimmed = tail.replace(/^\/+/, '').replace(/\/+$/, '');
  return trimmed.split('/')[0] ?? '';
}
