/**
 * Post-response work for edge functions. Hosted Supabase keeps the isolate alive for promises
 * handed to `EdgeRuntime.waitUntil`, so slow follow-up work (e.g. an AI auto-reply) no longer
 * holds the caller's response open. Local `functions serve` may drop that work after the
 * response, so set `EDGE_INLINE_BACKGROUND_TASKS=1` in supabase/.env.local to run it inline.
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

/** Runs `task` after the response when possible; errors are logged, never thrown. */
export async function runAfterResponse(label: string, task: () => Promise<unknown>): Promise<void> {
  const guarded = task().catch((err) => console.warn(`[${label}] background task failed:`, err));
  const waitUntil =
    Deno.env.get('EDGE_INLINE_BACKGROUND_TASKS')?.trim() === '1' ? null : getWaitUntil();
  if (waitUntil) {
    waitUntil(guarded);
    return;
  }
  await guarded;
}
