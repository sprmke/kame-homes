/**
 * `request_tools`: a meta-tool that lets the dashboard assistant widen its own tool set mid-turn,
 * for when the router under-matched (e.g. a pricing question comes up while answering an inbox
 * question). The round loop keeps running with the widened set for every later round of the
 * same turn — no mid-turn model switch, so Gemini thought signatures stay valid.
 *
 * This is not a security boundary: every tool already re-checks its own permission and plan
 * entitlement at call time (`resolveTargetProperty`, `requirePropertyPermissionAndFeature`, …).
 * Widening the *offered* tool list never grants anything the caller could not already reach by
 * asking for that tool directly — a plan-gated or permission-gated tool still fails the same way
 * whether the router sent it on round 1 or `request_tools` added it on round 3.
 *
 * docs/workflow/in-progress/agentic-ai-assistants.md (Phase 2, Dynamic tools).
 */

import {
  ASSISTANT_TOOL_MODULES,
  type AssistantToolModule,
} from '../../dashboardAssistantToolRouter.ts';
import type { ToolDeclaration } from '../llmTools.ts';

export const REQUEST_TOOLS_NAME = 'request_tools';

const KNOWN_MODULES: readonly AssistantToolModule[] = [
  ...new Set(Object.values(ASSISTANT_TOOL_MODULES)),
].sort();

export const REQUEST_TOOLS_DECLARATION: ToolDeclaration = {
  name: REQUEST_TOOLS_NAME,
  description:
    'Widen your own tool set for the rest of this turn when you discover you need a module you ' +
    "were not given at the start. Adds the named modules' tools; does not call or run anything " +
    'itself, and does not remove tools you already have.',
  parameters: {
    type: 'object',
    properties: {
      modules: {
        type: 'array',
        items: { type: 'string', enum: KNOWN_MODULES },
        description: `Modules to add. One or more of: ${KNOWN_MODULES.join(', ')}.`,
      },
    },
    required: ['modules'],
  },
};

export type RequestToolsOutcome = {
  tools: ToolDeclaration[];
  addedModules: AssistantToolModule[];
  /** Already had every tool in the requested modules — nothing changed. */
  alreadyHadAll: boolean;
  /** Requested strings that are not a real module name, reported back rather than dropped. */
  unknownModules: string[];
};

function isKnownModule(value: string): value is AssistantToolModule {
  return (KNOWN_MODULES as readonly string[]).includes(value);
}

/**
 * Returns a new tool list with every declaration for the requested modules added (deduped by
 * name, order preserved for what's already there). `allDeclarations` is the full catalog to pull
 * new tools from — pass `TOOL_DECLARATIONS` from `dashboardAssistantTools.ts`.
 */
export function widenToolsForModules(
  currentTools: readonly ToolDeclaration[],
  allDeclarations: readonly ToolDeclaration[],
  requestedModules: readonly unknown[]
): RequestToolsOutcome {
  const have = new Set(currentTools.map((t) => t.name));
  const toAdd = new Set<AssistantToolModule>();
  const addedModules: AssistantToolModule[] = [];
  const unknownModules: string[] = [];

  for (const raw of requestedModules) {
    const name = String(raw ?? '').trim();
    if (!name) continue;
    if (isKnownModule(name)) {
      if (!toAdd.has(name)) addedModules.push(name);
      toAdd.add(name);
    } else {
      unknownModules.push(name);
    }
  }

  const tools = [...currentTools];
  let addedAnyTool = false;
  for (const declaration of allDeclarations) {
    const module = ASSISTANT_TOOL_MODULES[declaration.name];
    if (module && toAdd.has(module) && !have.has(declaration.name)) {
      tools.push(declaration);
      have.add(declaration.name);
      addedAnyTool = true;
    }
  }

  return {
    tools,
    addedModules,
    alreadyHadAll: addedModules.length > 0 && !addedAnyTool,
    unknownModules,
  };
}
