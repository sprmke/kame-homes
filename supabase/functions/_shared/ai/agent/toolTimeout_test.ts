import { assert, assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { ToolTimeoutError, toolTimeoutMsFromEnv, withToolTimeout } from './toolTimeout.ts';

Deno.test('toolTimeoutMsFromEnv falls back to the default on blank/invalid input', () => {
  assertEquals(toolTimeoutMsFromEnv(undefined), 20_000);
  assertEquals(toolTimeoutMsFromEnv(''), 20_000);
  assertEquals(toolTimeoutMsFromEnv('not a number'), 20_000);
  assertEquals(toolTimeoutMsFromEnv('0'), 20_000);
  assertEquals(toolTimeoutMsFromEnv('-5'), 20_000);
});

Deno.test('toolTimeoutMsFromEnv uses a valid positive override', () => {
  assertEquals(toolTimeoutMsFromEnv('5000'), 5_000);
});

Deno.test(
  'withToolTimeout resolves normally when the call finishes before the deadline',
  async () => {
    const result = await withToolTimeout('fast_tool', () => Promise.resolve('ok'), 50);
    assertEquals(result, 'ok');
  }
);

Deno.test('withToolTimeout rejects with ToolTimeoutError when the call never settles', async () => {
  const hang = () => new Promise<string>(() => {});
  await assertRejects(
    () => withToolTimeout('slow_tool', hang, 10),
    ToolTimeoutError,
    'slow_tool timed out after 10ms'
  );
});

Deno.test(
  'withToolTimeout propagates the call rejection, not a timeout, when it fails fast',
  async () => {
    await assertRejects(
      () => withToolTimeout('failing_tool', () => Promise.reject(new Error('boom')), 1_000),
      Error,
      'boom'
    );
  }
);

Deno.test(
  'withToolTimeout clears its timer so a slow process does not keep the test alive',
  async () => {
    await withToolTimeout('fast_tool', () => Promise.resolve('ok'), 1_000);
    assert(true);
  }
);
