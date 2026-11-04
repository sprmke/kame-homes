import { motion, useReducedMotion } from 'framer-motion';
import { BadgeCheck, MessageCircle, Receipt, ShieldCheck } from 'lucide-react';

import {
  trustCopy,
  trustPoints,
  type TrustPoint,
} from '@/features/guest/marketing/guest-landing-v3/data/landingV3Content';
import {
  inViewOnce,
  rise,
  riseStagger,
} from '@/features/guest/marketing/guest-landing-v3/lib/quietMotion';

const ICON: Record<TrustPoint['icon'], typeof ShieldCheck> = {
  verified: BadgeCheck,
  fee: Receipt,
  direct: MessageCircle,
  host: ShieldCheck,
};

/** The quietest section on the page, deliberately — a calm, honest case for booking direct. */
export function V3Trust() {
  const reduce = useReducedMotion() ?? false;

  return (
    <section
      aria-labelledby="v3-trust-title"
      className="public-section-y border-border bg-background border-t"
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.p
          variants={rise}
          initial={reduce ? false : 'hidden'}
          whileInView="shown"
          viewport={inViewOnce}
          className="text-primary text-xs font-semibold uppercase tracking-[0.18em]"
        >
          {trustCopy.eyebrow}
        </motion.p>
        <motion.h2
          id="v3-trust-title"
          variants={rise}
          initial={reduce ? false : 'hidden'}
          whileInView="shown"
          viewport={inViewOnce}
          className="text-foreground mt-2 max-w-[22ch] text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl"
        >
          {trustCopy.headline}
        </motion.h2>

        <motion.ul
          variants={riseStagger}
          initial={reduce ? false : 'hidden'}
          whileInView="shown"
          viewport={inViewOnce}
          className="mt-8 grid gap-6 sm:grid-cols-2 md:gap-8"
        >
          {trustPoints.map((point) => {
            const Icon = ICON[point.icon];
            return (
              <motion.li key={point.title} variants={rise} className="flex items-start gap-3">
                <span className="public-icon-well bg-primary/10 text-primary shrink-0">
                  <Icon className="size-[18px] md:size-5" aria-hidden />
                </span>
                <div>
                  <p className="public-card-title text-foreground font-semibold">{point.title}</p>
                  <p className="text-muted-foreground mt-0.5 text-sm">{point.detail}</p>
                </div>
              </motion.li>
            );
          })}
        </motion.ul>
      </div>
    </section>
  );
}
