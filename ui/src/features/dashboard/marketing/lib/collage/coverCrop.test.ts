import { describe, expect, it } from 'vitest';

import { coverCropForFrame } from '@/features/dashboard/marketing/lib/collage/coverCrop';

describe('coverCropForFrame', () => {
  it('returns the full frame when the source already matches the frame aspect', () => {
    expect(coverCropForFrame(1000, 1000, 1, 1)).toEqual({
      cropX: 0,
      cropY: 0,
      cropWidth: 1,
      cropHeight: 1,
    });
    expect(coverCropForFrame(1600, 900, 16, 9)).toEqual({
      cropX: 0,
      cropY: 0,
      cropWidth: 1,
      cropHeight: 1,
    });
  });

  it('crops the left/right edges for a landscape photo in a square frame', () => {
    const crop = coverCropForFrame(2000, 1000, 1, 1);
    expect(crop.cropY).toBe(0);
    expect(crop.cropHeight).toBe(1);
    expect(crop.cropWidth).toBeCloseTo(0.5, 5);
    expect(crop.cropX).toBeCloseTo(0.25, 5);
    // Symmetric around the center.
    expect(crop.cropX * 2 + crop.cropWidth).toBeCloseTo(1, 5);
  });

  it('crops the top/bottom edges for a portrait photo in a square frame', () => {
    const crop = coverCropForFrame(1000, 2000, 1, 1);
    expect(crop.cropX).toBe(0);
    expect(crop.cropWidth).toBe(1);
    expect(crop.cropHeight).toBeCloseTo(0.5, 5);
    expect(crop.cropY).toBeCloseTo(0.25, 5);
  });

  it('crops a square photo placed in a landscape frame', () => {
    const crop = coverCropForFrame(1000, 1000, 2, 1);
    expect(crop.cropX).toBe(0);
    expect(crop.cropWidth).toBe(1);
    expect(crop.cropHeight).toBeCloseTo(0.5, 5);
    expect(crop.cropY).toBeCloseTo(0.25, 5);
  });

  it('crops a square photo placed in a portrait frame', () => {
    const crop = coverCropForFrame(1000, 1000, 1, 2);
    expect(crop.cropY).toBe(0);
    expect(crop.cropHeight).toBe(1);
    expect(crop.cropWidth).toBeCloseTo(0.5, 5);
    expect(crop.cropX).toBeCloseTo(0.25, 5);
  });

  it('falls back to the full frame for degenerate (zero/negative) input', () => {
    expect(coverCropForFrame(0, 100, 1, 1)).toEqual({
      cropX: 0,
      cropY: 0,
      cropWidth: 1,
      cropHeight: 1,
    });
    expect(coverCropForFrame(100, 0, 1, 1)).toEqual({
      cropX: 0,
      cropY: 0,
      cropWidth: 1,
      cropHeight: 1,
    });
    expect(coverCropForFrame(100, 100, 0, 1)).toEqual({
      cropX: 0,
      cropY: 0,
      cropWidth: 1,
      cropHeight: 1,
    });
  });

  it('matches the legacy square-only helper for a 1x1 frame', () => {
    // orgLogoCircle.squareImageCoverCrop(w, h) === coverCropForFrame(w, h, 1, 1)
    const wide = coverCropForFrame(1600, 1000, 1, 1);
    expect(wide.cropWidth).toBeCloseTo(1000 / 1600, 5);
    expect(wide.cropX).toBeCloseTo((1 - 1000 / 1600) / 2, 5);
  });
});
