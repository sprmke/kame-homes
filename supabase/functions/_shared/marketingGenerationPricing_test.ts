/**
 * marketingGenerationPricing — credit table + option validation (no Supabase / network).
 * Run: deno test --no-check --allow-env --allow-net supabase/functions/_shared/marketingGenerationPricing_test.ts
 *
 * The credit table is asserted value by value on purpose: it is the number a host is
 * charged, and a silent drift here is invisible until the bill arrives.
 */

import {
  assertEquals,
  assertThrows,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  GenerationOptionError,
  assertValidImageOptions,
  assertValidVideoOptions,
  creditsForUsd,
  estimateGenerationCredits,
} from './marketingGenerationPricing.ts';

Deno.test('image credits per tier and size', () => {
  const image = (tier: 'draft' | 'standard' | 'premium', imageSize: '512px' | '1K' | '2K' | '4K') =>
    estimateGenerationCredits({ mediaType: 'image', tier, imageSize });

  assertEquals(image('draft', '1K'), 34);
  assertEquals(image('standard', '1K'), 45);
  assertEquals(image('standard', '512px'), 45);
  assertEquals(image('standard', '2K'), 151);
  assertEquals(image('standard', '4K'), 151);
  assertEquals(image('premium', '1K'), 134);
  assertEquals(image('premium', '2K'), 240);
  assertEquals(image('premium', '4K'), 240);
});

Deno.test('video credits per tier, resolution and duration', () => {
  const video = (
    tier: 'draft' | 'standard' | 'premium',
    resolution: '720p' | '1080p',
    durationSeconds: 6 | 8
  ) => estimateGenerationCredits({ mediaType: 'video', tier, resolution, durationSeconds });

  assertEquals(video('draft', '720p', 6), 300);
  assertEquals(video('draft', '720p', 8), 400);
  assertEquals(video('draft', '1080p', 6), 480);
  assertEquals(video('draft', '1080p', 8), 640);
  assertEquals(video('standard', '720p', 6), 600);
  assertEquals(video('standard', '720p', 8), 800);
  assertEquals(video('standard', '1080p', 6), 1800);
  assertEquals(video('standard', '1080p', 8), 2400);
  assertEquals(video('premium', '720p', 8), 3200);
});

Deno.test('credits round up and never bill zero for a real cost', () => {
  assertEquals(creditsForUsd(0), 0);
  assertEquals(creditsForUsd(0.0000001), 1);
  assertEquals(creditsForUsd(0.0451), 46);
  assertEquals(creditsForUsd(0.045, 0.0005), 90);
});

Deno.test('image options fall back to the standard defaults', () => {
  const result = assertValidImageOptions({ referenceCount: 0 });
  assertEquals(result.tier, 'standard');
  assertEquals(result.imageSize, '1K');
  assertEquals(result.aspectRatio, '1:1');
  assertEquals(result.config.model, 'gemini-3.1-flash-image');
});

Deno.test('draft image tier is 1K only', () => {
  assertEquals(assertValidImageOptions({ tier: 'draft', referenceCount: 0 }).imageSize, '1K');
  assertThrows(
    () => assertValidImageOptions({ tier: 'draft', imageSize: '2K', referenceCount: 0 }),
    GenerationOptionError
  );
});

Deno.test('reference count is capped per image model', () => {
  assertThrows(
    () => assertValidImageOptions({ tier: 'standard', referenceCount: 11 }),
    GenerationOptionError
  );
  assertThrows(
    () => assertValidImageOptions({ tier: 'premium', referenceCount: 7 }),
    GenerationOptionError
  );
  assertEquals(assertValidImageOptions({ tier: 'draft', referenceCount: 14 }).tier, 'draft');
});

Deno.test('video defaults to a 9:16 8s 720p standard clip', () => {
  const result = assertValidVideoOptions({ referenceCount: 0 });
  assertEquals(result.tier, 'standard');
  assertEquals(result.aspectRatio, '9:16');
  assertEquals(result.resolution, '720p');
  assertEquals(result.durationSeconds, 8);
  assertEquals(result.config.model, 'veo-3.1-fast-generate-preview');
});

Deno.test('video rejects unpublishable lengths and unsupported aspect ratios', () => {
  assertThrows(
    () => assertValidVideoOptions({ durationSeconds: 4, referenceCount: 0 }),
    GenerationOptionError
  );
  assertThrows(
    () => assertValidVideoOptions({ aspectRatio: '1:1', referenceCount: 0 }),
    GenerationOptionError
  );
});
