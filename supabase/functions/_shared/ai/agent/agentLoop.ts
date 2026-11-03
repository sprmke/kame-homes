/**
 * Provider-agnostic tool loop shared by every chat agent (host assistant, guest receptionist).
 *
 * The loop owns the mechanics: model rounds, history, the per-round call cap, running independent
 * reads in parallel, refusing duplicate calls, and deciding why to stop. Everything with side
 * effects (activity events, grounding, escalation, persistence) stays in callbacks supplied by the
 * adapter, so the same loop can serve surfaces with different tools and guardrails.
 */

import type { GeminiContent, GeminiContentPart } from '../llmTools.ts';

export type AgentToolCall = { name: string; arguments: Record<string, unknown> };

export type AgentModelRound = {
  toolCalls: AgentToolCall[];
  text: string | null;
  modelParts?: GeminiContentPart[];
  creditsConsumed: number;
};

export type AgentStopReason =
  /** The model answered without calling a tool. */
  | 'answered'
  /** A tool asked to end the turn (final blocks, a confirmation card, a refusal). */
  | 'stopped'
  /** The last allowed round ran. */
  | 'rounds'
  /** The turn history passed the token budget. */
  | 'tokens'
  /** The wall-clock budget has no room for another model round. */
  | 'deadline'
  /** The model kept repeating calls it already made. */
  | 'loop';

export type AgentCallOutcome = {
  /** Placed under `functionResponse.response` for the model. */
  response: Record<string, unknown>;
  /** End the turn after this round. */
  stop?: boolean;
};

export type AgentLoopResult = {
  stopReason: AgentStopReason;
  /** Text of the last model round, whether or not it also called tools. */
  lastText: string;
  /** Text of the round that ended with no tool calls (only for `answered`). */
  finalText: string;
  rounds: number;
  creditsConsumed: number;
};

export type AgentLoopOptions<R extends AgentModelRound> = {
  history: GeminiContent[];
  maxRounds: number;
  maxCallsPerRound: number;
  /** Reads that may run side by side. Writes and unknown tools always run alone, in order. */
  isParallelSafe: (toolName: string) => boolean;
  /** Upper bound on simultaneous reads in one group. */
  maxParallel?: number;
  estimateTokens: (history: GeminiContent[]) => number;
  tokenBudget: number;
  hasRoomForAnotherRound: () => boolean;
  /** Throws to abort the turn (cancelled request). Called before every model call and tool. */
  assertActive?: () => void;
  callModel: (round: number, history: GeminiContent[]) => Promise<R>;
  /** The model returned tool calls: retract previews, plan escalation, seed task lists. */
  onToolCalls?: (round: number, result: R, calls: AgentToolCall[]) => void;
  /** Sync side effects when a call starts (activity events). Runs in call order. */
  onCallStart?: (call: AgentToolCall, meta: { round: number; callIndex: number }) => void;
  /** Runs the tool. May run concurrently with other parallel-safe calls. Must not throw for
   * expected failures; return them as an error response instead. */
  runCall: (
    call: AgentToolCall,
    meta: { round: number; callIndex: number }
  ) => Promise<AgentCallOutcome>;
  /** Sync side effects once a call finished. Always runs in call order. */
  onCallSettled?: (
    call: AgentToolCall,
    outcome: AgentCallOutcome,
    meta: { round: number; callIndex: number }
  ) => void;
};

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function callSignature(call: AgentToolCall): string {
  return `${call.name}:${stableStringify(call.arguments)}`;
}

/** A failing call is retried at most once before the loop refuses to run it again. */
const MAX_FAILED_ATTEMPTS = 2;

const DUPLICATE_ERROR =
  'Skipped: you already made this exact call in this turn. Use the earlier result, or change the arguments.';

/** Two rounds made only of repeated calls means the model is stuck; stop instead of burning rounds. */
const MAX_DUPLICATE_ONLY_ROUNDS = 2;

export async function runAgentLoop<R extends AgentModelRound>(
  opts: AgentLoopOptions<R>
): Promise<AgentLoopResult> {
  const history = opts.history;
  /** Signatures of calls that already succeeded (or failed too often) this turn. */
  const seen = new Set<string>();
  const failures = new Map<string, number>();
  const maxParallel = Math.max(1, opts.maxParallel ?? 4);
  let lastText = '';
  let creditsConsumed = 0;
  let duplicateOnlyRounds = 0;

  for (let round = 0; round < opts.maxRounds; round++) {
    opts.assertActive?.();
    const result = await opts.callModel(round, history);
    creditsConsumed += result.creditsConsumed;
    opts.assertActive?.();
    lastText = (result.text ?? '').trim() ? (result.text ?? '') : lastText;

    if (result.toolCalls.length === 0) {
      return {
        stopReason: 'answered',
        lastText: result.text ?? '',
        finalText: result.text ?? '',
        rounds: round + 1,
        creditsConsumed,
      };
    }

    opts.onToolCalls?.(round, result, result.toolCalls);

    // Echo the model's own parts verbatim (thought signatures) so the next round stays valid.
    history.push({
      role: 'model',
      parts:
        result.modelParts && result.modelParts.length > 0
          ? result.modelParts
          : result.toolCalls.map((tc) => ({ functionCall: { name: tc.name, args: tc.arguments } })),
    });

    const budgeted = result.toolCalls.slice(0, opts.maxCallsPerRound);
    const outcomes: AgentCallOutcome[] = new Array(budgeted.length);
    let stopRequested = false;
    let duplicatesInRound = 0;

    let index = 0;
    while (index < budgeted.length) {
      // Build the next group: consecutive reads run together, anything else runs alone.
      const group: number[] = [index];
      const first = budgeted[index];
      const firstDuplicate = seen.has(callSignature(first));
      if (!firstDuplicate && opts.isParallelSafe(first.name)) {
        while (
          group.length < maxParallel &&
          index + group.length < budgeted.length &&
          opts.isParallelSafe(budgeted[index + group.length].name) &&
          !seen.has(callSignature(budgeted[index + group.length]))
        ) {
          group.push(index + group.length);
        }
      }

      // Duplicates are answered without running, in order, and never reach the tool.
      const groupSignatures = new Set<string>();
      const toRun: number[] = [];
      for (const i of group) {
        const signature = callSignature(budgeted[i]);
        if (seen.has(signature) || groupSignatures.has(signature)) {
          outcomes[i] = { response: { result: null, error: DUPLICATE_ERROR } };
          duplicatesInRound++;
        } else {
          groupSignatures.add(signature);
          toRun.push(i);
        }
      }

      opts.assertActive?.();
      for (const i of toRun) {
        opts.onCallStart?.(budgeted[i], { round, callIndex: i });
      }
      const settled = await Promise.all(
        toRun.map((i) => opts.runCall(budgeted[i], { round, callIndex: i }))
      );
      toRun.forEach((i, n) => {
        outcomes[i] = settled[n];
        const signature = callSignature(budgeted[i]);
        if (settled[n].response.error == null) {
          seen.add(signature);
        } else {
          // A failed call may be retried once with the same arguments (transient errors).
          const count = (failures.get(signature) ?? 0) + 1;
          failures.set(signature, count);
          if (count >= MAX_FAILED_ATTEMPTS) seen.add(signature);
        }
      });
      opts.assertActive?.();

      for (const i of group) {
        const outcome = outcomes[i];
        opts.onCallSettled?.(budgeted[i], outcome, { round, callIndex: i });
        if (outcome.stop) stopRequested = true;
      }
      index += group.length;
    }

    const responseParts: GeminiContent['parts'] = budgeted.map((call, i) => ({
      functionResponse: { name: call.name, response: outcomes[i].response },
    }));
    for (const call of result.toolCalls.slice(opts.maxCallsPerRound)) {
      responseParts.push({
        functionResponse: {
          name: call.name,
          response: {
            result: null,
            error: `Skipped: at most ${opts.maxCallsPerRound} tool calls per step. Ask for the rest separately.`,
          },
        },
      });
    }
    history.push({ role: 'user', parts: responseParts });

    const base = { lastText, finalText: '', rounds: round + 1, creditsConsumed };
    if (stopRequested) return { ...base, stopReason: 'stopped' };

    duplicateOnlyRounds = duplicatesInRound === budgeted.length ? duplicateOnlyRounds + 1 : 0;
    if (duplicateOnlyRounds >= MAX_DUPLICATE_ONLY_ROUNDS) return { ...base, stopReason: 'loop' };
    if (round === opts.maxRounds - 1) return { ...base, stopReason: 'rounds' };
    if (opts.estimateTokens(history) > opts.tokenBudget) return { ...base, stopReason: 'tokens' };
    if (!opts.hasRoomForAnotherRound()) return { ...base, stopReason: 'deadline' };
  }

  return { stopReason: 'rounds', lastText, finalText: '', rounds: opts.maxRounds, creditsConsumed };
}
