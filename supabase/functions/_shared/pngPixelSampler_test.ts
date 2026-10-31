/**
 * Deno tests for _shared/pngPixelSampler.ts — run with `deno test --allow-env`.
 * Plan: docs/workflow/in-progress/marketing-ai-image-quality-hardening.md (Phase 4b)
 *
 * Test PNGs are built in-test (via `pngTestFixtures.ts`) with known pixel content,
 * so every assertion is against ground truth, not another decoder's output.
 */

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { samplePngLuminanceVariance } from './pngPixelSampler.ts';
import { buildRgbPng } from './pngTestFixtures.ts';

Deno.test('samplePngLuminanceVariance: solid color has zero variance', async () => {
  const png = await buildRgbPng(64, 64, () => [128, 128, 128]);
  const result = await samplePngLuminanceVariance(png);
  assert(result.supported);
  assertEquals(result.variance, 0);
  assertEquals(Math.round(result.meanLuminance), 128);
});

Deno.test('samplePngLuminanceVariance: pure black reports mean luminance 0', async () => {
  const png = await buildRgbPng(32, 32, () => [0, 0, 0]);
  const result = await samplePngLuminanceVariance(png);
  assert(result.supported);
  assertEquals(result.variance, 0);
  assertEquals(result.meanLuminance, 0);
});

Deno.test('samplePngLuminanceVariance: checkerboard has high variance', async () => {
  const png = await buildRgbPng(64, 64, (x, y) => {
    const on = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0;
    return on ? [240, 240, 240] : [10, 10, 10];
  });
  const result = await samplePngLuminanceVariance(png);
  assert(result.supported);
  assert(result.variance > 1000, `expected high variance, got ${result.variance}`);
});

Deno.test('samplePngLuminanceVariance: solid vs checkerboard variance ordering', async () => {
  const solid = await samplePngLuminanceVariance(await buildRgbPng(48, 48, () => [90, 90, 90]));
  const varied = await samplePngLuminanceVariance(
    await buildRgbPng(48, 48, (x, y) => [
      (x * 37 + y * 91) % 256,
      (x * 13 + y * 5) % 256,
      (x * 71) % 256,
    ])
  );
  assert(solid.supported && varied.supported);
  assert(varied.variance > solid.variance);
});

Deno.test('samplePngLuminanceVariance: non-PNG bytes are unsupported, not thrown', async () => {
  const result = await samplePngLuminanceVariance(new Uint8Array([1, 2, 3, 4, 5]));
  assertEquals(result.supported, false);
});

Deno.test('samplePngLuminanceVariance: truncated PNG is unsupported, not thrown', async () => {
  const png = await buildRgbPng(16, 16, () => [50, 50, 50]);
  const truncated = png.slice(0, 20);
  const result = await samplePngLuminanceVariance(truncated);
  assertEquals(result.supported, false);
});

Deno.test('samplePngLuminanceVariance: empty input is unsupported, not thrown', async () => {
  const result = await samplePngLuminanceVariance(new Uint8Array(0));
  assertEquals(result.supported, false);
});

Deno.test('samplePngLuminanceVariance: a 1x1 pixel PNG is still readable', async () => {
  const png = await buildRgbPng(1, 1, () => [200, 100, 50]);
  const result = await samplePngLuminanceVariance(png);
  assert(result.supported);
  assertEquals(result.variance, 0); // one sample point, no variance possible
});
