/**
 * Deno tests for _shared/marketingImageGenerationAi.ts — run with `deno test --allow-env`.
 * Plan: docs/workflow/in-progress/marketing-ai-image-quality-hardening.md (Phase 5)
 *
 * `fetch` is stubbed so no network is hit — same pattern as captcha_test.ts.
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import type { AiImageModelConfig } from './aiModelRouter.ts';
import {
  GenerationProviderError,
  GenerationSafetyError,
  generateMarketingImage,
  isGenerationSafetyError,
} from './marketingImageGenerationAi.ts';
import { isDegenerateGeneratedImage } from './marketingGenerationStorage.ts';
import { buildSolidColorPng } from './pngTestFixtures.ts';
import { resetKeyRotationForTests } from './ai/llmTransport.ts';

const realFetch = globalThis.fetch;

function restoreFetch() {
  globalThis.fetch = realFetch;
}

function withEnv(vars: Record<string, string | undefined>, run: () => Promise<void>) {
  const prev: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    prev[k] = Deno.env.get(k);
    if (v === undefined) Deno.env.delete(k);
    else Deno.env.set(k, v);
  }
  resetKeyRotationForTests();
  const done = () => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) Deno.env.delete(k);
      else Deno.env.set(k, v);
    }
  };
  return run().finally(done);
}

// 1x1 transparent PNG, base64-encoded — small but a structurally valid PNG header
// (readImageDimensions reads width/height straight from these bytes: 1x1).
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

const CONFIG: AiImageModelConfig = {
  model: 'gemini-3.1-flash-image',
  tier: 'flash',
  inputUsdPer1M: 0.5,
  outputUsdPer1M: 60,
  defaultMaxOutputTokens: 8192,
  thinkingBudget: 0,
  timeoutMs: 45_000,
  groqFallback: false,
  maxReferenceImages: 14,
  allowedSizes: ['1K'],
  allowedAspectRatios: ['1:1'],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function imageResponseBody(base64 = TINY_PNG_BASE64) {
  return {
    candidates: [
      {
        finishReason: 'STOP',
        content: { parts: [{ inlineData: { mimeType: 'image/png', data: base64 } }] },
      },
    ],
    usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 4 },
  };
}

Deno.test('generateMarketingImage: returns bytes + usage on a clean response', () =>
  withEnv({ GEMINI_API_KEY: 'test-key', GEMINI_API_KEYS: undefined }, async () => {
    let calls = 0;
    globalThis.fetch = ((_url: string) => {
      calls += 1;
      return Promise.resolve(jsonResponse(imageResponseBody()));
    }) as typeof fetch;

    try {
      const result = await generateMarketingImage({
        config: CONFIG,
        prompt: 'a bright living room',
        aspectRatio: '1:1',
        imageSize: '1K',
        references: [],
      });
      assertEquals(calls, 1);
      assertEquals(result.mimeType, 'image/png');
      assertEquals(result.inputTokens, 120);
      assertEquals(result.outputTokens, 4);
      assertEquals(result.model, CONFIG.model);
    } finally {
      restoreFetch();
    }
  })
);

Deno.test('generateMarketingImage: promptFeedback.blockReason -> GenerationSafetyError', () =>
  withEnv({ GEMINI_API_KEY: 'test-key', GEMINI_API_KEYS: undefined }, async () => {
    globalThis.fetch = (() =>
      Promise.resolve(jsonResponse({ promptFeedback: { blockReason: 'SAFETY' } }))) as typeof fetch;

    try {
      await assertRejects(
        () =>
          generateMarketingImage({
            config: CONFIG,
            prompt: 'anything',
            aspectRatio: '1:1',
            imageSize: '1K',
            references: [],
          }),
        GenerationSafetyError
      );
    } finally {
      restoreFetch();
    }
  })
);

Deno.test('generateMarketingImage: finishReason IMAGE_SAFETY -> GenerationSafetyError', () =>
  withEnv({ GEMINI_API_KEY: 'test-key', GEMINI_API_KEYS: undefined }, async () => {
    globalThis.fetch = (() =>
      Promise.resolve(
        jsonResponse({ candidates: [{ finishReason: 'IMAGE_SAFETY', content: { parts: [] } }] })
      )) as typeof fetch;

    try {
      const err = await generateMarketingImage({
        config: CONFIG,
        prompt: 'anything',
        aspectRatio: '1:1',
        imageSize: '1K',
        references: [],
      }).catch((e) => e);
      assertEquals(isGenerationSafetyError(err), true);
    } finally {
      restoreFetch();
    }
  })
);

Deno.test('generateMarketingImage: no image part -> GenerationProviderError', () =>
  withEnv({ GEMINI_API_KEY: 'test-key', GEMINI_API_KEYS: undefined }, async () => {
    globalThis.fetch = (() =>
      Promise.resolve(
        jsonResponse({
          candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'oops' }] } }],
        })
      )) as typeof fetch;

    try {
      await assertRejects(
        () =>
          generateMarketingImage({
            config: CONFIG,
            prompt: 'anything',
            aspectRatio: '1:1',
            imageSize: '1K',
            references: [],
          }),
        GenerationProviderError
      );
    } finally {
      restoreFetch();
    }
  })
);

Deno.test('generateMarketingImage: rotates to the next key on a 5xx, succeeds on the second', () =>
  withEnv({ GEMINI_API_KEY: undefined, GEMINI_API_KEYS: 'key-a,key-b' }, async () => {
    const seenUrls: string[] = [];
    let call = 0;
    globalThis.fetch = ((url: string) => {
      seenUrls.push(String(url));
      call += 1;
      // First key: two attempts (Phase 4a same-key retry), both 503.
      // Second key: succeeds immediately.
      if (call <= 2)
        return Promise.resolve(jsonResponse({ error: { message: 'overloaded' } }, 503));
      return Promise.resolve(jsonResponse(imageResponseBody()));
    }) as typeof fetch;

    try {
      const result = await generateMarketingImage({
        config: CONFIG,
        prompt: 'anything',
        aspectRatio: '1:1',
        imageSize: '1K',
        references: [],
      });
      assertEquals(result.mimeType, 'image/png');
      // 2 attempts on the first key (same-key retry) + 1 on the second = 3 calls.
      assertEquals(call, 3);
    } finally {
      restoreFetch();
    }
  })
);

Deno.test(
  'generateMarketingImage: no configured keys -> GenerationProviderError before any fetch',
  () =>
    withEnv({ GEMINI_API_KEY: undefined, GEMINI_API_KEYS: undefined }, async () => {
      let called = false;
      globalThis.fetch = (() => {
        called = true;
        return Promise.resolve(jsonResponse({}));
      }) as typeof fetch;

      try {
        await assertRejects(
          () =>
            generateMarketingImage({
              config: CONFIG,
              prompt: 'anything',
              aspectRatio: '1:1',
              imageSize: '1K',
              references: [],
            }),
          GenerationProviderError
        );
        assertEquals(called, false);
      } finally {
        restoreFetch();
      }
    })
);

Deno.test('isDegenerateGeneratedImage: rejects a too-small payload', async () => {
  const result = await isDegenerateGeneratedImage({
    bytes: new Uint8Array(10),
    dimensions: { width: 1024, height: 1024 },
    requestedAspectRatio: '1:1',
  });
  assertEquals(result.degenerate, true);
});

Deno.test('isDegenerateGeneratedImage: rejects unreadable dimensions', async () => {
  const result = await isDegenerateGeneratedImage({
    bytes: new Uint8Array(4096),
    dimensions: null,
    requestedAspectRatio: '1:1',
  });
  assertEquals(result.degenerate, true);
});

Deno.test('isDegenerateGeneratedImage: rejects a wildly wrong aspect ratio', async () => {
  const result = await isDegenerateGeneratedImage({
    bytes: new Uint8Array(4096),
    dimensions: { width: 2000, height: 200 }, // 10:1, requested 1:1
    requestedAspectRatio: '1:1',
  });
  assertEquals(result.degenerate, true);
});

Deno.test('isDegenerateGeneratedImage: accepts a close-enough aspect ratio', async () => {
  // All-zero bytes are not a valid PNG, so the pixel sampler reports unsupported and
  // only the header-level checks (size, dimensions, aspect ratio) apply here.
  const result = await isDegenerateGeneratedImage({
    bytes: new Uint8Array(4096),
    dimensions: { width: 1024, height: 1000 }, // ~1.024:1, requested 1:1 — within tolerance
    requestedAspectRatio: '1:1',
  });
  assertEquals(result.degenerate, false);
});

Deno.test(
  'isDegenerateGeneratedImage: non-numeric aspect ratio string is not checked (skips the ratio test)',
  async () => {
    const result = await isDegenerateGeneratedImage({
      bytes: new Uint8Array(4096),
      dimensions: { width: 500, height: 500 },
      requestedAspectRatio: 'not-a-ratio',
    });
    assertEquals(result.degenerate, false);
  }
);

Deno.test('isDegenerateGeneratedImage: rejects a real PNG that is blank/near-uniform', async () => {
  // A minimal valid PNG whose only pixel is solid black — exercises the pixel-level
  // layer end to end (not just the header checks the other tests cover).
  const solidBlackPng = await buildSolidColorPng(64, 64, [0, 0, 0]);
  const result = await isDegenerateGeneratedImage({
    bytes: solidBlackPng,
    dimensions: { width: 64, height: 64 },
    requestedAspectRatio: '1:1',
  });
  assertEquals(result.degenerate, true);
});

Deno.test('isDegenerateGeneratedImage: accepts a real PNG with genuine variance', async () => {
  const variedPng = await buildSolidColorPng(64, 64, [0, 0, 0], true);
  const result = await isDegenerateGeneratedImage({
    bytes: variedPng,
    dimensions: { width: 64, height: 64 },
    requestedAspectRatio: '1:1',
  });
  assertEquals(result.degenerate, false);
});
