import { describe, expect, it } from 'vitest';

import {
  extensionForMime,
  headerHasAlpha,
  indexOfAscii,
  isProbablyAnimated,
  normalizeMime,
  planOptimization,
  PRESET_CONFIGS,
  renameExtension,
  type PlanInput,
} from './imageOptimizationPlan';

const base: PlanInput = {
  preset: 'PHOTO_MASTER',
  mime: 'image/jpeg',
  sizeBytes: 6 * 1024 * 1024,
  sourceLongEdge: 6000,
  hasAlpha: false,
  animated: false,
};

describe('planOptimization', () => {
  it('kill switch → passthrough disabled', () => {
    expect(planOptimization({ ...base, disabled: true })).toEqual({
      action: 'passthrough',
      reason: 'disabled',
    });
  });

  it('NONE preset → passthrough', () => {
    expect(planOptimization({ ...base, preset: 'NONE' }).action).toBe('passthrough');
  });

  it('non-image / svg / gif → passthrough nonimage', () => {
    for (const mime of ['application/pdf', 'image/svg+xml', 'image/gif']) {
      expect(planOptimization({ ...base, mime }).action).toBe('passthrough');
      expect(planOptimization({ ...base, mime })).toMatchObject({ reason: 'nonimage' });
    }
  });

  it('animated → passthrough animated', () => {
    expect(planOptimization({ ...base, animated: true })).toMatchObject({ reason: 'animated' });
  });

  it('undecodable source → decode-failed', () => {
    expect(planOptimization({ ...base, sourceLongEdge: null }).action).toBe('decode-failed');
    expect(planOptimization({ ...base, sourceLongEdge: 0 }).action).toBe('decode-failed');
  });

  it('downscales a big photo to the preset long edge and converts to webp', () => {
    const plan = planOptimization(base);
    expect(plan).toMatchObject({
      action: 'reencode',
      targetLongEdge: PRESET_CONFIGS.PHOTO_MASTER.maxLongEdge,
      fileType: 'image/webp',
      extension: '.webp',
      quality: PRESET_CONFIGS.PHOTO_MASTER.quality,
    });
  });

  it('never upscales: target is clamped to the source long edge', () => {
    const plan = planOptimization({ ...base, sourceLongEdge: 1200, sizeBytes: 2 * 1024 * 1024 });
    // 1200 < maxLongEdge, still re-encoded (2MB > alreadyGoodBytes) but not upscaled
    expect(plan).toMatchObject({ action: 'reencode', targetLongEdge: 1200 });
  });

  it('skips an already small, already right-sized image', () => {
    const plan = planOptimization({
      ...base,
      sourceLongEdge: 1500,
      sizeBytes: 200 * 1024,
    });
    expect(plan).toEqual({ action: 'passthrough', reason: 'skipped' });
  });

  it('DOCUMENT within ceiling + dimensions → passthrough untouched', () => {
    const plan = planOptimization({
      preset: 'DOCUMENT',
      mime: 'image/jpeg',
      sizeBytes: 7 * 1024 * 1024,
      sourceLongEdge: 2800,
      hasAlpha: false,
      animated: false,
    });
    expect(plan).toEqual({ action: 'passthrough', reason: 'skipped' });
  });

  it('DOCUMENT over the dimension cap → re-encode, keeping source format', () => {
    const plan = planOptimization({
      preset: 'DOCUMENT',
      mime: 'image/png',
      sizeBytes: 4 * 1024 * 1024,
      sourceLongEdge: 5200,
      hasAlpha: true,
      animated: false,
    });
    expect(plan).toMatchObject({
      action: 'reencode',
      targetLongEdge: PRESET_CONFIGS.DOCUMENT.maxLongEdge,
      fileType: 'image/png',
      extension: '.png',
    });
  });

  it('DOCUMENT over the byte ceiling → re-encode even if dimensions are fine', () => {
    const plan = planOptimization({
      preset: 'DOCUMENT',
      mime: 'image/jpeg',
      sizeBytes: 13 * 1024 * 1024,
      sourceLongEdge: 2000,
      hasAlpha: false,
      animated: false,
    });
    expect(plan).toMatchObject({
      action: 'reencode',
      targetLongEdge: 2000,
      fileType: 'image/jpeg',
    });
  });

  it('AVATAR with alpha keeps PNG (lossless), without alpha → webp', () => {
    const withAlpha = planOptimization({
      ...base,
      preset: 'AVATAR',
      mime: 'image/png',
      hasAlpha: true,
      sourceLongEdge: 1024,
      sizeBytes: 500 * 1024,
    });
    expect(withAlpha).toMatchObject({ fileType: 'image/png', quality: undefined });

    const noAlpha = planOptimization({
      ...base,
      preset: 'AVATAR',
      mime: 'image/png',
      hasAlpha: false,
      sourceLongEdge: 1024,
      sizeBytes: 500 * 1024,
    });
    expect(noAlpha).toMatchObject({
      fileType: 'image/webp',
      quality: PRESET_CONFIGS.AVATAR.quality,
    });
  });
});

describe('renameExtension', () => {
  it('swaps the final extension', () => {
    expect(renameExtension('photo.png', '.webp')).toBe('photo.webp');
    expect(renameExtension('IMG_1234.JPEG', '.webp')).toBe('IMG_1234.webp');
    expect(renameExtension('no-ext', '.webp')).toBe('no-ext.webp');
    expect(renameExtension('archive.tar.gz', '.webp')).toBe('archive.tar.webp');
  });

  it('preserves a leading path and dotfiles', () => {
    expect(renameExtension('a/b/photo.png', '.webp')).toBe('a/b/photo.webp');
    expect(renameExtension('.gitignore', '.webp')).toBe('.gitignore.webp');
    expect(renameExtension('', '.webp')).toBe('image.webp');
  });
});

describe('header sniffing', () => {
  it('normalizeMime folds image/jpg', () => {
    expect(normalizeMime('IMAGE/JPG')).toBe('image/jpeg');
  });

  it('extensionForMime', () => {
    expect(extensionForMime('image/webp')).toBe('.webp');
    expect(extensionForMime('image/jpeg')).toBe('.jpg');
    expect(extensionForMime('image/heic')).toBe('.heic');
  });

  it('indexOfAscii finds a marker', () => {
    const bytes = new Uint8Array([0, 1, 2, 65, 66, 67, 68]); // "ABCD" at 3
    expect(indexOfAscii(bytes, 'ABCD', 0)).toBe(3);
    expect(indexOfAscii(bytes, 'ZZ', 0)).toBe(-1);
  });

  it('detects a PNG alpha colour type', () => {
    const png = new Uint8Array(30);
    png[25] = 6; // RGBA
    expect(headerHasAlpha('image/png', png)).toBe(true);
    png[25] = 2; // RGB
    expect(headerHasAlpha('image/png', png)).toBe(false);
    expect(headerHasAlpha('image/jpeg', png)).toBe(false);
  });

  it('detects APNG (acTL) and animated WebP (ANIM)', () => {
    const apng = new Uint8Array([...new Array(20).fill(0), ...toBytes('acTL')]);
    expect(isProbablyAnimated('image/png', apng)).toBe(true);

    const webp = new Uint8Array([...new Array(20).fill(0), ...toBytes('ANIM')]);
    expect(isProbablyAnimated('image/webp', webp)).toBe(true);

    expect(isProbablyAnimated('image/png', new Uint8Array(64))).toBe(false);
  });
});

function toBytes(s: string): number[] {
  return [...s].map((c) => c.charCodeAt(0));
}
