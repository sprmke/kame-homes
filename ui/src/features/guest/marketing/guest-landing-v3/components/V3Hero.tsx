import { motion, useReducedMotion } from 'framer-motion';

import { HeroSearch } from '@/features/guest/marketing/guest-landing/components/HeroSearch';
import {
  heroCopy,
  heroPhoto,
} from '@/features/guest/marketing/guest-landing-v3/data/landingV3Content';
import {
  EASE_OUT,
  riseSlow,
  riseStagger,
} from '@/features/guest/marketing/guest-landing-v3/lib/quietMotion';
import { MarketingImage as Image } from '@/features/guest/marketing/shared/components/MarketingImage';

/**
 * One full-bleed photo, a short line of copy, the search docked low. No frame, no window,
 * no pinned scroll sequence — the photo carries the section, not a trick.
 */
export function V3Hero() {
  const reduce = useReducedMotion() ?? false;

  return (
    <section
      aria-label="Search stays"
      className="relative min-h-[82svh] overflow-hidden sm:min-h-[88svh]"
    >
      <motion.div
        className="absolute inset-0"
        initial={reduce ? false : { scale: 1 }}
        animate={reduce ? undefined : { scale: 1.06 }}
        transition={reduce ? undefined : { duration: 22, ease: 'linear' }}
      >
        <Image
          src={heroPhoto.src}
          alt={heroPhoto.alt}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      </motion.div>
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-black/35"
        aria-hidden
      />

      <div className="relative z-10 flex min-h-[82svh] flex-col justify-end px-4 pb-8 pt-[calc(var(--public-nav-h)+2rem)] sm:min-h-[88svh] sm:px-6 sm:pb-10 lg:px-8 lg:pb-12">
        <motion.div
          variants={riseStagger}
          initial={reduce ? false : 'hidden'}
          animate={reduce ? undefined : 'shown'}
          className="mx-auto w-full max-w-3xl text-center"
        >
          <motion.p
            variants={riseSlow}
            className="text-xs font-semibold uppercase tracking-[0.18em] text-white/80"
          >
            {heroCopy.eyebrow}
          </motion.p>
          <motion.h1
            variants={riseSlow}
            className="mx-auto mt-2 max-w-xl text-balance text-[1.75rem] font-bold leading-[1.15] tracking-[-0.02em] text-white sm:text-4xl lg:text-[2.75rem]"
          >
            {heroCopy.headline}
          </motion.h1>

          <motion.div
            variants={riseSlow}
            transition={{ duration: 0.8, ease: EASE_OUT, delay: 0.1 }}
            className="mt-6 text-left sm:mt-7"
          >
            <div className="bg-background border-border/60 rounded-[1.25rem] border p-1.5 shadow-[0_18px_40px_-18px_rgb(0_0_0/0.5)]">
              <HeroSearch />
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
