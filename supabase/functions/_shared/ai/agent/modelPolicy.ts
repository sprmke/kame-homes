/**
 * Picks the dashboard assistant's model/feature once, before the tool loop starts — never
 * mid-turn, since Gemini's thought signatures are only valid for the model that produced them.
 * Pure heuristics, no model call: zero added latency or cost.
 *
 * docs/workflow/in-progress/agentic-ai-assistants.md (Phase 2, Model policy).
 */

const WRITE_VERB_PATTERN =
  /\b(update|change|set|mark|cancel|delete|remove|create|add|block|unblock|approve|reject|decline|send|move|transfer|refund|assign|invite|edit|schedule|reschedule)\b/i;

/** A rough count of separate asks in one message — clauses split on sentence breaks and "and"/"also". */
export function countTurnIntents(message: string): number {
  const trimmed = message.trim();
  if (!trimmed) return 0;
  const clauses = trimmed
    .split(/[.?!]+\s+|;\s+|\s+(?:and also|also|and then|then also)\s+|\s+and\s+/i)
    .map((part) => part.trim())
    .filter((part) => part.length >= 4);
  return Math.max(1, clauses.length);
}

export type DashboardTurnSignal = {
  message: string;
  attachmentCount: number;
  /** Modules the tool router matched for this turn (`toolRoute.modules`). */
  matchedModuleCount: number;
  /** True when the router could not narrow and fell open to every tool. */
  routerFailedOpen: boolean;
};

/** Modules alone, with no write verb or multi-intent, still counts as complex past this count. */
const COMPLEX_MODULE_THRESHOLD = 3;

export function isComplexDashboardTurn(signal: DashboardTurnSignal): boolean {
  if (signal.routerFailedOpen) return true;
  if (signal.attachmentCount > 0) return true;
  if (countTurnIntents(signal.message) >= 2) return true;
  if (signal.matchedModuleCount >= COMPLEX_MODULE_THRESHOLD) return true;
  return WRITE_VERB_PATTERN.test(signal.message);
}

/** `AiFeature` is a large union defined in aiModelRouter.ts — kept loose here to avoid a cycle. */
export function resolveDashboardAssistantFeature(
  signal: DashboardTurnSignal
): 'dashboard_assistant' | 'dashboard_assistant_complex' {
  return isComplexDashboardTurn(signal) ? 'dashboard_assistant_complex' : 'dashboard_assistant';
}
