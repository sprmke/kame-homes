import { describe, expect, it } from 'vitest';

import { savedThumbnailPixelRatio } from '@/features/dashboard/marketing/lib/marketingThumbSizing';

describe('savedThumbnailPixelRatio', () => {
  it('scales the long edge to 480px', () => {
    expect(savedThumbnailPixelRatio(1080, 1920) * 1920).toBeCloseTo(480);
    expect(savedThumbnailPixelRatio(1920, 1080) * 1920).toBeCloseTo(480);
    expect(savedThumbnailPixelRatio(1080, 1080) * 1080).toBeCloseTo(480);
  });

  it('never upscales and never collapses', () => {
    expect(savedThumbnailPixelRatio(300, 200)).toBe(1);
    expect(savedThumbnailPixelRatio(0, 0)).toBe(1);
    expect(savedThumbnailPixelRatio(100000, 100)).toBe(0.05);
  });
});
