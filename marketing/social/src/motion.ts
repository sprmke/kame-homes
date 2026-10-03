import type { CSSProperties } from 'react';

import { Easing, interpolate } from 'remotion';

/**
 * Motion grammar (shared with the host showcase film): monotonic ease-outs, no overshoot,
 * elements arrive once and hold still. A still render passes `frame = SETTLED`.
 */
export const SETTLED = 100_000;
export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
export const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);

export function ease(frame: number, a: number, b: number, easing = EASE_OUT): number {
  return interpolate(frame, [a, Math.max(a + 1, b)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing,
  });
}

export function reveal(frame: number, delay = 0, distance = 28, duration = 22): CSSProperties {
  const p = ease(frame, delay, delay + duration);
  if (p >= 1) return {};
  return { opacity: p, transform: `translate3d(0, ${(1 - p) * distance}px, 0)` };
}

export function rise(frame: number, delay = 0, distance = 140, duration = 34): CSSProperties {
  const p = ease(frame, delay, delay + duration);
  if (p >= 1) return {};
  return { opacity: Math.min(1, p * 1.6), transform: `translate3d(0, ${(1 - p) * distance}px, 0)` };
}

export function pop(frame: number, delay = 0, duration = 18): CSSProperties {
  const p = ease(frame, delay, delay + duration);
  if (p >= 1) return {};
  return { opacity: p, transform: `scale(${0.94 + 0.06 * p})` };
}

/** Line mask: wrap in `overflow: hidden`, apply to the inner line. */
export function maskUp(frame: number, delay = 0, duration = 26): CSSProperties {
  const p = ease(frame, delay, delay + duration);
  if (p >= 1) return {};
  return { transform: `translate3d(0, ${(1 - p) * 108}%, 0)` };
}
