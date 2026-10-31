import { createServiceClient } from '../orgAuth.ts';

type HeartbeatInput = {
  ok: boolean;
  startedAt: number;
  error?: unknown;
};

function errorText(error: unknown): string | null {
  if (error == null) return null;
  const message = error instanceof Error ? error.message : String(error);
  const trimmed = message.trim();
  return trimmed ? trimmed.slice(0, 500) : null;
}

/** Upsert one job run. Never throws and never blocks the caller. */
export async function recordJobHeartbeat(jobName: string, input: HeartbeatInput): Promise<void> {
  try {
    const { error } = await createServiceClient().rpc('record_system_job_heartbeat', {
      p_job_name: jobName,
      p_ok: input.ok,
      p_started_at: new Date(input.startedAt).toISOString(),
      p_duration_ms: Math.max(0, Date.now() - input.startedAt),
      p_error: input.ok ? null : errorText(input.error),
    });
    if (error) console.error(`[job-heartbeat] ${jobName}:`, error.message);
  } catch (error) {
    console.error(`[job-heartbeat] ${jobName}:`, error);
  }
}

/** True when the JSON body has none of `keys` set. Empty or non-JSON bodies count as unset. */
export async function bodyHasNoneOf(req: Request, keys: string[]): Promise<boolean> {
  try {
    const text = await req.text();
    if (!text.trim()) return true;
    const body = JSON.parse(text) as Record<string, unknown>;
    return keys.every((key) => body[key] == null || body[key] === '');
  } catch {
    return true;
  }
}

/**
 * Run `handler`, and record a heartbeat when `shouldRecord` is true.
 * 401 responses are not recorded. The predicate receives a clone so the handler can still read the body.
 */
export async function withCronHeartbeat(
  jobName: string,
  req: Request,
  shouldRecord: (clone: Request) => boolean | Promise<boolean>,
  handler: (req: Request) => Promise<Response>
): Promise<Response> {
  let record = false;
  try {
    record = Boolean(await shouldRecord(req.clone()));
  } catch {
    record = false;
  }

  const startedAt = Date.now();
  try {
    const response = await handler(req);
    if (record && response.status !== 401) {
      await recordJobHeartbeat(jobName, {
        ok: response.ok,
        startedAt,
        error: response.ok ? undefined : `HTTP ${response.status}`,
      });
    }
    return response;
  } catch (error) {
    if (record) {
      await recordJobHeartbeat(jobName, { ok: false, startedAt, error });
    }
    throw error;
  }
}
