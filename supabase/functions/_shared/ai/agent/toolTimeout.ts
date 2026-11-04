/**
 * A single slow or hung tool call must not stall an entire agent turn until the outer deadline
 * (`turnBudget.ts`) finally cuts it off — each call gets its own bound. Default matches the
 * house convention for turn-level overrides (`ASSISTANT_TURN_DEADLINE_MS`).
 *
 * docs/workflow/in-progress/agentic-ai-assistants.md (Phase 6, loop detection and caps).
 */

const DEFAULT_TOOL_TIMEOUT_MS = 20_000;

export function toolTimeoutMsFromEnv(raw: string | undefined): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TOOL_TIMEOUT_MS;
}

export class ToolTimeoutError extends Error {
  constructor(toolName: string, ms: number) {
    super(`${toolName} timed out after ${ms}ms`);
    this.name = 'ToolTimeoutError';
  }
}

/** Races `fn` against a timeout; the timer is always cleared, win or lose. */
export async function withToolTimeout<T>(
  toolName: string,
  fn: () => Promise<T>,
  timeoutMs: number = toolTimeoutMsFromEnv(Deno.env.get('ASSISTANT_TOOL_TIMEOUT_MS'))
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ToolTimeoutError(toolName, timeoutMs)), timeoutMs);
  });
  try {
    return await Promise.race([fn(), timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
