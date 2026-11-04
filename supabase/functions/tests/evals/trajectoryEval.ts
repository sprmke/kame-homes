/**
 * Full-turn trajectory evals (Phase 7 of the agentic-AI plan): drives the real multi-round
 * tool-calling loop against a **mocked tool layer** (canned results keyed by tool name, no live
 * DB writes, no real Supabase calls) and scores the set of tools called, step order/coverage, and
 * the final answer's content — not just a single tool-selection call like `assistant`/`guest` do.
 *
 * The loop mirrors `dashboard-assistant-chat/index.ts`'s real round loop closely enough to be a
 * meaningful trajectory signal (echo `modelParts` verbatim into history, build `functionResponse`
 * parts per call, stop when a round returns no tool calls or the round cap is hit) without
 * importing that handler directly — it has no live-DB-free entry point to call into.
 */
import type { AiFeature } from '../../_shared/aiModelRouter.ts';
import { PLAN_TASK_NAME } from '../../_shared/ai/agent/taskPlanTool.ts';
import { REQUEST_TOOLS_NAME } from '../../_shared/ai/agent/toolRegistry.ts';
import {
  generateWithTools,
  type GeminiContent,
  type ToolDeclaration,
} from '../../_shared/ai/llmTools.ts';
import type { PromptRef } from '../../_shared/ai/prompt.ts';
import { RESPOND_WITH_BLOCKS_NAME } from '../../_shared/ai/prompts/dashboardAssistant.ts';
import { readJsonl } from './evalDatasets.ts';

export type MockToolResult = { ok: boolean; data?: unknown; error?: string };

const mockFixtureCache = new Map<string, Record<string, MockToolResult>>();

/** Loads a {toolName: MockToolResult} table from fixtures/assistant/. */
export async function loadMockToolFixtures(file: string): Promise<Record<string, MockToolResult>> {
  const cached = mockFixtureCache.get(file);
  if (cached) return cached;
  const url = new URL(`./fixtures/assistant/${file}`, import.meta.url);
  const parsed = JSON.parse(await Deno.readTextFile(url)) as Record<string, MockToolResult>;
  mockFixtureCache.set(file, parsed);
  return parsed;
}

const UNMAPPED_TOOL_RESULT: MockToolResult = {
  ok: false,
  error:
    'This tool has no mocked result in the eval harness. Answer with what you already have, or ask a clarifying question — do not retry this tool.',
};

/** Booking ids the mocked fixtures actually know about (see trajectory_tools.json / guest_trajectory_tools.json). */
const KNOWN_FIXTURE_BOOKING_IDS = new Set([
  'b1a2c3d4-0000-4000-8000-000000000001',
  'b1a2c3d4-0000-4000-8000-000000000002',
  'b1a2c3d4-0000-4000-8000-000000000003',
]);

/** Tools scoped to one bookingId — a mocked call against an id the fixtures don't know about must
 *  refuse, the same way the real tool would reject an out-of-scope id, not silently succeed. */
const BOOKING_SCOPED_TOOLS = new Set([
  'get_booking',
  'propose_cancel_booking',
  'propose_transition_booking',
  'get_booking_documents',
  'get_available_transitions',
  'get_my_stay',
]);

const OUT_OF_SCOPE_BOOKING_RESULT: MockToolResult = {
  ok: false,
  error: "Couldn't find a booking with that id for this organization/property.",
};

function resolveMockResult(
  name: string,
  args: Record<string, unknown>,
  mockResults: Record<string, MockToolResult>
): MockToolResult {
  if (BOOKING_SCOPED_TOOLS.has(name)) {
    const bookingId = typeof args.bookingId === 'string' ? args.bookingId : undefined;
    if (bookingId && !KNOWN_FIXTURE_BOOKING_IDS.has(bookingId)) {
      return OUT_OF_SCOPE_BOOKING_RESULT;
    }
  }
  return mockResults[name] ?? UNMAPPED_TOOL_RESULT;
}

export type TrajectoryCall = { round: number; name: string; args: Record<string, unknown> };

export type TrajectoryResult = {
  calls: TrajectoryCall[];
  finalText: string;
  roundsUsed: number;
  stoppedBy: 'no_more_calls' | 'max_rounds';
};

/** Drives `generateWithTools` across rounds against a mocked tool layer — no real tool execution. */
export async function runTrajectory(input: {
  feature: AiFeature;
  prompt: PromptRef;
  system: string;
  message: string;
  tools: ToolDeclaration[];
  mockResults: Record<string, MockToolResult>;
  maxRounds?: number;
}): Promise<TrajectoryResult> {
  const maxRounds = input.maxRounds ?? 4;
  const history: GeminiContent[] = [{ role: 'user', parts: [{ text: input.message }] }];
  const calls: TrajectoryCall[] = [];
  let finalText = '';
  let stoppedBy: TrajectoryResult['stoppedBy'] = 'no_more_calls';

  for (let round = 0; round < maxRounds; round++) {
    // One retry per round for a transient provider error (e.g. a flaky "bad_request" / thought
    // signature rejection under rapid-fire eval traffic) — the real turn loop gets this for free
    // from its own fallback-model retry; this harness has no such wrapper, so without a retry a
    // single flaky call kills the whole multi-round case and drowns the real trajectory signal.
    let res;
    try {
      res = await generateWithTools({
        feature: input.feature,
        prompt: input.prompt,
        system: input.system,
        history,
        tools: input.tools,
        toolMode: 'auto',
        maxOutputTokens: 512,
        billing: { organizationId: null },
      });
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
      res = await generateWithTools({
        feature: input.feature,
        prompt: input.prompt,
        system: input.system,
        history,
        tools: input.tools,
        toolMode: 'auto',
        maxOutputTokens: 512,
        billing: { organizationId: null },
      });
    }

    if (res.toolCalls.length === 0) {
      finalText = res.text ?? '';
      break;
    }

    history.push({
      role: 'model',
      parts:
        res.modelParts && res.modelParts.length > 0
          ? res.modelParts
          : res.toolCalls.map((tc) => ({ functionCall: { name: tc.name, args: tc.arguments } })),
    });

    const responseParts: GeminiContent['parts'] = [];
    let respondedWithBlocks = false;
    for (const call of res.toolCalls) {
      // Meta-tools (plan_task / request_tools / respond_with_blocks) never execute anything —
      // same trivial-ack handling as dashboard-assistant-chat/index.ts — and don't count toward
      // the trajectory's real tool-call coverage.
      if (call.name === PLAN_TASK_NAME) {
        const goalCount = Array.isArray(call.arguments.goals) ? call.arguments.goals.length : 0;
        responseParts.push({
          functionResponse: {
            name: call.name,
            response: { result: { ok: true, goalCount }, error: null },
          },
        });
        continue;
      }
      if (call.name === REQUEST_TOOLS_NAME) {
        responseParts.push({
          functionResponse: { name: call.name, response: { result: { ok: true }, error: null } },
        });
        continue;
      }
      if (call.name === RESPOND_WITH_BLOCKS_NAME) {
        const rawBlocks = Array.isArray(call.arguments.blocks) ? call.arguments.blocks : [];
        finalText = rawBlocks
          .filter((b): b is { type?: string; text?: string } => typeof b === 'object' && b !== null)
          .filter((b) => b.type === 'text' && typeof b.text === 'string')
          .map((b) => b.text)
          .join(' ');
        respondedWithBlocks = true;
        continue;
      }
      calls.push({ round, name: call.name, args: call.arguments });
      const mocked = resolveMockResult(call.name, call.arguments, input.mockResults);
      responseParts.push({
        functionResponse: {
          name: call.name,
          response: {
            result: mocked.ok ? (mocked.data ?? null) : null,
            error: mocked.ok ? null : (mocked.error ?? 'Mocked tool returned no result.'),
          },
        },
      });
    }
    if (respondedWithBlocks) break;
    history.push({ role: 'user', parts: responseParts });

    if (round === maxRounds - 1) {
      finalText = res.text ?? '';
      stoppedBy = 'max_rounds';
    }
  }

  const roundsUsed = calls.length > 0 ? Math.max(...calls.map((c) => c.round)) + 1 : 0;
  return { calls, finalText, roundsUsed, stoppedBy };
}

export type TrajectoryExpect = {
  /** Every one of these must appear among the distinct tools called. */
  toolsCalledAll?: string[];
  /** At least one of these must appear among the distinct tools called. */
  toolsCalledAny?: string[];
  /** None of these may ever be called. */
  forbidTools?: string[];
  /** Minimum count of distinct tools called — a coarse multi-intent-coverage signal. */
  minDistinctTools?: number;
  /** Trajectory must finish within this many rounds (not hit the cap). */
  maxRounds?: number;
  /** The final answer text must mention at least one of these (case-insensitive substring). */
  mustMentionAny?: string[];
  /** The final answer text must mention none of these (case-insensitive substring). */
  mustNotMentionAny?: string[];
  /**
   * Same leniency as the `guest` suite's `answeredFromFacts`: when the answer is already in the
   * system prompt's "Known facts" (e.g. check-in time), answering with no tool call and a
   * substantive reply is correct, not a coverage miss — satisfies `toolsCalledAny`/`minDistinctTools`.
   */
  allowAnsweredFromFactsInstead?: boolean;
};

export type TrajectoryRow = {
  id: string;
  message: string;
  module: string;
  /** fixtures/assistant/<file> — a {toolName: MockToolResult} table. */
  mockFixtureFile: string;
  expect: TrajectoryExpect;
};

export async function readTrajectoryRows(datasetFile: string): Promise<TrajectoryRow[]> {
  return await readJsonl<TrajectoryRow>(datasetFile);
}

export function scoreTrajectory(
  result: TrajectoryResult,
  expect: TrajectoryExpect
): { pass: boolean; problems: string[] } {
  const problems: string[] = [];
  const called = result.calls.map((c) => c.name);
  const distinct = new Set(called);
  const text = (result.finalText ?? '').toLowerCase();
  const answeredFromFacts =
    !!expect.allowAnsweredFromFactsInstead &&
    called.length === 0 &&
    (result.finalText ?? '').trim().length >= 12;

  if (expect.toolsCalledAll && !answeredFromFacts) {
    const missing = expect.toolsCalledAll.filter((t) => !distinct.has(t));
    if (missing.length) problems.push(`missing required tool(s): ${missing.join(', ')}`);
  }
  if (
    expect.toolsCalledAny &&
    !answeredFromFacts &&
    !expect.toolsCalledAny.some((t) => distinct.has(t))
  ) {
    problems.push(
      `expected one of [${expect.toolsCalledAny.join(', ')}], got [${called.join(', ') || '(none)'}]`
    );
  }
  if (expect.forbidTools) {
    const forbidden = called.filter((t) => expect.forbidTools!.includes(t));
    if (forbidden.length) problems.push(`forbidden tool(s) called: ${forbidden.join(', ')}`);
  }
  if (expect.minDistinctTools && !answeredFromFacts && distinct.size < expect.minDistinctTools) {
    problems.push(`expected >= ${expect.minDistinctTools} distinct tools, got ${distinct.size}`);
  }
  if (expect.maxRounds && result.roundsUsed > expect.maxRounds) {
    problems.push(`used ${result.roundsUsed} rounds, expected <= ${expect.maxRounds}`);
  }
  if (expect.mustMentionAny && !expect.mustMentionAny.some((s) => text.includes(s.toLowerCase()))) {
    problems.push(`final text missing any of: ${expect.mustMentionAny.join(', ')}`);
  }
  if (expect.mustNotMentionAny) {
    const leaked = expect.mustNotMentionAny.filter((s) => text.includes(s.toLowerCase()));
    if (leaked.length) problems.push(`final text leaked: ${leaked.join(', ')}`);
  }

  return { pass: problems.length === 0, problems };
}
