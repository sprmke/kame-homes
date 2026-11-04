import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import type { GeminiContent } from '../llmTools.ts';
import {
  callSignature,
  runAgentLoop,
  type AgentCallOutcome,
  type AgentLoopOptions,
  type AgentModelRound,
  type AgentToolCall,
} from './agentLoop.ts';

const READS = new Set(['get_a', 'get_b', 'get_c']);

function scriptedModel(rounds: Array<Partial<AgentModelRound> & { toolCalls?: AgentToolCall[] }>) {
  let i = 0;
  const seenHistories: number[] = [];
  return {
    seenHistories,
    callModel: (_round: number, history: GeminiContent[]): Promise<AgentModelRound> => {
      seenHistories.push(history.length);
      const next = rounds[Math.min(i++, rounds.length - 1)];
      return Promise.resolve({
        toolCalls: next.toolCalls ?? [],
        text: next.text ?? null,
        creditsConsumed: next.creditsConsumed ?? 1,
        modelParts: next.modelParts,
      });
    },
  };
}

function baseOptions(
  model: ReturnType<typeof scriptedModel>,
  overrides: Partial<AgentLoopOptions<AgentModelRound>> = {}
): AgentLoopOptions<AgentModelRound> {
  return {
    history: [{ role: 'user', parts: [{ text: 'hi' }] }],
    maxRounds: 5,
    maxCallsPerRound: 4,
    isParallelSafe: (name) => READS.has(name),
    estimateTokens: () => 10,
    tokenBudget: 1000,
    hasRoomForAnotherRound: () => true,
    callModel: model.callModel,
    runCall: (call) => Promise.resolve({ response: { result: { ok: call.name }, error: null } }),
    ...overrides,
  };
}

const call = (name: string, args: Record<string, unknown> = {}): AgentToolCall => ({
  name,
  arguments: args,
});

Deno.test('answers immediately when the model calls no tools', async () => {
  const model = scriptedModel([{ text: 'done' }]);
  const result = await runAgentLoop(baseOptions(model));
  assertEquals(result.stopReason, 'answered');
  assertEquals(result.finalText, 'done');
  assertEquals(result.rounds, 1);
});

Deno.test('feeds tool results back and finishes on the next round', async () => {
  const model = scriptedModel([{ toolCalls: [call('get_a')] }, { text: 'all set' }]);
  const options = baseOptions(model);
  const result = await runAgentLoop(options);
  assertEquals(result.stopReason, 'answered');
  assertEquals(result.rounds, 2);
  assertEquals(result.creditsConsumed, 2);
  // user, model(functionCall), user(functionResponse)
  assertEquals(options.history.length, 3);
  assertEquals(options.history[2].role, 'user');
});

Deno.test('echoes the model parts verbatim so thought signatures survive', async () => {
  const parts = [
    { functionCall: { name: 'get_a', args: {} }, thoughtSignature: 'sig-1' },
  ] as AgentModelRound['modelParts'];
  const model = scriptedModel([{ toolCalls: [call('get_a')], modelParts: parts }, { text: 'x' }]);
  const options = baseOptions(model);
  await runAgentLoop(options);
  assertEquals(options.history[1].parts, parts);
});

Deno.test('reads in one round run in parallel and settle in call order', async () => {
  const order: string[] = [];
  let active = 0;
  let maxActive = 0;
  const model = scriptedModel([
    { toolCalls: [call('get_a'), call('get_b'), call('get_c')] },
    { text: 'ok' },
  ]);
  const result = await runAgentLoop(
    baseOptions(model, {
      runCall: async (c) => {
        active++;
        maxActive = Math.max(maxActive, active);
        // The first call is the slowest, so settle order proves ordering is by call index.
        await new Promise((r) => setTimeout(r, c.name === 'get_a' ? 30 : 5));
        active--;
        return { response: { result: c.name, error: null } };
      },
      onCallSettled: (c) => order.push(c.name),
    })
  );
  assertEquals(result.stopReason, 'answered');
  assertEquals(maxActive, 3);
  assertEquals(order, ['get_a', 'get_b', 'get_c']);
});

Deno.test('writes never run in parallel with anything and keep their position', async () => {
  const events: string[] = [];
  const model = scriptedModel([
    { toolCalls: [call('get_a'), call('set_x'), call('get_b')] },
    { text: 'ok' },
  ]);
  await runAgentLoop(
    baseOptions(model, {
      runCall: async (c) => {
        events.push(`start:${c.name}`);
        await new Promise((r) => setTimeout(r, 5));
        events.push(`end:${c.name}`);
        return { response: { result: null, error: null } };
      },
    })
  );
  assertEquals(events, [
    'start:get_a',
    'end:get_a',
    'start:set_x',
    'end:set_x',
    'start:get_b',
    'end:get_b',
  ]);
});

Deno.test('responses line up with calls even when the model asks for too many', async () => {
  const calls = [call('get_a'), call('get_b'), call('get_c'), call('get_a', { x: 1 })];
  const model = scriptedModel([{ toolCalls: calls }, { text: 'ok' }]);
  const options = baseOptions(model, { maxCallsPerRound: 2 });
  await runAgentLoop(options);
  const responses = options.history[2].parts as Array<{
    functionResponse: { name: string; response: { error: string | null } };
  }>;
  assertEquals(
    responses.map((r) => r.functionResponse.name),
    ['get_a', 'get_b', 'get_c', 'get_a']
  );
  assertEquals(responses[0].functionResponse.response.error, null);
  assert(String(responses[2].functionResponse.response.error).startsWith('Skipped: at most 2'));
  assert(String(responses[3].functionResponse.response.error).startsWith('Skipped: at most 2'));
});

Deno.test('a stop request ends the turn after that round', async () => {
  const model = scriptedModel([{ toolCalls: [call('card')] }, { text: 'never' }]);
  const result = await runAgentLoop(
    baseOptions(model, {
      runCall: () => Promise.resolve({ response: { result: 1, error: null }, stop: true }),
    })
  );
  assertEquals(result.stopReason, 'stopped');
  assertEquals(result.rounds, 1);
});

Deno.test('stops at the round cap with the reason rounds', async () => {
  let n = 0;
  const model = scriptedModel([{ toolCalls: [call('get_a', { n: ++n })] }]);
  const result = await runAgentLoop(
    baseOptions(model, {
      maxRounds: 3,
      callModel: (_r, _h) =>
        Promise.resolve({ toolCalls: [call('get_a', { n: ++n })], text: null, creditsConsumed: 1 }),
    })
  );
  assertEquals(result.stopReason, 'rounds');
  assertEquals(result.rounds, 3);
});

Deno.test('stops on the token budget and on the deadline', async () => {
  let n = 0;
  const next = () =>
    Promise.resolve({
      toolCalls: [call('get_a', { n: ++n })],
      text: 'partial',
      creditsConsumed: 1,
    });
  const tokens = await runAgentLoop(
    baseOptions(scriptedModel([{}]), { callModel: next, estimateTokens: () => 5000 })
  );
  assertEquals(tokens.stopReason, 'tokens');
  assertEquals(tokens.lastText, 'partial');

  const deadline = await runAgentLoop(
    baseOptions(scriptedModel([{}]), { callModel: next, hasRoomForAnotherRound: () => false })
  );
  assertEquals(deadline.stopReason, 'deadline');
  assertEquals(deadline.rounds, 1);
});

Deno.test('a repeated successful call is answered without running the tool again', async () => {
  let runs = 0;
  const model = scriptedModel([
    { toolCalls: [call('get_a', { id: 1 })] },
    { toolCalls: [call('get_a', { id: 1 })] },
    { text: 'ok' },
  ]);
  const options = baseOptions(model, {
    runCall: () => {
      runs++;
      return Promise.resolve({ response: { result: 1, error: null } });
    },
  });
  const result = await runAgentLoop(options);
  assertEquals(runs, 1);
  assertEquals(result.stopReason, 'answered');
  const dup = (
    options.history[4].parts[0] as unknown as {
      functionResponse: { response: { error: string } };
    }
  ).functionResponse.response.error;
  assert(dup.startsWith('Skipped: you already made this exact call'));
});

Deno.test('argument order does not hide a duplicate', () => {
  assertEquals(
    callSignature(call('x', { a: 1, b: { c: 2, d: 3 } })),
    callSignature(call('x', { b: { d: 3, c: 2 }, a: 1 }))
  );
});

Deno.test('a model stuck repeating calls is stopped with the reason loop', async () => {
  const model = scriptedModel([{ toolCalls: [call('get_a', { id: 1 })] }]);
  const result = await runAgentLoop(baseOptions(model, { maxRounds: 8 }));
  assertEquals(result.stopReason, 'loop');
  assert(result.rounds <= 4);
});

Deno.test('a failed call can be retried once, then is refused', async () => {
  let runs = 0;
  const model = scriptedModel([
    { toolCalls: [call('get_a', { id: 1 })] },
    { toolCalls: [call('get_a', { id: 1 })] },
    { toolCalls: [call('get_a', { id: 1 })] },
    { text: 'gave up' },
  ]);
  const result = await runAgentLoop(
    baseOptions(model, {
      runCall: () => {
        runs++;
        return Promise.resolve({ response: { result: null, error: 'boom' } });
      },
    })
  );
  assertEquals(runs, 2);
  assertEquals(result.stopReason, 'answered');
});

Deno.test('assertActive aborts before the tool runs', async () => {
  const model = scriptedModel([{ toolCalls: [call('get_a')] }]);
  let ran = false;
  let calls = 0;
  let error: unknown = null;
  try {
    await runAgentLoop(
      baseOptions(model, {
        assertActive: () => {
          // Allow the first model call, then abort before the tool.
          if (++calls > 2) throw new Error('aborted');
        },
        runCall: () => {
          ran = true;
          return Promise.resolve({ response: { result: 1, error: null } } as AgentCallOutcome);
        },
      })
    );
  } catch (err) {
    error = err;
  }
  assertEquals((error as Error).message, 'aborted');
  assertEquals(ran, false);
});
