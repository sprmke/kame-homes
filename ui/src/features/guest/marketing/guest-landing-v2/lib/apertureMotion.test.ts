import { describe, expect, it } from 'vitest';

import {
  apertureClipPath,
  progressBetween,
} from '@/features/guest/marketing/guest-landing-v2/lib/apertureMotion';

const frame = { top: 400, side: 24, bottom: 24, radius: 28 };

describe('apertureClipPath', () => {
  it('rests as an inset rounded window', () => {
    expect(apertureClipPath(frame, 0)).toBe('inset(400.0px 24.0px 24.0px 24.0px round 28.0px)');
  });

  it('opens to full bleed', () => {
    expect(apertureClipPath(frame, 1)).toBe('inset(0.0px 0.0px 0.0px 0.0px round 0.0px)');
  });

  it('clamps out-of-range progress', () => {
    expect(apertureClipPath(frame, -1)).toBe(apertureClipPath(frame, 0));
    expect(apertureClipPath(frame, 2)).toBe(apertureClipPath(frame, 1));
  });
});

describe('progressBetween', () => {
  it('maps a sub-window of scroll progress to 0..1', () => {
    expect(progressBetween(0.1, 0.2, 0.6)).toBe(0);
    expect(progressBetween(0.4, 0.2, 0.6)).toBeCloseTo(0.5);
    expect(progressBetween(0.9, 0.2, 0.6)).toBe(1);
  });

  it('treats an empty window as a step', () => {
    expect(progressBetween(0.5, 0.5, 0.5)).toBe(1);
    expect(progressBetween(0.4, 0.5, 0.5)).toBe(0);
  });
});
