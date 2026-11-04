import { motion, useReducedMotion } from 'framer-motion';
import { CarFront, DoorOpen, KeyRound } from 'lucide-react';

import {
  bundleCopy,
  bundleItems,
  type BundleItem,
} from '@/features/guest/marketing/guest-landing-v3/data/landingV3Content';
import {
  inViewOnce,
  rise,
  riseStagger,
} from '@/features/guest/marketing/guest-landing-v3/lib/quietMotion';

const ICON: Record<BundleItem['icon'], typeof KeyRound> = {
  key: KeyRound,
  car: CarFront,
  pass: DoorOpen,
};

/**
 * What one booking actually includes — the honest answer to "why not Airbnb." Plain,
 * editorial, no cards sliding or assembling into place.
 */
export function V3Bundle() {
  const reduce = useReducedMotion() ?? false;

  return (
    <section aria-labelledby="v3-bundle-title" className="public-section-y bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-xl text-center">
          <motion.p
            variants={rise}
            initial={reduce ? false : 'hidden'}
            whileInView="shown"
            viewport={inViewOnce}
            className="text-primary text-xs font-semibold uppercase tracking-[0.18em]"
          >
            {bundleCopy.eyebrow}
          </motion.p>
          <motion.h2
            id="v3-bundle-title"
            variants={rise}
            initial={reduce ? false : 'hidden'}
            whileInView="shown"
            viewport={inViewOnce}
            className="text-foreground mt-2 text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl"
          >
            {bundleCopy.headline}
          </motion.h2>
          <motion.p
            variants={rise}
            initial={reduce ? false : 'hidden'}
            whileInView="shown"
            viewport={inViewOnce}
            className="text-muted-foreground mt-3"
          >
            {bundleCopy.sub}
          </motion.p>
        </div>

        <motion.ul
          variants={riseStagger}
          initial={reduce ? false : 'hidden'}
          whileInView="shown"
          viewport={inViewOnce}
          className="mx-auto mt-10 grid max-w-3xl gap-8 sm:grid-cols-3 sm:gap-6"
        >
          {bundleItems.map((item) => {
            const Icon = ICON[item.icon];
            return (
              <motion.li key={item.title} variants={rise} className="text-center sm:text-left">
                <span className="bg-primary/10 text-primary mx-auto flex size-10 items-center justify-center rounded-full sm:mx-0">
                  <Icon className="size-[18px]" aria-hidden />
                </span>
                <p className="text-foreground mt-3 text-base font-semibold">{item.title}</p>
                <p className="text-muted-foreground mt-1 text-sm">{item.detail}</p>
              </motion.li>
            );
          })}
        </motion.ul>
      </div>
    </section>
  );
}
