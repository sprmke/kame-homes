import { createRef, useMemo } from 'react';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import { V2JourneyScreen } from '@/features/guest/marketing/guest-landing-v2/components/V2JourneyScreens';
import { journeySteps } from '@/features/guest/marketing/guest-landing-v2/data/landingV2Content';
import { useCenteredIndex } from '@/features/guest/marketing/guest-landing-v2/hooks/useCenteredIndex';
import {
  apertureOpen,
  EASE_OUT,
  inViewOnce,
  rise,
} from '@/features/guest/marketing/guest-landing-v2/lib/apertureMotion';

import { cn } from '@/lib/utils';

/**
 * The guest half of the booking workflow, shown rather than listed. Desktop pins a phone
 * while the steps scroll past it; phones get each step with its own screen inline.
 */
export function V2StayJourney() {
  const reduce = useReducedMotion() ?? false;
  const stepRefs = useMemo(() => journeySteps.map(() => createRef<HTMLLIElement>()), []);
  const active = useCenteredIndex(stepRefs);
  const activeStep = journeySteps[active] ?? journeySteps[0];

  return (
    <section aria-labelledby="v2-journey-title" className="public-section-y bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.h2
          id="v2-journey-title"
          variants={rise}
          initial={reduce ? false : 'hidden'}
          whileInView="shown"
          viewport={inViewOnce}
          className="text-foreground max-w-[16ch] text-balance text-[1.75rem] font-bold leading-[1.08] tracking-[-0.03em] md:text-4xl lg:text-5xl"
        >
          How a stay comes together
        </motion.h2>

        {/* Phones and tablets: step, then its screen. */}
        <ol className="mt-8 space-y-10 md:mt-10 md:grid md:grid-cols-2 md:gap-x-6 md:gap-y-12 md:space-y-0 lg:hidden">
          {journeySteps.map((step, index) => (
            <li key={step.id}>
              <StepText index={index} title={step.title} body={step.body} active />
              <motion.div
                variants={apertureOpen}
                initial={reduce ? false : 'hidden'}
                whileInView="shown"
                viewport={inViewOnce}
                className="border-border/80 mt-4 flex min-h-[22rem] max-w-sm flex-col overflow-hidden rounded-[1.75rem] border"
              >
                <V2JourneyScreen step={step.id} />
              </motion.div>
            </li>
          ))}
        </ol>

        {/* Desktop: steps scroll, the phone holds still and changes screen. */}
        <div className="hidden lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
          <ol>
            {journeySteps.map((step, index) => (
              <li
                key={step.id}
                ref={stepRefs[index]}
                className="flex min-h-[64svh] items-center first:min-h-[52svh] last:min-h-[52svh]"
              >
                <StepText
                  index={index}
                  title={step.title}
                  body={step.body}
                  active={index === active}
                />
              </li>
            ))}
          </ol>

          <div className="relative">
            <div className="bg-primary/[0.07] sticky top-[calc(var(--public-nav-h)+1.5rem)] flex h-[calc(100svh-var(--public-nav-h)-3rem)] items-center justify-center overflow-hidden rounded-[2.5rem]">
              {/* Soft concentric rings: the stage the phone stands on. */}
              <span
                aria-hidden
                className="border-primary/15 absolute size-[34rem] rounded-full border"
              />
              <span
                aria-hidden
                className="border-primary/10 absolute size-[46rem] rounded-full border"
              />
              <div className="bg-foreground relative aspect-[9/18] h-[86%] max-h-[34rem] rounded-[2.75rem] p-2.5 shadow-[0_40px_80px_-40px_rgb(15_23_42/0.55)]">
                <div className="relative h-full overflow-hidden rounded-[2.2rem]">
                  <AnimatePresence initial={false} mode="popLayout">
                    <motion.div
                      key={activeStep.id}
                      className="absolute inset-0"
                      initial={
                        reduce
                          ? false
                          : { clipPath: 'inset(10% 10% 10% 10% round 28px)', opacity: 0.4 }
                      }
                      animate={{ clipPath: 'inset(0% 0% 0% 0% round 0px)', opacity: 1 }}
                      exit={reduce ? undefined : { opacity: 0, transition: { duration: 0.25 } }}
                      transition={{ duration: 0.7, ease: EASE_OUT }}
                    >
                      <V2JourneyScreen step={activeStep.id} />
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StepText({
  index,
  title,
  body,
  active,
}: {
  index: number;
  title: string;
  body: string;
  active: boolean;
}) {
  return (
    <div
      className={cn(
        'transition-opacity duration-500 lg:max-w-md',
        active ? 'opacity-100' : 'lg:opacity-30'
      )}
    >
      <p className="text-primary text-sm font-semibold tabular-nums">
        Step {index + 1} of {journeySteps.length}
      </p>
      <h3 className="text-foreground mt-2 text-xl font-bold tracking-tight md:text-2xl lg:text-[2rem] lg:leading-tight">
        {title}
      </h3>
      <p className="public-lead text-muted-foreground mt-2 max-w-sm lg:mt-3">{body}</p>
    </div>
  );
}
