/**
 * Turns "ran out of rounds/budget" from a generic "I gathered part of that" into a specific list
 * of what the plan (model-declared via `plan_task`, or inferred from tool calls) did not get to.
 * Deterministic — reads the task plan's own step statuses, no extra model call.
 *
 * docs/workflow/in-progress/agentic-ai-assistants.md (Phase 2, Completion check).
 */

export type OpenPlanStep = { id: string; label: string };

/** A short, host-facing sentence naming what did not finish, or null when nothing is open. */
export function describeOpenPlanSteps(openSteps: readonly OpenPlanStep[]): string | null {
  if (openSteps.length === 0) return null;
  const labels = openSteps.map((step) => step.label.replace(/[.!?]+$/, ''));
  return `I didn't get to: ${labels.join(', ')}.`;
}
