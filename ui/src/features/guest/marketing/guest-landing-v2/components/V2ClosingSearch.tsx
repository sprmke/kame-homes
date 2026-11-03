import { motion, useReducedMotion } from 'framer-motion';

import { HeroSearch } from '@/features/guest/marketing/guest-landing/components/HeroSearch';
import {
  EASE_OUT,
  inViewOnce,
  rise,
  riseStagger,
} from '@/features/guest/marketing/guest-landing-v2/lib/apertureMotion';

/**
 * The close: a teal field that opens like the hero window and hands the visitor the same
 * search they started with.
 */
export function V2ClosingSearch() {
  const reduce = useReducedMotion() ?? false;

  return (
    <section aria-labelledby="v2-close-title" className="bg-background pb-10 md:pb-16 lg:pb-20">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="relative mx-auto max-w-[1400px] px-4 py-14 sm:px-8 md:py-20 lg:py-24">
          {/* Only the teal field is clipped, so the search panel can still overflow the block. */}
          <motion.div
            aria-hidden
            initial={reduce ? false : { clipPath: 'inset(6% 6% 6% 6% round 40px)' }}
            whileInView={{ clipPath: 'inset(0% 0% 0% 0% round 32px)' }}
            viewport={inViewOnce}
            transition={{ duration: 1.1, ease: EASE_OUT }}
            className="bg-primary-strong absolute inset-0 rounded-[2rem]"
          />
          <motion.div
            variants={riseStagger}
            initial={reduce ? false : 'hidden'}
            whileInView="shown"
            viewport={inViewOnce}
            className="relative mx-auto max-w-3xl text-center"
          >
            <motion.h2
              id="v2-close-title"
              variants={rise}
              className="text-primary-foreground text-balance text-[2rem] font-bold leading-[1.05] tracking-[-0.035em] sm:text-5xl lg:text-6xl"
            >
              Where to next?
            </motion.h2>
            <motion.div
              variants={rise}
              className="bg-background border-border/60 relative z-20 mt-7 rounded-[1.4rem] border p-1.5 text-left shadow-[0_24px_48px_-24px_rgb(0_0_0/0.45)] md:mt-9"
            >
              <HeroSearch />
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
