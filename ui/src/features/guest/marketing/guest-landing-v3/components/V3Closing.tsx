import { motion, useReducedMotion } from 'framer-motion';

import { HeroSearch } from '@/features/guest/marketing/guest-landing/components/HeroSearch';
import {
  closingCopy,
  closingPhoto,
} from '@/features/guest/marketing/guest-landing-v3/data/landingV3Content';
import {
  inViewOnce,
  rise,
  riseStagger,
} from '@/features/guest/marketing/guest-landing-v3/lib/quietMotion';
import { MarketingImage as Image } from '@/features/guest/marketing/shared/components/MarketingImage';

/** The close: one more quiet photo moment, the same search the visitor started with. */
export function V3Closing() {
  const reduce = useReducedMotion() ?? false;

  return (
    <section
      aria-labelledby="v3-close-title"
      className="bg-background px-4 pb-12 sm:px-6 lg:px-8 lg:pb-20"
    >
      <div className="relative mx-auto max-w-[1400px] overflow-hidden rounded-2xl">
        <div className="absolute inset-0">
          <Image
            src={closingPhoto.src}
            alt={closingPhoto.alt}
            fill
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-black/55" aria-hidden />
        </div>

        <motion.div
          variants={riseStagger}
          initial={reduce ? false : 'hidden'}
          whileInView="shown"
          viewport={inViewOnce}
          className="relative mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-20"
        >
          <motion.h2
            id="v3-close-title"
            variants={rise}
            className="mx-auto max-w-xl text-balance text-[1.75rem] font-bold leading-[1.15] tracking-[-0.02em] text-white sm:text-4xl"
          >
            {closingCopy.headline}
          </motion.h2>
          <motion.div
            variants={rise}
            className="border-border/60 relative z-20 mx-auto mt-6 rounded-[1.25rem] border bg-white p-1.5 text-left shadow-[0_20px_40px_-20px_rgb(0_0_0/0.5)]"
          >
            <HeroSearch />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
