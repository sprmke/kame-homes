import { describe, expect, it } from 'vitest';

import {
  adjustFilter,
  cropInnerStyle,
  cropVisible,
  ctaReveal,
  fadedVolume,
  isRenderableMediaUrl,
  layerMotion,
  overlayAspect,
  overlayBoxStyle,
  revealText,
} from '@/features/dashboard/marketing/lib/video/v2/clipStyles';

const base = {
  fps: 30,
  durationInFrames: 90,
  templateEnter: 1,
  templateOffsetX: 0,
  templateOffsetY: 24,
  travel: 60,
};

describe('crop and overlay boxes', () => {
  it('shows the whole element without a crop', () => {
    expect(cropVisible(undefined)).toEqual({ w: 1, h: 1 });
    expect(cropInnerStyle(undefined)).toMatchObject({ width: '100%', height: '100%' });
  });

  it('scales and shifts the inner element so crop edges line up', () => {
    const style = cropInnerStyle({ left: 0.1, right: 0.1, top: 0.25, bottom: 0.25 });
    expect(style.width).toBe(`${100 / 0.8}%`);
    expect(style.height).toBe('200%');
    expect(style.left).toBe(`${(-0.1 / 0.8) * 100}%`);
    expect(style.top).toBe('-50%');
  });

  it('never divides by zero for extreme crops', () => {
    expect(cropVisible({ left: 0.9, right: 0.9, top: 0, bottom: 0 }).w).toBeGreaterThan(0);
  });

  it('derives overlay aspect from source size and crop, with a 16:9 fallback', () => {
    expect(overlayAspect({ media: { url: 'u', source: 'library' } })).toBeCloseTo(16 / 9);
    expect(
      overlayAspect({ media: { url: 'u', source: 'library', width: 1000, height: 500 } })
    ).toBe(2);
    expect(
      overlayAspect({
        media: { url: 'u', source: 'library', width: 1000, height: 1000 },
        crop: { left: 0.25, right: 0.25, top: 0, bottom: 0 },
      })
    ).toBeCloseTo(0.5);
  });

  it('positions an overlay by its center with rotation and opacity', () => {
    const css = overlayBoxStyle({ x: 30, y: 70, widthPct: 40, rotation: 12, opacity: 0.5 }, 1.5);
    expect(css).toMatchObject({
      left: '30%',
      top: '70%',
      width: '40%',
      opacity: 0.5,
      aspectRatio: '1.5',
    });
    expect(css.transform).toBe('translate(-50%, -50%) rotate(12deg)');
    expect(
      overlayBoxStyle({ x: 0, y: 0, widthPct: 10, rotation: 0, opacity: 1 }, 0).aspectRatio
    ).toBe(String(16 / 9));
  });

  it('builds a filter only for changed adjustments', () => {
    expect(adjustFilter(undefined)).toBeUndefined();
    expect(adjustFilter({ brightness: 1, contrast: 1, saturation: 1 })).toBeUndefined();
    expect(adjustFilter({ brightness: 1.2, contrast: 1, saturation: 0.5 })).toBe(
      'brightness(1.2) saturate(0.5)'
    );
  });
});

describe('fadedVolume', () => {
  it('ramps in and out and stays within 0..base', () => {
    expect(fadedVolume(0, 100, 0.8, 10, 10)).toBe(0);
    expect(fadedVolume(5, 100, 0.8, 10, 10)).toBeCloseTo(0.4);
    expect(fadedVolume(50, 100, 0.8, 10, 10)).toBeCloseTo(0.8);
    expect(fadedVolume(95, 100, 0.8, 10, 10)).toBeCloseTo(0.4);
    expect(fadedVolume(100, 100, 0.8, 10, 10)).toBe(0);
    expect(fadedVolume(50, 100, 5)).toBe(1);
    expect(fadedVolume(50, 100, -1)).toBe(0);
  });

  it('handles overlapping fades without exceeding the clip', () => {
    const v = fadedVolume(5, 10, 1, 10, 10);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(1);
  });
});

describe('layerMotion', () => {
  it('template entrance follows the spring offsets', () => {
    const m = layerMotion({
      ...base,
      frame: 0,
      templateEnter: 0,
      animationIn: { type: 'template', durationInFrames: 0 },
    });
    expect(m.translateY).toBe(24);
    const settled = layerMotion({
      ...base,
      frame: 40,
      animationIn: { type: 'template', durationInFrames: 0 },
    });
    expect(settled).toMatchObject({ translateY: 0, opacity: 1, scale: 1 });
  });

  it('fade in/out', () => {
    const anim = {
      animationIn: { type: 'fade' as const, durationInFrames: 10 },
      animationOut: { type: 'fade' as const, durationInFrames: 10 },
    };
    expect(layerMotion({ ...base, ...anim, frame: 0 }).opacity).toBe(0);
    expect(layerMotion({ ...base, ...anim, frame: 5 }).opacity).toBeCloseTo(0.5);
    expect(layerMotion({ ...base, ...anim, frame: 45 }).opacity).toBe(1);
    expect(layerMotion({ ...base, ...anim, frame: 85 }).opacity).toBeCloseTo(0.5);
    expect(layerMotion({ ...base, ...anim, frame: 90 }).opacity).toBe(0);
  });

  it('slide-up, rise and pop settle to neutral', () => {
    for (const type of ['slide-up', 'rise', 'pop'] as const) {
      const start = layerMotion({ ...base, frame: 0, animationIn: { type, durationInFrames: 12 } });
      const end = layerMotion({ ...base, frame: 30, animationIn: { type, durationInFrames: 12 } });
      expect(end).toMatchObject({ translateY: 0, scale: 1, opacity: 1 });
      expect(start.opacity < 1 || start.translateY > 0 || start.scale < 1).toBe(true);
    }
  });

  it('typewriter reveals progressively and hides on exit', () => {
    const m = (frame: number) =>
      layerMotion({
        ...base,
        frame,
        animationIn: { type: 'typewriter', durationInFrames: 20 },
        animationOut: { type: 'typewriter', durationInFrames: 20 },
      });
    expect(m(0).reveal).toBe(0);
    expect(m(10).reveal).toBe(0.5);
    expect(m(40).reveal).toBe(1);
    expect(m(80).reveal).toBe(0.5);
  });

  it('is neutral with no animations and tolerates zero durations', () => {
    expect(layerMotion({ ...base, frame: 3 })).toEqual({
      opacity: 1,
      translateX: 0,
      translateY: 0,
      scale: 1,
      reveal: 1,
    });
    const zero = layerMotion({
      ...base,
      frame: 0,
      animationIn: { type: 'fade', durationInFrames: 0 },
    });
    expect(Number.isFinite(zero.opacity)).toBe(true);
  });
});

describe('small helpers', () => {
  it('reveals text by grapheme-safe slices', () => {
    expect(revealText('Hello', 0)).toBe('');
    expect(revealText('Hello', 0.4)).toBe('He');
    expect(revealText('Hello', 1)).toBe('Hello');
    expect(revealText('😀😀😀😀', 0.5)).toBe('😀😀');
  });

  it('ramps CTA reveal', () => {
    expect(ctaReveal(0, 12)).toBe(0);
    expect(ctaReveal(6, 12)).toBe(0.5);
    expect(ctaReveal(30, 12)).toBe(1);
    expect(ctaReveal(0, 0)).toBe(1);
  });

  it('accepts only renderable media URLs', () => {
    expect(isRenderableMediaUrl('https://x/y.jpg')).toBe(true);
    expect(isRenderableMediaUrl('data:image/png;base64,AA')).toBe(true);
    expect(isRenderableMediaUrl('blob:abc')).toBe(true);
    expect(isRenderableMediaUrl('')).toBe(false);
    expect(isRenderableMediaUrl('  ')).toBe(false);
    expect(isRenderableMediaUrl(null)).toBe(false);
    expect(isRenderableMediaUrl('javascript:alert(1)')).toBe(false);
    expect(isRenderableMediaUrl('/relative.jpg')).toBe(false);
  });
});
