import { motion, useReducedMotion } from 'framer-motion';
import { BadgeCheck, Headphones, Lock } from 'lucide-react';

import { inViewOnce, rise } from '@/features/guest/marketing/explore-preview/lib/motion';

const points = [
  { icon: BadgeCheck, label: 'Every home reviewed before it goes live' },
  { icon: Lock, label: 'Secure checkout, one confirmation' },
  { icon: Headphones, label: 'Real support from booking to checkout' },
];

export function ExploreTrustRibbon() {
  const reduce = useReducedMotion();

  return (
    <section className="border-border bg-background border-y">
      <motion.div
        variants={reduce ? undefined : rise}
        initial={reduce ? false : 'hidden'}
        whileInView="shown"
        viewport={inViewOnce}
        className="container mx-auto grid grid-cols-1 gap-x-8 gap-y-3 px-4 py-5 sm:grid-cols-3 sm:px-6 lg:px-8"
      >
        {points.map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-2.5">
            <Icon className="text-primary h-4 w-4 shrink-0" aria-hidden />
            <span className="text-muted-foreground text-sm">{label}</span>
          </div>
        ))}
      </motion.div>
    </section>
  );
}
