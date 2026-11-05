import type { Transition, Variants } from 'framer-motion';

/** One exponential ease-out for every v2 reveal, so the page moves as one system. */
export const EASE_OUT: Transition['ease'] = [0.16, 1, 0.3, 1];

/** Play once, as soon as a sliver of the block is on screen. */
export const inViewOnce = { once: true, amount: 0.2 } as const;

/** Copy rises into place. Visible by default when motion is reduced (callers pass `initial={false}`). */
export const rise: Variants = {
  hidden: { opacity: 0, y: 18 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE_OUT } },
};

export const riseStagger: Variants = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};

/**
 * The page's one authored motion: an aperture opening. Media enters as a smaller rounded
 * window and widens to its full frame, the same gesture the hero makes on scroll.
 */
export const apertureOpen: Variants = {
  hidden: { clipPath: 'inset(9% 9% 9% 9% round 28px)', scale: 1.06 },
  shown: {
    clipPath: 'inset(0% 0% 0% 0% round 0px)',
    scale: 1,
    transition: { duration: 1.1, ease: EASE_OUT },
  },
};

/** Linear interpolation clamped to the 0..1 progress window `[from, to]`. */
export function progressBetween(progress: number, from: number, to: number): number {
  if (to <= from) return progress >= to ? 1 : 0;
  return Math.min(1, Math.max(0, (progress - from) / (to - from)));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export type ApertureFrame = {
  /** Distance from the stage top to the window's top edge at rest (px). */
  top: number;
  /** Side and bottom gutters at rest (px). */
  side: number;
  bottom: number;
  radius: number;
};

/**
 * `clip-path` for the hero window at a given open amount (0 = resting window, 1 = full bleed).
 * Kept pure so the geometry is unit tested and the component only feeds it scroll progress.
 */
export function apertureClipPath(frame: ApertureFrame, open: number): string {
  const t = Math.min(1, Math.max(0, open));
  const top = lerp(frame.top, 0, t);
  const side = lerp(frame.side, 0, t);
  const bottom = lerp(frame.bottom, 0, t);
  const radius = lerp(frame.radius, 0, t);
  return `inset(${top.toFixed(1)}px ${side.toFixed(1)}px ${bottom.toFixed(1)}px ${side.toFixed(1)}px round ${radius.toFixed(1)}px)`;
}
