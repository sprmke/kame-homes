/**
 * Confirm writes follow-through chips onto the assistant turn that holds the
 * Confirm card. Pending rows are inserted against the user message (the
 * assistant row does not exist yet), so confirm must find the assistant
 * message by actionId rather than blindly using pending.message_id.
 */

import { humanizeTransitionError } from './dashboardAssistantActionDisplay.ts';

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
