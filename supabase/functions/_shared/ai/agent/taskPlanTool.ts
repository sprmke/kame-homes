/**
 * `plan_task`: lets the dashboard assistant declare its own sub-goals before acting, for turns
 * with 2+ asks or a multi-step write. Like `request_tools` (`toolRegistry.ts`), this is a meta-tool
 * that never calls or changes anything itself — it only seeds the `task_plan` block the host sees
 * (`TurnTaskPlanRecorder#declareGoals`) and the model is expected to work through the goals in
 * order across the rest of the turn.
 *
 * docs/workflow/in-progress/agentic-ai-assistants.md (Phase 2, Plan step).
 */

import type { ToolDeclaration } from '../llmTools.ts';

export const PLAN_TASK_NAME = 'plan_task';

export const PLAN_TASK_DECLARATION: ToolDeclaration = {
  name: PLAN_TASK_NAME,
  description:
    'Call this FIRST, before any other tool, when the request has 2 or more distinct asks or a ' +
    'multi-step write (e.g. "block these dates, raise weekend rates, and message the Garcia ' +
    'booking"). List each sub-goal in short host-facing language, in the order you\'ll do them. ' +
    "Skip this for a single simple ask - it's only for turns worth tracking as a checklist. " +
    'Does not run anything itself.',
  parameters: {
    type: 'object',
    properties: {
      goals: {
        type: 'array',
        items: { type: 'string' },
        description: '2-6 short sub-goals, host-facing, in the order you plan to do them.',
      },
    },
    required: ['goals'],
  },
};
