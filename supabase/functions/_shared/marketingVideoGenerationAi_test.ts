/**
 * Deno tests for the Veo request body in _shared/marketingVideoGenerationAi.ts.
 *
 * Each assertion matches a constraint the live API enforced on 2026-10-01 that the
 * docs' REST samples get wrong. A regression here fails every video request.
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { buildVeoRequestBody } from './marketingVideoGenerationAi.ts';

const BASE = {
  prompt: 'A slow push-in.',
  aspectRatio: '9:16',
  resolution: '1080p' as const,
  durationSeconds: 8,
};

Deno.test('image-to-video: bytesBase64Encoded image, numeric duration, allow_adult', () => {
  const body = buildVeoRequestBody({
    ...BASE,
    negativePrompt: 'watermark',
    startFrame: { mimeType: 'image/jpeg', data: 'aGVsbG8=' },
  });
  assertEquals(body, {
    instances: [
      {
        prompt: 'A slow push-in.',
        image: { bytesBase64Encoded: 'aGVsbG8=', mimeType: 'image/jpeg' },
      },
    ],
    parameters: {
      aspectRatio: '9:16',
      resolution: '1080p',
      durationSeconds: 8,
      personGeneration: 'allow_adult',
      negativePrompt: 'watermark',
    },
  });
});

Deno.test('text-to-video: no image, allow_all, no empty negativePrompt', () => {
  const body = buildVeoRequestBody({ ...BASE, negativePrompt: null, startFrame: null });
  assertEquals(body.instances[0], { prompt: 'A slow push-in.' });
  assertEquals(body.parameters.personGeneration, 'allow_all');
  assertEquals('negativePrompt' in body.parameters, false);
  assertEquals(typeof body.parameters.durationSeconds, 'number');
});
