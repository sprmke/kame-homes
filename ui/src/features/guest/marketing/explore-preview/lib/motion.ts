import type { Transition, Variants } from 'framer-motion';

/** Exponential ease-out. One curve for the whole page so every reveal reads as one system. */
export const EASE_OUT: Transition['ease'] = [0.16, 1, 0.3, 1];

/** "Content rises into place" is the page's single authored motion idea. */
export const rise: Variants = {
  hidden: { opacity: 0, y: 22 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE_OUT } },
};

export const riseStagger: Variants = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

/**
 * Shared `whileInView` config: play once, as soon as a sliver of the block shows.
 * A low amount keeps tall sections from staying hidden on short or pre-scrolled viewports.
 */
export const inViewOnce = { once: true, amount: 0.15 } as const;
