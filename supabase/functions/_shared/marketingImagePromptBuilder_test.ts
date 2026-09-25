/**
 * Deno tests for _shared/marketingImagePromptBuilder.ts — run with `deno test --allow-env`.
 * Plan: docs/workflow/in-progress/marketing-ai-image-quality-hardening.md (Phase 5)
 *
 * The fail-open test is the most important one in this file: a broken or slow
 * enhancement call must never break a paid image generation.
 */

import { assertEquals, assertMatch } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  amenitiesFromPropertySettings,
  buildStructuredImagePrompt,
  enhanceMarketingImagePrompt,
  resolvePlatformIntent,
  type MarketingImagePropertyContext,
} from './marketingImagePromptBuilder.ts';
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
  const done = () => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) Deno.env.delete(k);
      else Deno.env.set(k, v);
    }
  };
  return run().finally(done);
}

const PROPERTY: MarketingImagePropertyContext = {
  name: 'Azure North 1204',
  type: 'CONDO',
  city: 'San Fernando',
  residenceName: 'Azure North',
  maxGuests: 4,
  amenities: ['pool', 'gym', 'lounge'],
  brandColor: '#24a88e',
};

/** Keys travel in the x-goog-api-key header (never the URL). */
function apiKeyOf(init?: RequestInit): string | undefined {
  return (init?.headers as Record<string, string> | undefined)?.['x-goog-api-key'];
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.test('resolvePlatformIntent: known aspect ratios get specific framing', () => {
  assertMatch(resolvePlatformIntent('1:1').framing, /feed post/i);
  assertMatch(resolvePlatformIntent('9:16').framing, /story|reel/i);
  assertMatch(resolvePlatformIntent('16:9').framing, /landscape/i);
});

Deno.test('resolvePlatformIntent: unknown aspect ratio falls back to a generic framing', () => {
  const result = resolvePlatformIntent('7:3');
  assertEquals(typeof result.framing, 'string');
  assertMatch(result.framing, /social media/i);
});

Deno.test(
  'buildStructuredImagePrompt: always includes the host prompt and platform framing',
  () => {
    const prompt = buildStructuredImagePrompt({
      prompt: 'bright living room',
      aspectRatio: '1:1',
      property: null,
    });
    assertMatch(prompt, /bright living room/);
    assertMatch(prompt, /feed post/i);
  }
);

Deno.test('buildStructuredImagePrompt: includes property context when provided', () => {
  const prompt = buildStructuredImagePrompt({
    prompt: 'bright living room',
    aspectRatio: '1:1',
    property: PROPERTY,
  });
  assertMatch(prompt, /Azure North 1204/);
  assertMatch(prompt, /Azure North/);
  assertMatch(prompt, /San Fernando/);
  assertMatch(prompt, /pool/);
  assertMatch(prompt, /#24a88e/);
  assertMatch(prompt, /palette hint/i);
});

Deno.test(
  'amenitiesFromPropertySettings: resolves enabled amenity ids and ignores the unused amenities key',
  () => {
    const labels = amenitiesFromPropertySettings({
      amenities: ['pool'],
      enabledAmenities: ['pool', 'wifi', 'custom-1'],
      customAmenities: [{ id: 'custom-1', name: 'Rooftop deck' }],
    });
    assertEquals(labels, ['Swimming Pool', 'WiFi', 'Rooftop deck']);
  }
);

Deno.test('amenitiesFromPropertySettings: empty or malformed settings yield no amenities', () => {
  assertEquals(amenitiesFromPropertySettings(null), []);
  assertEquals(amenitiesFromPropertySettings({ amenities: ['pool'] }), []);
  assertEquals(
    amenitiesFromPropertySettings({
      enabledAmenities: ['pool'],
      customAmenities: [{ id: 'x' }],
    }),
    ['Swimming Pool']
  );
});

Deno.test(
  'buildStructuredImagePrompt: omits the property line when there is nothing useful to say',
  () => {
    const empty: MarketingImagePropertyContext = {
      name: '',
      type: null,
      city: null,
      residenceName: null,
      maxGuests: null,
      amenities: [],
      brandColor: null,
    };
    const prompt = buildStructuredImagePrompt({
      prompt: 'bright living room',
      aspectRatio: '1:1',
      property: empty,
    });
    assertEquals(prompt.includes('Property context'), false);
  }
);

Deno.test('enhanceMarketingImagePrompt: no configured keys falls back without throwing', () =>
  withEnv({ GEMINI_API_KEY: undefined, GEMINI_API_KEYS: undefined }, async () => {
    const result = await enhanceMarketingImagePrompt({
      organizationId: 'org-1',
      propertyId: 'prop-1',
      prompt: 'bright living room',
      aspectRatio: '1:1',
      property: PROPERTY,
      hasReferenceImages: false,
    });
    assertEquals(result.enhanced, false);
    assertMatch(result.prompt, /bright living room/);
  })
);

Deno.test('enhanceMarketingImagePrompt: uses the model output on a clean response', () =>
  withEnv({ GEMINI_API_KEY: 'test-key', GEMINI_API_KEYS: undefined }, async () => {
    globalThis.fetch = (() =>
      Promise.resolve(
        jsonResponse({
          candidates: [
            {
              content: {
                parts: [{ text: 'A photorealistic wide shot of a sunlit condo living room.' }],
              },
            },
          ],
          usageMetadata: { promptTokenCount: 80, candidatesTokenCount: 40 },
        })
      )) as typeof fetch;

    try {
      const result = await enhanceMarketingImagePrompt({
        organizationId: 'org-1',
        propertyId: 'prop-1',
        prompt: 'bright living room',
        aspectRatio: '1:1',
        property: PROPERTY,
        hasReferenceImages: false,
      });
      assertEquals(result.enhanced, true);
      assertMatch(result.prompt, /photorealistic/i);
    } finally {
      restoreFetch();
    }
  })
);

Deno.test(
  'enhanceMarketingImagePrompt: fail-open on a network error — never throws, falls back to the structured prompt',
  () =>
    withEnv({ GEMINI_API_KEY: 'test-key', GEMINI_API_KEYS: undefined }, async () => {
      globalThis.fetch = (() => Promise.reject(new Error('network down'))) as typeof fetch;

      try {
        const result = await enhanceMarketingImagePrompt({
          organizationId: 'org-1',
          propertyId: 'prop-1',
          prompt: 'bright living room',
          aspectRatio: '1:1',
          property: PROPERTY,
          hasReferenceImages: false,
        });
        assertEquals(result.enhanced, false);
        assertMatch(result.prompt, /bright living room/);
      } finally {
        restoreFetch();
      }
    })
);

Deno.test('enhanceMarketingImagePrompt: fail-open on a non-ok provider response', () =>
  withEnv({ GEMINI_API_KEY: 'test-key', GEMINI_API_KEYS: undefined }, async () => {
    globalThis.fetch = (() =>
      Promise.resolve(jsonResponse({ error: 'nope' }, 500))) as typeof fetch;

    try {
      const result = await enhanceMarketingImagePrompt({
        organizationId: 'org-1',
        propertyId: 'prop-1',
        prompt: 'bright living room',
        aspectRatio: '1:1',
        property: PROPERTY,
        hasReferenceImages: false,
      });
      assertEquals(result.enhanced, false);
    } finally {
      restoreFetch();
    }
  })
);

Deno.test('enhanceMarketingImagePrompt: fail-open when the model returns no usable text', () =>
  withEnv({ GEMINI_API_KEY: 'test-key', GEMINI_API_KEYS: undefined }, async () => {
    globalThis.fetch = (() =>
      Promise.resolve(jsonResponse({ candidates: [{ content: { parts: [] } }] }))) as typeof fetch;

    try {
      const result = await enhanceMarketingImagePrompt({
        organizationId: 'org-1',
        propertyId: 'prop-1',
        prompt: 'bright living room',
        aspectRatio: '1:1',
        property: PROPERTY,
        hasReferenceImages: false,
      });
      assertEquals(result.enhanced, false);
      assertMatch(result.prompt, /bright living room/);
    } finally {
      restoreFetch();
    }
  })
);

/**
 * Regression test for a real bug caught by live-key testing: the per-attempt
 * AbortController/timeout used to be created ONCE, outside the key-rotation loop,
 * so once that single shared deadline fired (even mid-request on an earlier key),
 * every subsequent `fetch` in the loop saw an already-aborted signal and failed
 * instantly — a single dead or slow key could starve every valid key behind it of
 * a genuine attempt. This proves rotation continues past a failing first key to a
 * working second one.
 */
Deno.test(
  'enhanceMarketingImagePrompt: rotates past a failing first key to a working second key',
  () =>
    withEnv({ GEMINI_API_KEY: undefined, GEMINI_API_KEYS: 'dead-key,good-key' }, async () => {
      resetKeyRotationForTests();
      let call = 0;
      globalThis.fetch = ((_url: string, init?: RequestInit) => {
        call += 1;
        if (apiKeyOf(init) === 'dead-key') {
          // Gemini's real response for a bad key (HTTP 400 API_KEY_INVALID).
          return Promise.resolve(
            jsonResponse({ error: { message: 'API key not valid. Please pass a valid API key.' } }, 400)
          );
        }
        return Promise.resolve(
          jsonResponse({
            candidates: [{ content: { parts: [{ text: 'A photorealistic wide shot.' }] } }],
            usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 20 },
          })
        );
      }) as typeof fetch;

      try {
        const result = await enhanceMarketingImagePrompt({
          organizationId: 'org-1',
          propertyId: 'prop-1',
          prompt: 'bright living room',
          aspectRatio: '1:1',
          property: PROPERTY,
          hasReferenceImages: false,
        });
        assertEquals(call, 2);
        assertEquals(result.enhanced, true);
        assertMatch(result.prompt, /photorealistic/i);
      } finally {
        restoreFetch();
      }
    })
);

/**
 * The other half of the same regression: a key whose fetch throws (not just a
 * non-ok response — e.g. a timeout abort) must not poison the remaining keys in
 * the loop either, since each attempt now owns its own controller.
 */
Deno.test(
  'enhanceMarketingImagePrompt: rotates past a key whose fetch throws to a working second key',
  () =>
    withEnv({ GEMINI_API_KEY: undefined, GEMINI_API_KEYS: 'throwing-key,good-key' }, async () => {
      resetKeyRotationForTests();
      let call = 0;
      globalThis.fetch = ((_url: string, init?: RequestInit) => {
        call += 1;
        if (apiKeyOf(init) === 'throwing-key') {
          return Promise.reject(new Error('The signal has been aborted'));
        }
        return Promise.resolve(
          jsonResponse({
            candidates: [{ content: { parts: [{ text: 'A photorealistic wide shot.' }] } }],
            usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 20 },
          })
        );
      }) as typeof fetch;

      try {
        const result = await enhanceMarketingImagePrompt({
          organizationId: 'org-1',
          propertyId: 'prop-1',
          prompt: 'bright living room',
          aspectRatio: '1:1',
          property: PROPERTY,
          hasReferenceImages: false,
        });
        assertEquals(call, 2);
        assertEquals(result.enhanced, true);
      } finally {
        restoreFetch();
      }
    })
);
