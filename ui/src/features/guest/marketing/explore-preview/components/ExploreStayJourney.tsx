import { motion, useReducedMotion } from 'framer-motion';
import { CalendarCheck, KeyRound, Search } from 'lucide-react';

import { journeySteps } from '@/features/guest/marketing/explore-preview/data/explorePreviewContent';
import {
  inViewOnce,
  rise,
  riseStagger,
} from '@/features/guest/marketing/explore-preview/lib/motion';

const icons = [Search, CalendarCheck, KeyRound];

export function ExploreStayJourney() {
  const reduce = useReducedMotion();

  return (
    <section className="bg-background public-section-y">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.h2
          variants={reduce ? undefined : rise}
          initial={reduce ? false : 'hidden'}
          whileInView="shown"
          viewport={inViewOnce}
          className="text-foreground max-w-xl public-section-title font-bold"
        >
          How a stay comes together
        </motion.h2>

        <motion.ol
          variants={reduce ? undefined : riseStagger}
          initial={reduce ? false : 'hidden'}
          whileInView="shown"
          viewport={inViewOnce}
          className="relative mt-12 grid gap-10 md:grid-cols-3 md:gap-8"
        >
          {/* The step markers sit on one baseline; the rule ties them together. */}
          <div
            className="bg-border absolute left-0 right-0 top-[1.9rem] hidden h-px md:block"
            aria-hidden
          />

          {journeySteps.map((step, index) => {
            const Icon = icons[index];
            return (
              <motion.li
                key={step.index}
                variants={reduce ? undefined : rise}
                className="relative pl-16 md:pl-0"
              >
                <span className="text-primary bg-background absolute left-0 top-0 text-3xl font-bold tabular-nums md:text-4xl md:relative md:inline-block md:pr-4">
                  {step.index}
                </span>
                <div className="mt-0 flex items-center gap-2 md:mt-5">
                  <Icon className="text-primary h-4 w-4 shrink-0" aria-hidden />
                  <h3 className="text-foreground text-lg font-semibold">{step.title}</h3>
                </div>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{step.body}</p>
              </motion.li>
            );
          })}
        </motion.ol>
      </div>
    </section>
  );
}
