import type { Transition, Variants } from 'framer-motion';

/**
 * One motion vocabulary for the whole page: a fade with a small rise, nothing else. No
 * flips, no card objects, no pinned/scrubbed sequences. The restraint is the point.
 */
export const EASE_OUT: Transition['ease'] = [0.16, 1, 0.3, 1];

export const inViewOnce = { once: true, amount: 0.2 } as const;

export const rise: Variants = {
  hidden: { opacity: 0, y: 14 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE_OUT } },
};

export const riseStagger: Variants = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.08, delayChildren: 0.03 } },
};

/** A slower, larger rise for hero-scale copy. */
export const riseSlow: Variants = {
  hidden: { opacity: 0, y: 20 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE_OUT } },
};
