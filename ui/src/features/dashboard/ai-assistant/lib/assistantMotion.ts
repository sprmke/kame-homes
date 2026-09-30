/**
 * Motion tokens shared by both assistant surfaces (sheet + full-page AI mode).
 * Only transform, opacity and clip-path are animated; every animation is interruptible.
 * Reduced motion collapses everything to a short opacity crossfade.
 */

export const assistantSpring = {
  /** Mode switch and canvas open. */
  mode: { type: 'spring', stiffness: 380, damping: 36, mass: 0.9 },
  /** Rail collapse and composer lift. */
  soft: { type: 'spring', stiffness: 260, damping: 30 },
} as const;

export const assistantMicro = {
  enter: { duration: 0.16, ease: 'easeOut' },
  exit: { duration: 0.11, ease: 'easeIn' },
} as const;

export const assistantReducedMotion = { duration: 0.15, ease: 'linear' } as const;

export const MESSAGE_ENTRANCE_RISE_PX = 8;
const MESSAGE_ENTRANCE_STAGGER_S = 0.03;
const MESSAGE_ENTRANCE_MAX_STAGGERED = 4;

/**
 * Entrance delay (seconds) for message `index` in a batch of `count` new messages. Only the
 * last few are staggered so loading a long history never waits on a long cascade.
 */
export function messageEntranceDelay(index: number, count: number): number {
  const firstStaggered = Math.max(0, count - MESSAGE_ENTRANCE_MAX_STAGGERED);
  if (index < firstStaggered) return 0;
  return (index - firstStaggered) * MESSAGE_ENTRANCE_STAGGER_S;
}
