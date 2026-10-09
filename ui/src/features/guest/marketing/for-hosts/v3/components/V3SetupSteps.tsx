import { useRef } from 'react';

import { motion, useInView, useReducedMotion } from 'framer-motion';

import { Reveal } from '@/features/guest/marketing/for-hosts/preview/components/Reveal';
import { v3Setup } from '@/features/guest/marketing/for-hosts/v3/data/hostLandingV3';

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Four setup moves on a rail that draws left to right on desktop. On phones the steps become a
 * swipeable scroll-snap row so the section stays short.
 */
export function V3SetupSteps() {
  const reduceMotion = useReducedMotion();
  const railRef = useRef<HTMLOListElement>(null);
  const inView = useInView(railRef, { once: true, margin: '-100px' });
  const draw = reduceMotion || inView;

  return (
    <section id="get-started" className="scroll-mt-20 py-20 sm:py-24 lg:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <h2 className="text-foreground max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">
            {v3Setup.title}
          </h2>
        </Reveal>

        <ol
          ref={railRef}
          className="relative -mx-4 mt-12 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-8 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden"
        >
          <span
            aria-hidden
            className="bg-border absolute left-0 right-0 top-6 hidden h-px lg:block"
          />
          <motion.span
            aria-hidden
            className="bg-primary absolute left-0 right-0 top-6 hidden h-px origin-left lg:block"
            initial={reduceMotion ? false : { scaleX: 0 }}
            animate={{ scaleX: draw ? 1 : 0 }}
            transition={{ duration: 1.2, ease: EASE }}
          />
          {v3Setup.steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <motion.li
                key={step.title}
                initial={reduceMotion ? false : { opacity: 0, y: 16 }}
                animate={draw ? { opacity: 1, y: 0 } : undefined}
                transition={{
                  duration: 0.5,
                  delay: reduceMotion ? 0 : 0.15 + index * 0.15,
                  ease: EASE,
                }}
                className="border-border bg-card relative w-[78%] shrink-0 snap-start rounded-[1.5rem] border p-6 sm:w-[46%] lg:w-auto lg:border-0 lg:bg-transparent lg:p-0"
              >
                <span className="border-border bg-background text-primary relative z-10 flex h-12 w-12 items-center justify-center rounded-2xl border">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="text-foreground mt-5 text-lg font-bold tracking-tight">
                  {step.title}
                </h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{step.body}</p>
              </motion.li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
