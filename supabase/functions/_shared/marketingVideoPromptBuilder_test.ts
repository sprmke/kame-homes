/**
 * Deno tests for _shared/marketingVideoPromptBuilder.ts — run with `deno test --allow-env`.
 * Plan: docs/workflow/for-testing/marketing-ai-video-quality.md
 *
 * The guardrail tail is appended in code, never by the LLM: every test that produces a
 * prompt checks it is still there, enhanced or not.
 */

import { assert, assertEquals, assertMatch } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  VIDEO_CAMERA_MOVE_IDS,
  buildStructuredVideoPrompt,
  buildVideoGuardrailTail,
  buildVideoNegativePrompt,
  enhanceMarketingVideoPrompt,
  isVideoCameraMove,
  isVideoSoundMode,
  type VideoPromptInput,
} from './marketingVideoPromptBuilder.ts';
import { resetKeyRotationForTests } from './ai/llmTransport.ts';
import type { MarketingImagePropertyContext } from './marketingImagePromptBuilder.ts';

const realFetch = globalThis.fetch;

function withEnv(vars: Record<string, string | undefined>, run: () => Promise<void>) {
  const prev: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    prev[k] = Deno.env.get(k);
    if (v === undefined) Deno.env.delete(k);
    else Deno.env.set(k, v);
  }
  return run().finally(() => {
    globalThis.fetch = realFetch;
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) Deno.env.delete(k);
      else Deno.env.set(k, v);
    }
  });
}

const GEMINI_ENV = {
  GEMINI_API_KEY: 'test-key',
  GEMINI_API_KEYS: undefined,
  AI_RESPONSE_CACHE_DISABLED: '1',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const PROPERTY: MarketingImagePropertyContext = {
  name: 'Azure North 1204',
  type: 'CONDO',
  city: 'San Fernando',
  residenceName: 'Azure North',
  maxGuests: 4,
  amenities: ['Swimming Pool', 'WiFi'],
  brandColor: '#24a88e',
};

const INPUT: VideoPromptInput = {
  prompt: 'sunny living room',
  cameraMove: 'push-in',
  sound: 'ambient',
  aspectRatio: '9:16',
  property: PROPERTY,
  hasStartFrame: true,
};

const START_FRAME = { mimeType: 'image/jpeg', data: 'aGVsbG8=' };

Deno.test('guards accept only known camera moves and sound modes', () => {
  for (const id of VIDEO_CAMERA_MOVE_IDS) assert(isVideoCameraMove(id));
  assertEquals(isVideoCameraMove('zoom-crash'), false);
  assertEquals(isVideoCameraMove(undefined), false);
  assert(isVideoSoundMode('music'));
  assertEquals(isVideoSoundMode('speech'), false);
});

Deno.test('guardrail tail: start frame keeps the room as photographed and bans speech', () => {
  const tail = buildVideoGuardrailTail(INPUT);
  assertMatch(tail, /Begin exactly on the provided photo/);
  assertMatch(tail, /do not add people/i);
  assertMatch(tail, /No on-screen text/);
  assertMatch(tail, /No speech/);
  assertMatch(tail, /Vertical 9:16/);
});

Deno.test('guardrail tail: text-only and music variants', () => {
  const tail = buildVideoGuardrailTail({
    sound: 'music',
    aspectRatio: '16:9',
    hasStartFrame: false,
  });
  assertEquals(tail.includes('provided photo'), false);
  assertMatch(tail, /instrumental background music/);
  assertMatch(tail, /no lyrics/);
  assertMatch(tail, /Horizontal 16:9/);
});

Deno.test('negative prompt: base list always kept, host words appended, length capped', () => {
  const withFrame = buildVideoNegativePrompt('red sofa', true);
  assertMatch(withFrame, /on-screen text/);
  assertMatch(withFrame, /people, faces/);
  assert(withFrame.endsWith('red sofa'));

  const textOnly = buildVideoNegativePrompt(null, false);
  assertEquals(textOnly.includes('people'), false);

  assert(buildVideoNegativePrompt('x'.repeat(5000), true).length <= 900);
});

Deno.test('structured prompt: camera direction, host request, property, then tail', () => {
  const prompt = buildStructuredVideoPrompt(INPUT);
  assertMatch(prompt, /^Slow, steady dolly push-in/);
  assertMatch(prompt, /provided photo of the space/);
  assertMatch(prompt, /sunny living room\./);
  assertMatch(prompt, /San Fernando/);
  assert(prompt.endsWith(buildVideoGuardrailTail(INPUT)));
});

Deno.test('structured prompt: an oversized request is trimmed but the tail survives', () => {
  const prompt = buildStructuredVideoPrompt({ ...INPUT, prompt: 'wide '.repeat(2000) });
  assert(prompt.length <= 3200);
  assert(prompt.endsWith(buildVideoGuardrailTail(INPUT)));
});

Deno.test('enhance: no configured keys falls back without throwing', () =>
  withEnv({ GEMINI_API_KEY: undefined, GEMINI_API_KEYS: undefined }, async () => {
    const result = await enhanceMarketingVideoPrompt({
      ...INPUT,
      organizationId: 'org-1',
      propertyId: 'prop-1',
    });
    assertEquals(result.enhanced, false);
    assertEquals(result.prompt, buildStructuredVideoPrompt(INPUT));
  })
);

Deno.test('enhance: sends the start frame to the model and appends the tail', () =>
  withEnv(GEMINI_ENV, async () => {
    resetKeyRotationForTests();
    const sentBodies: string[] = [];
    globalThis.fetch = ((url: string, init?: RequestInit) => {
      if (String(url).includes(':generateContent')) sentBodies.push(String(init?.body));
      return Promise.resolve(
        jsonResponse({
          candidates: [
            {
              content: {
                parts: [{ text: 'The camera glides toward a sunlit sofa as curtains stir.' }],
              },
            },
          ],
          usageMetadata: { promptTokenCount: 300, candidatesTokenCount: 40 },
        })
      );
    }) as typeof fetch;

    const result = await enhanceMarketingVideoPrompt({
      ...INPUT,
      organizationId: 'org-1',
      propertyId: 'prop-1',
      startFrame: START_FRAME,
    });

    assertEquals(result.enhanced, true);
    assertMatch(result.prompt, /^The camera glides toward a sunlit sofa/);
    assert(result.prompt.endsWith(buildVideoGuardrailTail(INPUT)));

    assertEquals(sentBodies.length, 1);
    const parts = JSON.stringify(JSON.parse(sentBodies[0]!).contents);
    assertMatch(parts, /"inlineData":\{"mimeType":"image\/jpeg","data":"aGVsbG8="\}/);
    assertMatch(parts, /sunny living room/);
  })
);

Deno.test('enhance: fail-open on a network error', () =>
  withEnv(GEMINI_ENV, async () => {
    resetKeyRotationForTests();
    globalThis.fetch = (() => Promise.reject(new Error('network down'))) as typeof fetch;
    const result = await enhanceMarketingVideoPrompt({
      ...INPUT,
      organizationId: 'org-1',
      propertyId: 'prop-1',
      startFrame: START_FRAME,
    });
    assertEquals(result.enhanced, false);
    assertEquals(result.prompt, buildStructuredVideoPrompt(INPUT));
  })
);

Deno.test('enhance: fail-open when the model returns no text', () =>
  withEnv(GEMINI_ENV, async () => {
    resetKeyRotationForTests();
    globalThis.fetch = (() =>
      Promise.resolve(jsonResponse({ candidates: [{ content: { parts: [] } }] }))) as typeof fetch;
    const result = await enhanceMarketingVideoPrompt({
      ...INPUT,
      organizationId: 'org-1',
      propertyId: 'prop-1',
    });
    assertEquals(result.enhanced, false);
    assert(result.prompt.endsWith(buildVideoGuardrailTail(INPUT)));
  })
);
