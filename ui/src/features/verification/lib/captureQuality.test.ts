import { describe, expect, it } from 'vitest';

import {
  CAPTURE_QUALITY_MESSAGES,
  CAPTURE_QUALITY_THRESHOLDS,
  computeBlurVariance,
  computeEdgeDensity,
  computeGlareRatio,
  scoreCapture,
  toGrayscale,
} from './captureQuality';

function flatGray(width: number, height: number, value: number): Uint8ClampedArray {
  return new Uint8ClampedArray(width * height).fill(value);
}

/**
 * A half-dark / half-bright frame: one strong vertical edge, flat interiors. A 1px
 * checkerboard is a bad fixture here — Sobel cancels it out because every horizontal
 * neighbour is opposite and every diagonal neighbour is identical.
 */
function stepEdge(width: number, height: number): Uint8ClampedArray {
  const gray = new Uint8ClampedArray(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      gray[y * width + x] = x < width / 2 ? 20 : 235;
    }
  }
  return gray;
}

describe('captureQuality', () => {
  it('scores a flat frame as unacceptable', () => {
    const gray = flatGray(40, 40, 128);
    const result = scoreCapture({
      blurVariance: computeBlurVariance(gray, 40, 40),
      glareRatio: computeGlareRatio(gray),
      edgeDensity: computeEdgeDensity(gray, 40, 40),
    });
    expect(result.acceptable).toBe(false);
    expect(result.issues).toContain('no_document');
  });

  it('scores a crisp, high-contrast frame as acceptable', () => {
    const gray = stepEdge(40, 40);
    const result = scoreCapture({
      blurVariance: computeBlurVariance(gray, 40, 40),
      glareRatio: computeGlareRatio(gray),
      edgeDensity: computeEdgeDensity(gray, 40, 40),
    });
    expect(result.acceptable).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('flags glare on a blown-out frame', () => {
    const gray = new Uint8ClampedArray(40 * 40).fill(255);
    expect(computeGlareRatio(gray)).toBeGreaterThan(CAPTURE_QUALITY_THRESHOLDS.maxGlareRatio);
    const result = scoreCapture({
      blurVariance: 200,
      glareRatio: computeGlareRatio(gray),
      edgeDensity: 40,
    });
    expect(result.issues).toContain('glare');
  });

  it('flags blur below the threshold', () => {
    const result = scoreCapture({ blurVariance: 1, glareRatio: 0, edgeDensity: 40 });
    expect(result.issues).toContain('blurry');
  });

  it('never returns a score outside 0..1', () => {
    const high = scoreCapture({ blurVariance: 100_000, glareRatio: 0, edgeDensity: 10_000 });
    const low = scoreCapture({ blurVariance: -10, glareRatio: 5, edgeDensity: -3 });
    expect(high.score).toBeLessThanOrEqual(1);
    expect(low.score).toBeGreaterThanOrEqual(0);
  });

  it('guards against empty or undersized buffers', () => {
    expect(computeBlurVariance(new Uint8ClampedArray(0), 0, 0)).toBe(0);
    expect(computeEdgeDensity(new Uint8ClampedArray(0), 0, 0)).toBe(0);
    expect(computeGlareRatio(new Uint8ClampedArray(0))).toBe(0);
    expect(computeBlurVariance(new Uint8ClampedArray(10), 100, 100)).toBe(0);
  });

  it('converts RGBA to grayscale with standard weights', () => {
    const gray = toGrayscale(Uint8ClampedArray.from([255, 0, 0, 255, 0, 255, 0, 255]));
    expect(gray[0]).toBe(76);
    expect(gray[1]).toBe(150);
  });

  it('has a message for every issue it can report', () => {
    expect(Object.keys(CAPTURE_QUALITY_MESSAGES).sort()).toEqual(['blurry', 'glare', 'no_document']);
  });
});
