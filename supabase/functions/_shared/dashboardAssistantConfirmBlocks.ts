/**
 * Confirm writes follow-through chips onto the assistant turn that holds the
 * Confirm card. Pending rows are inserted against the user message (the
 * assistant row does not exist yet), so confirm must find the assistant
 * message by actionId rather than blindly using pending.message_id.
 */

import { humanizeTransitionError } from './dashboardAssistantActionDisplay.ts';

/** Confirm stores the propose `data` object, which nests the executable fields under `payload`. */
export function unwrapConfirmPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const nested = payload.payload;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return { ...payload, ...(nested as Record<string, unknown>) };
  }
  return payload;
}

export function blocksContainAction(blocks: unknown, actionId: string): boolean {
  if (!Array.isArray(blocks)) return false;
  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue;
    const rec = block as { type?: string; actionId?: string; steps?: unknown[] };
    if (rec.type === 'action_confirmation' && rec.actionId === actionId) return true;
    if (rec.type === 'stepper' && Array.isArray(rec.steps)) {
      if (
        rec.steps.some((step) => {
          const action = (step as { actionBlock?: { actionId?: string } })?.actionBlock;
          return action?.actionId === actionId;
        })
      ) {
        return true;
      }
    }
  }
  return false;
}

export function pickMessageWithAction<T extends { blocks: unknown }>(
  rows: T[],
  actionId: string
): T | undefined {
  return rows.find((row) => blocksContainAction(row.blocks, actionId));
}

export function blocksContainPlan(blocks: unknown, planId: string): boolean {
  if (!Array.isArray(blocks)) return false;
  return blocks.some(
    (block) =>
      block &&
      typeof block === 'object' &&
      (block as { type?: string }).type === 'action_plan' &&
      (block as { planId?: string }).planId === planId
  );
}

export function pickMessageWithPlan<T extends { blocks: unknown }>(
  rows: T[],
  planId: string
): T | undefined {
  return rows.find((row) => blocksContainPlan(row.blocks, planId));
}

/**
 * Patches an `action_plan` block's overall status and each listed step's status/errorMessage
 * in place — mirrors `updateActionBlockStatus` for the single-action card.
 */
export function updateActionPlanBlock(
  blocks: unknown,
  planId: string,
  patch: {
    status: string;
    steps: ReadonlyArray<{ stepId: string; status: string; errorMessage?: string | null }>;
  }
) {
  if (!Array.isArray(blocks)) return blocks;
  const stepPatchById = new Map(patch.steps.map((s) => [s.stepId, s]));
  return blocks.map((block) => {
    if (
      !block ||
      typeof block !== 'object' ||
      (block as { type?: string }).type !== 'action_plan' ||
      (block as { planId?: string }).planId !== planId
    ) {
      return block;
    }
    const rec = block as { steps?: Array<{ stepId?: string }> };
    return {
      ...block,
      status: patch.status,
      steps: Array.isArray(rec.steps)
        ? rec.steps.map((step) => {
            const stepPatch = stepPatchById.get(String(step.stepId));
            if (!stepPatch) return step;
            return {
              ...step,
              status: stepPatch.status,
              ...(stepPatch.errorMessage
                ? { errorMessage: humanizeTransitionError(stepPatch.errorMessage) }
                : {}),
            };
          })
        : rec.steps,
    };
  });
}

export function updateActionBlockStatus(
  blocks: unknown,
  actionId: string,
  status: string,
  errorMessage?: string | null,
  resultNote?: string | null
) {
  if (!Array.isArray(blocks)) return blocks;
  return blocks.map((block) => {
    if (
      block &&
      typeof block === 'object' &&
      (block as { type?: string }).type === 'action_confirmation' &&
      (block as { actionId?: string }).actionId === actionId
    ) {
      return {
        ...block,
        status,
        ...(errorMessage ? { errorMessage: humanizeTransitionError(errorMessage) } : {}),
        ...(resultNote ? { resultNote: resultNote.slice(0, 240) } : {}),
      };
    }
    if (
      block &&
      typeof block === 'object' &&
      (block as { type?: string }).type === 'stepper' &&
      Array.isArray((block as { steps?: unknown[] }).steps)
    ) {
      const rec = block as { steps: Array<{ actionBlock?: { actionId?: string } }> };
      return {
        ...block,
        steps: rec.steps.map((step) =>
          step.actionBlock?.actionId === actionId
            ? {
                ...step,
                actionBlock: {
                  ...step.actionBlock,
                  status,
                  ...(errorMessage ? { errorMessage: humanizeTransitionError(errorMessage) } : {}),
                },
              }
            : step
        ),
      };
    }
    return block;
  });
}
