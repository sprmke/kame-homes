/**
 * Tool-calling gateway tests. `fetch` is stubbed (no network) and billing has no org, so nothing
 * touches the database.
 */
import { assert, assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { z } from 'zod';

import {
  generateStructuredViaTool,
  generateWithTools,
  shouldTryFallbackModel,
} from './llmTools.ts';
import { AiProviderError, resetKeyRotationForTests } from './llmTransport.ts';

const realFetch = globalThis.fetch;

async function withGemini(fn: () => Promise<void>) {
  const saved = Deno.env.get('GEMINI_API_KEY');
  Deno.env.set('GEMINI_API_KEY', 'k1');
  Deno.env.delete('GEMINI_API_KEYS');
  resetKeyRotationForTests();
  try {
    await fn();
  } finally {
    globalThis.fetch = realFetch;
    if (saved === undefined) Deno.env.delete('GEMINI_API_KEY');
    else Deno.env.set('GEMINI_API_KEY', saved);
  }
}

const noCall = () =>
  Response.json({
    candidates: [{ content: { parts: [{ text: 'sorry' }] } }],
    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 2 },
  });

const withCall = (args: Record<string, unknown>) =>
  Response.json({
    candidates: [
      { content: { parts: [{ functionCall: { name: 'extract_structured_data', args } }] } },
    ],
    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 4 },
  });

const request = {
  feature: 'dashboard_assistant' as const,
  prompt: { id: 'test_structured', version: '2026-11-01.1' },
  system: 'Review.',
  user: 'Is this safe?',
  billing: { organizationId: null },
  jsonSchema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
  schema: z.object({ ok: z.boolean() }),
};

Deno.test('structured tool call retries once when the model returns no call', async () => {
  await withGemini(async () => {
    let calls = 0;
    globalThis.fetch = (() => {
      calls++;
      return Promise.resolve(calls === 1 ? noCall() : withCall({ ok: true }));
    }) as typeof fetch;
    const result = await generateStructuredViaTool(request);
    assertEquals(calls, 2);
    assertEquals(result.data, { ok: true });
  });
});

Deno.test('structured tool call retries once on malformed arguments', async () => {
  await withGemini(async () => {
    let calls = 0;
    globalThis.fetch = (() => {
      calls++;
      return Promise.resolve(calls === 1 ? withCall({ ok: 'yes' }) : withCall({ ok: false }));
    }) as typeof fetch;
    const result = await generateStructuredViaTool(request);
    assertEquals(calls, 2);
    assertEquals(result.data, { ok: false });
  });
});

Deno.test(
  'structured tool call gives up after the second bad answer (fails closed upstream)',
  async () => {
    await withGemini(async () => {
      let calls = 0;
      globalThis.fetch = (() => {
        calls++;
        return Promise.resolve(noCall());
      }) as typeof fetch;
      const result = await generateStructuredViaTool(request);
      assertEquals(calls, 2);
      assertEquals(result.data, null);
    });
  }
);

Deno.test('a good first answer costs a single call', async () => {
  await withGemini(async () => {
    let calls = 0;
    globalThis.fetch = (() => {
      calls++;
      return Promise.resolve(withCall({ ok: true }));
    }) as typeof fetch;
    const result = await generateStructuredViaTool(request);
    assertEquals(calls, 1);
    assert(result.data?.ok);
  });
});

Deno.test(
  'shouldTryFallbackModel - only a retryable error on a configured, different model',
  () => {
    const retryable = new AiProviderError('gemini', 'provider_error', 'boom', 503);
    const badRequest = new AiProviderError('gemini', 'bad_request', 'nope', 400);
    assertEquals(
      shouldTryFallbackModel(retryable, 'gemini-2.5-flash', 'gemini-3.1-flash-lite'),
      true
    );
    assertEquals(
      shouldTryFallbackModel(badRequest, 'gemini-2.5-flash', 'gemini-3.1-flash-lite'),
      false
    );
    assertEquals(shouldTryFallbackModel(retryable, undefined, 'gemini-3.1-flash-lite'), false);
    assertEquals(
      shouldTryFallbackModel(retryable, 'gemini-3.1-flash-lite', 'gemini-3.1-flash-lite'),
      false
    );
    assertEquals(
      shouldTryFallbackModel(new Error('plain'), 'gemini-2.5-flash', 'gemini-3.1-flash-lite'),
      false
    );
  }
);

Deno.test(
  'generateWithTools falls back to a different Gemini model on a retryable provider error',
  async () => {
    await withGemini(async () => {
      let calls = 0;
      globalThis.fetch = ((url: string) => {
        calls++;
        if (String(url).includes('gemini-3.1-flash-lite')) {
          return Promise.resolve(
            new Response(JSON.stringify({ error: { message: 'high demand' } }), { status: 503 })
          );
        }
        return Promise.resolve(
          Response.json({
            candidates: [{ content: { parts: [{ text: 'ok from fallback' }] } }],
            usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 2 },
          })
        );
      }) as typeof fetch;
      const result = await generateWithTools({
        feature: 'inbox_suggest',
        prompt: { id: 'test_fallback', version: '1' },
        system: 'You are helpful.',
        user: 'Hi',
        toolMode: 'auto',
        billing: { organizationId: null },
      });
      assertEquals(result.text, 'ok from fallback');
      assertEquals(result.model, 'gemini-2.5-flash');
      assert(calls >= 3, `expected the primary model retried then a fallback call, got ${calls}`);
    });
  }
);

Deno.test(
  'generateWithTools echoes a real thought_signature exactly and leaves a same-round ' +
    'functionCall that Gemini returned without one bare - fabricating a signature next to a ' +
    'real one is REJECTED on the next round (live: "Corrupted thought signature", ' +
    'gemini-3.5-flash-lite - see docs/workflow/in-progress/agentic-ai-assistants.md)',
  async () => {
    await withGemini(async () => {
      globalThis.fetch = (() =>
        Promise.resolve(
          Response.json({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      functionCall: { name: 'get_property_facts', args: {} },
                      thoughtSignature: 'sig-1',
                    },
                    // Gemini does not guarantee a signature on every call of a multi-call turn —
                    // only the first is reliably signed.
                    { functionCall: { name: 'get_parking_facts', args: {} } },
                  ],
                },
              },
            ],
            usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 2 },
          })
        )) as typeof fetch;
      const result = await generateWithTools({
        feature: 'inbox_suggest',
        prompt: { id: 'test_thought_sig', version: '1' },
        system: 'You are helpful.',
        user: 'Is there parking, and what time is check-in?',
        toolMode: 'auto',
        billing: { organizationId: null },
      });
      assertEquals(result.modelParts?.length, 2);
      assertEquals(result.modelParts?.[0]?.thoughtSignature, 'sig-1');
      assert(
        !result.modelParts?.[1] || !('thoughtSignature' in result.modelParts[1]),
        `the unsigned second call must stay bare, not get a fabricated signature, got ${JSON.stringify(result.modelParts?.[1])}`
      );
    });
  }
);

Deno.test(
  'generateWithTools falls back to a well-formed placeholder signature only when NO part in ' +
    'the round got a real one, so echoing it back next round is never rejected as missing ' +
    '(live: "Function call is missing a thought_signature", gemini-2.5-flash)',
  async () => {
    await withGemini(async () => {
      globalThis.fetch = (() =>
        Promise.resolve(
          Response.json({
            candidates: [
              { content: { parts: [{ functionCall: { name: 'get_property_facts', args: {} } }] } },
            ],
            usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 2 },
          })
        )) as typeof fetch;
      const result = await generateWithTools({
        feature: 'inbox_suggest',
        prompt: { id: 'test_thought_sig_missing', version: '1' },
        system: 'You are helpful.',
        user: 'Is there parking?',
        toolMode: 'auto',
        billing: { organizationId: null },
      });
      assertEquals(result.modelParts?.length, 1);
      assert(
        'thoughtSignature' in (result.modelParts?.[0] ?? {}) &&
          typeof (result.modelParts?.[0] as { thoughtSignature?: string }).thoughtSignature ===
            'string' &&
          ((result.modelParts?.[0] as { thoughtSignature?: string }).thoughtSignature?.length ??
            0) > 0,
        `a wholly signature-less round must still get a well-formed placeholder, got ${JSON.stringify(result.modelParts?.[0])}`
      );
    });
  }
);

Deno.test('generateWithTools never falls back for a non-retryable error', async () => {
  await withGemini(async () => {
    let calls = 0;
    globalThis.fetch = (() => {
      calls++;
      return Promise.resolve(
        new Response(JSON.stringify({ error: { message: 'bad request' } }), { status: 400 })
      );
    }) as typeof fetch;
    await assertRejects(() =>
      generateWithTools({
        feature: 'inbox_suggest',
        prompt: { id: 'test_fallback_400', version: '1' },
        system: 'You are helpful.',
        user: 'Hi',
        toolMode: 'auto',
        billing: { organizationId: null },
      })
    );
    assertEquals(
      calls,
      1,
      'a 400 must fail fast: never retried on the same model, never falls back'
    );
  });
});
