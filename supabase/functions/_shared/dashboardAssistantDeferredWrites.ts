/**
 * Deferred Tier-1 writes — queue side effects during the tool loop, commit after synthesis
 * + safety so Stop before commit leaves the app unchanged.
 */

import { getAssistantToolActivityLabel } from './assistantToolLabels.ts';
import type { ToolExecutionContext, ToolResult } from './dashboardAssistantTools.ts';
import { executeTool } from './dashboardAssistantTools.ts';

export type DeferredToolCall = {
  toolName: string;
  args: Record<string, unknown>;
};

export type AssistantAppliedEffect = {
  toolName: string;
  label: string;
  ok: boolean;
};

/** Queue a Tier-1 write for end-of-turn commit; returns preview result or null to execute now. */
export function queueDeferredTier1Write(
  ctx: ToolExecutionContext,
  toolName: string,
  args: Record<string, unknown>,
  preview: ToolResult
): ToolResult | null {
  if (!ctx.deferWritesUntilCommit || !ctx.deferredWrites) return null;
  ctx.deferredWrites.push({ toolName, args });
  return { ...preview, deferred: true };
}

export async function commitDeferredTier1Writes(input: {
  ctx: ToolExecutionContext;
  deferredWrites: DeferredToolCall[];
  writeToolNames: Set<string>;
  isAborted?: () => boolean;
  onToolStart?: (toolName: string) => void;
  onToolDone?: (toolName: string, ok: boolean) => void;
}): Promise<{
  executed: Array<{ toolName: string; result: ToolResult }>;
  appliedEffects: AssistantAppliedEffect[];
  abortedMidCommit?: boolean;
}> {
  const executed: Array<{ toolName: string; result: ToolResult }> = [];
  const appliedEffects: AssistantAppliedEffect[] = [];
  if (input.deferredWrites.length === 0) {
    return { executed, appliedEffects };
  }

  const commitCtx: ToolExecutionContext = {
    ...input.ctx,
    deferWritesUntilCommit: false,
    deferredWrites: undefined,
  };

  for (const call of input.deferredWrites) {
    if (input.isAborted?.()) {
      return { executed, appliedEffects, abortedMidCommit: true };
    }
    input.onToolStart?.(call.toolName);
    const result = await executeTool(call.toolName, call.args, commitCtx);
    input.onToolDone?.(call.toolName, result.ok);
    if (input.isAborted?.()) {
      if (result.ok && !result.proposed && input.writeToolNames.has(call.toolName)) {
        executed.push({ toolName: call.toolName, result });
        appliedEffects.push({
          toolName: call.toolName,
          label: getAssistantToolActivityLabel(call.toolName, result.ok ? 'done' : 'failed'),
          ok: result.ok,
        });
      }
      return { executed, appliedEffects, abortedMidCommit: true };
    }
    if (result.ok && !result.proposed && input.writeToolNames.has(call.toolName)) {
      executed.push({ toolName: call.toolName, result });
      appliedEffects.push({
        toolName: call.toolName,
        label: getAssistantToolActivityLabel(call.toolName, result.ok ? 'done' : 'failed'),
        ok: result.ok,
      });
    }
  }

  return { executed, appliedEffects };
}
