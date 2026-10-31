/**
 * AI gateway tests. `fetch` is stubbed (no network) and billing has no org, so nothing touches
 * the database — these cover transport + client behavior only.
 */
import { assert, assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { z } from 'zod';

import {
  AiOutputValidationError,
  AiProviderError,
  generateStructured,
  generateText,
  parseModelJson,
  type LlmRequest,
} from './llmClient.ts';
import { backoffDelayMs, resetKeyRotationForTests } from './llmTransport.ts';

const realFetch = globalThis.fetch;
const ENV_KEYS = ['GEMINI_API_KEYS', 'GEMINI_API_KEY', 'GROQ_API_KEY'] as const;

type Call = { url: string; headers: Record<string, string>; body: Record<string, unknown> };

async function withEnv(env: Record<string, string>, fn: () => Promise<void>) {
  const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, Deno.env.get(k)]));
  for (const k of ENV_KEYS) Deno.env.delete(k);
  for (const [k, v] of Object.entries(env)) Deno.env.set(k, v);
  resetKeyRotationForTests();
  try {
    await fn();
  } finally {
    globalThis.fetch = realFetch;
    for (const k of ENV_KEYS) {
      const v = saved[k];
      if (v === undefined) Deno.env.delete(k);
      else Deno.env.set(k, v);
    }
  }
}

function stubFetch(handler: (call: Call, n: number) => Response | Promise<Response>): Call[] {
  const calls: Call[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const call: Call = {
      url: String(input),
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body ? JSON.parse(String(init.body)) : {},
    };
    calls.push(call);
    if (init?.signal?.aborted) throw init.signal.reason;
    return await handler(call, calls.length);
  }) as typeof fetch;
  return calls;
}

const geminiOk = (text: string) =>
  Response.json({
    candidates: [{ content: { parts: [{ text }] } }],
    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
  });

const baseRequest: LlmRequest = {
  feature: 'marketing_caption',
  prompt: { id: 'test_prompt', version: '2026-09-24.1' },
  system: 'You write captions.',
  user: 'Write a caption.',
  billing: { organizationId: null },
};

Deno.test('generateText — sends key in header, systemInstruction, router model', async () => {
  await withEnv({ GEMINI_API_KEY: 'k1' }, async () => {
    const calls = stubFetch(() => geminiOk('Hello'));
    const result = await generateText(baseRequest);
    assertEquals(result.text, 'Hello');
    assertEquals(result.provider, 'gemini');
    assertEquals(result.inputTokens, 10);
    assertEquals(calls[0].headers['x-goog-api-key'], 'k1');
    assert(!calls[0].url.includes('key='), 'API key must not be in the URL');
    assertEquals(
      (calls[0].body.systemInstruction as { parts: Array<{ text: string }> }).parts[0].text,
      'You write captions.'
    );
  });
});

Deno.test('generateText — 403 on one key rotates to the next key without retrying it', async () => {
  await withEnv({ GEMINI_API_KEYS: 'bad,good' }, async () => {
    const calls = stubFetch((call) =>
      call.headers['x-goog-api-key'] === 'bad'
        ? Response.json({ error: { message: 'denied' } }, { status: 403 })
        : geminiOk('ok')
    );
    const result = await generateText(baseRequest);
    assertEquals(result.text, 'ok');
    assertEquals(calls.filter((c) => c.headers['x-goog-api-key'] === 'bad').length, 1);
  });
});

Deno.test('generateText — 400 fails fast without trying other keys', async () => {
  await withEnv({ GEMINI_API_KEYS: 'a,b' }, async () => {
    const calls = stubFetch(() =>
      Response.json({ error: { message: 'Invalid JSON payload' } }, { status: 400 })
    );
    const err = await assertRejects(() => generateText(baseRequest), AiProviderError);
    assertEquals(err.code, 'bad_request');
    assertEquals(calls.length, 1);
  });
});

Deno.test('generateText — 429 retries the same key honoring retry-after', async () => {
  await withEnv({ GEMINI_API_KEY: 'k1' }, async () => {
    const calls = stubFetch((_c, n) =>
      n === 1
        ? new Response(JSON.stringify({ error: { message: 'slow down' } }), {
            status: 429,
            headers: { 'retry-after': '0' },
          })
        : geminiOk('after retry')
    );
    const result = await generateText(baseRequest);
    assertEquals(result.text, 'after retry');
    assertEquals(calls.length, 2);
  });
});

Deno.test('generateText — per-attempt timeout surfaces as AiProviderError(timeout)', async () => {
  await withEnv({ GEMINI_API_KEY: 'k1' }, async () => {
    globalThis.fetch = ((_input: unknown, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
      })) as typeof fetch;
    const err = await assertRejects(
      () => generateText({ ...baseRequest, timeoutMs: 20, groqFallback: false }),
      AiProviderError
    );
    assertEquals(err.code, 'timeout');
  });
});

Deno.test('generateText — caller abort stops immediately (no fallback)', async () => {
  await withEnv({ GEMINI_API_KEY: 'k1', GROQ_API_KEY: 'g' }, async () => {
    const controller = new AbortController();
    controller.abort();
    stubFetch(() => geminiOk('never'));
    const err = await assertRejects(
      () => generateText({ ...baseRequest, signal: controller.signal }),
      AiProviderError
    );
    assertEquals(err.code, 'aborted');
  });
});

Deno.test('generateText — Gemini exhausted falls back to Groq and flags it', async () => {
  await withEnv({ GEMINI_API_KEY: 'k1', GROQ_API_KEY: 'g1' }, async () => {
    const calls = stubFetch((call) =>
      call.url.includes('groq.com')
        ? Response.json({
            choices: [{ message: { content: 'from groq' } }],
            usage: { prompt_tokens: 3, completion_tokens: 2 },
          })
        : Response.json({ error: { message: 'down' } }, { status: 503 })
    );
    const result = await generateText(baseRequest);
    assertEquals(result.provider, 'groq');
    assertEquals(result.fallbackUsed, true);
    assertEquals(result.text, 'from groq');
    assertEquals(calls.at(-1)?.headers.Authorization, 'Bearer g1');
  });
});

Deno.test('generateText — Groq is skipped for PDFs (no vision support)', async () => {
  await withEnv({ GEMINI_API_KEY: 'k1', GROQ_API_KEY: 'g1' }, async () => {
    const calls = stubFetch(() => Response.json({ error: { message: 'down' } }, { status: 500 }));
    await assertRejects(() =>
      generateText({
        ...baseRequest,
        feature: 'receipt_validation',
        user: [{ text: 'check' }, { inlineData: { mimeType: 'application/pdf', data: 'AA==' } }],
      })
    );
    assert(calls.every((c) => !c.url.includes('groq.com')));
  });
});

Deno.test('generateStructured — validates JSON and repairs once on schema failure', async () => {
  await withEnv({ GEMINI_API_KEY: 'k1' }, async () => {
    const calls = stubFetch((_c, n) =>
      n === 1 ? geminiOk('{"verdict":"maybe"}') : geminiOk('```json\n{"verdict":"valid"}\n```')
    );
    const result = await generateStructured({
      ...baseRequest,
      schema: z.object({ verdict: z.enum(['valid', 'invalid']) }),
      jsonSchema: { type: 'object', properties: { verdict: { type: 'string' } } },
    });
    assertEquals(result.data, { verdict: 'valid' });
    assertEquals(calls.length, 2);
    const repairText = JSON.stringify(calls[1].body.contents);
    assert(repairText.includes('did not match the required JSON schema'));
    assertEquals(
      (calls[0].body.generationConfig as Record<string, unknown>).responseMimeType,
      'application/json'
    );
  });
});

Deno.test('generateStructured — throws AiOutputValidationError after a failed repair', async () => {
  await withEnv({ GEMINI_API_KEY: 'k1' }, async () => {
    stubFetch(() => geminiOk('not json at all'));
    await assertRejects(
      () =>
        generateStructured({
          ...baseRequest,
          schema: z.object({ ok: z.boolean() }),
          jsonSchema: { type: 'object' },
        }),
      AiOutputValidationError
    );
  });
});

Deno.test('parseModelJson — plain, fenced and embedded JSON', () => {
  assertEquals(parseModelJson('{"a":1}'), { a: 1 });
  assertEquals(parseModelJson('```json\n{"a":2}\n```'), { a: 2 });
  assertEquals(parseModelJson('Sure! {"a":3} hope that helps'), { a: 3 });
  assertEquals(parseModelJson('nope'), undefined);
});

Deno.test('backoffDelayMs — honors retry-after and caps the wait', () => {
  assertEquals(backoffDelayMs(0, '2'), 2000);
  assertEquals(backoffDelayMs(0, '120'), 4000);
  const jittered = backoffDelayMs(1, null);
  assert(jittered >= 800 && jittered <= 4000);
});
