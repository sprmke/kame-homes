/**
 * Post-response work for edge functions. Hosted Supabase keeps the isolate alive for promises
 * handed to `EdgeRuntime.waitUntil`, so slow follow-up work (e.g. an AI auto-reply) no longer
 * holds the caller's response open. Local `functions serve` drops that work after the
 * response, so localhost always runs the task inline. Set `EDGE_INLINE_BACKGROUND_TASKS=1`
 * to force inline on a non-local URL.
 */

/** `EdgeRuntime.waitUntil` is a Supabase-provided global; not in Deno's lib types. */
export function getWaitUntil(): ((p: Promise<unknown>) => void) | null {
  try {
    const rt = (globalThis as unknown as { EdgeRuntime?: { waitUntil?: unknown } }).EdgeRuntime;
    return typeof rt?.waitUntil === 'function'
      ? (rt.waitUntil as (p: Promise<unknown>) => void).bind(rt)
      : null;
  } catch {
    return null;
  }
}

/** True when after-response work must run before the HTTP response (local `functions serve`). */
export function shouldInlineBackgroundTasks(): boolean {
  if (Deno.env.get('EDGE_INLINE_BACKGROUND_TASKS')?.trim() === '1') return true;
  // CLI skips SUPABASE_* in --env-file; after a hot reload only API_URL remains.
  const url = `${Deno.env.get('SUPABASE_URL') ?? ''} ${Deno.env.get('API_URL') ?? ''}`;
  return url.includes('127.0.0.1') || url.includes('localhost');
}

export async function runAfterResponse(label: string, task: () => Promise<unknown>): Promise<void> {
  const guarded = task().catch((err) => console.warn(`[${label}] background task failed:`, err));
  const waitUntil = shouldInlineBackgroundTasks() ? null : getWaitUntil();
  if (waitUntil) {
    waitUntil(guarded);
    return;
  }
  await guarded;
}
