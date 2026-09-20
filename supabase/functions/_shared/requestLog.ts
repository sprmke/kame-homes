/**
 * Structured logging + correlation IDs (doc 27 Phase 27.1/27.2).
 *
 * One JSON shape, currently emitted on the **failure path only**: every
 * `serve*` wrapper in `serveEdge.ts` routes a caught error through
 * `handleEdgeError` (`_shared/httpResponse.ts`), which calls `logEvent` there.
 * This does NOT cover successful requests — there is no entry/exit log on the
 * happy path today, so this module cannot yet answer "how many requests did
 * this function serve" or latency questions for non-erroring calls. A handler
 * can call `logEvent` directly for a mid-request state change worth recording
 * (doc 27.1's `info` level) beyond that error-path line, but nothing does yet.
 *
 * Never log: guest names, emails, phone numbers, addresses, ID/document
 * contents, tokens, secrets, full request bodies. Log identifiers, not values
 * (`bookingId`, not the booking row).
 */

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export type StructuredLogFields = {
  fn: string;
  requestId: string;
  orgId?: string;
  propertyId?: string;
  userId?: string;
  event: string;
  durationMs?: number;
  status?: number;
  meta?: Record<string, unknown>;
};

const DEBUG_ENABLED = (Deno.env.get('EDGE_LOG_DEBUG') ?? '').trim() === '1';

function emit(level: LogLevel, fields: StructuredLogFields): void {
  if (level === 'debug' && !DEBUG_ENABLED) return;
  const line = JSON.stringify({ ts: new Date().toISOString(), level, ...fields });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export function logEvent(level: LogLevel, fields: StructuredLogFields): void {
  emit(level, fields);
}

/** `x-request-id` from the client if present (client-generated correlation id), else a fresh one. */
export function resolveRequestId(req: Request): string {
  const fromClient = req.headers.get('x-request-id')?.trim();
  if (fromClient && /^[a-zA-Z0-9_-]{1,64}$/.test(fromClient)) return fromClient;
  return crypto.randomUUID();
}
