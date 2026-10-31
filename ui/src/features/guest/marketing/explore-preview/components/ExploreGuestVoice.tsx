import { motion, useReducedMotion } from 'framer-motion';
import { Star } from 'lucide-react';

import { guestVoice } from '@/features/guest/marketing/explore-preview/data/explorePreviewContent';
import { inViewOnce, rise } from '@/features/guest/marketing/explore-preview/lib/motion';

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function ExploreGuestVoice() {
  const reduce = useReducedMotion();

  return (
    <section className="bg-background pb-16 lg:pb-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.figure
          variants={reduce ? undefined : rise}
          initial={reduce ? false : 'hidden'}
          whileInView="shown"
          viewport={inViewOnce}
          className="bg-muted/50 mx-auto max-w-3xl rounded-[2rem] px-4 py-6 sm:px-12 sm:py-14"
        >
          <div className="text-primary flex gap-0.5" aria-hidden>
            {Array.from({ length: 5 }).map((_, index) => (
              <Star key={index} className="h-4 w-4 fill-current" />
            ))}
          </div>
          <blockquote className="text-foreground mt-5 text-xl font-medium leading-snug sm:text-2xl">
            {guestVoice.quote}
          </blockquote>
          <figcaption className="mt-7 flex items-center gap-3.5">
            <span className="bg-primary/10 text-primary flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
              {initials(guestVoice.name)}
            </span>
            <span className="text-sm">
              <span className="text-foreground block font-semibold">{guestVoice.name}</span>
              <span className="text-muted-foreground block">{guestVoice.stay}</span>
            </span>
          </figcaption>
        </motion.figure>
      </div>
    </section>
  );
}
