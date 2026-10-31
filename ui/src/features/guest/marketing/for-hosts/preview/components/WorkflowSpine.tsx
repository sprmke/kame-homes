import { useRef } from 'react';

import { motion, useInView, useReducedMotion } from 'framer-motion';

import { Eyebrow } from '@/features/guest/marketing/for-hosts/preview/components/Eyebrow';
import { Reveal } from '@/features/guest/marketing/for-hosts/preview/components/Reveal';
import { workflowContent } from '@/features/guest/marketing/for-hosts/preview/data/hostShowcase';

import { cn } from '@/lib/utils';

const { eyebrow, title, lead, stages } = workflowContent;

export function WorkflowSpine() {
  const reduceMotion = useReducedMotion();
  const railRef = useRef<HTMLOListElement>(null);
  const inView = useInView(railRef, { once: true, margin: '-120px' });
  const draw = reduceMotion ? true : inView;

  return (
    <section id="workflow" className="scroll-mt-24 py-16 sm:py-20 lg:py-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal className="max-w-2xl">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 className="text-foreground mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            {title}
          </h2>
          <p className="text-muted-foreground mt-4 leading-relaxed">{lead}</p>
        </Reveal>

        <ol
          ref={railRef}
          className="relative mt-12 grid gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-6 lg:gap-x-2"
        >
          {/* Horizontal track (desktop) */}
          <span
            aria-hidden
            className="bg-border absolute left-[8.333%] right-[8.333%] top-[7px] hidden h-0.5 lg:block"
          />
          <motion.span
            aria-hidden
            className="bg-primary absolute left-[8.333%] right-[8.333%] top-[7px] hidden h-0.5 origin-left lg:block"
            initial={reduceMotion ? false : { scaleX: 0 }}
            animate={{ scaleX: draw ? 1 : 0 }}
            transition={{ duration: reduceMotion ? 0 : 1, ease: [0.22, 1, 0.36, 1] }}
          />

          {stages.map((stage, index) => (
            <li key={stage.status} className="relative lg:text-center">
              {/* Vertical track (mobile / tablet) */}
              {index < stages.length - 1 ? (
                <span
                  aria-hidden
                  className="bg-border absolute left-[7px] top-4 h-[calc(100%+2rem)] w-0.5 lg:hidden"
                />
              ) : null}

              <span className="relative flex lg:justify-center">
                <motion.span
                  className={cn(
                    'relative z-10 flex h-4 w-4 items-center justify-center rounded-full border-2',
                    'border-primary bg-primary'
                  )}
                  initial={reduceMotion ? false : { scale: 0 }}
                  animate={{ scale: draw ? 1 : 0 }}
                  transition={{
                    duration: reduceMotion ? 0 : 0.35,
                    delay: reduceMotion ? 0 : 0.12 * index + 0.15,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  {stage.needsYou ? (
                    <span
                      className="bg-warning absolute -right-1 -top-1 h-2 w-2 rounded-full ring-2 ring-[hsl(var(--background))]"
                      aria-hidden
                    />
                  ) : null}
                </motion.span>
              </span>

              <div className="mt-3 pl-6 lg:pl-0">
                <p className="text-primary text-[11px] font-semibold">{stage.status}</p>
                <p className="text-foreground mt-0.5 text-sm font-bold">{stage.label}</p>
                {stage.needsYou ? (
                  <p className="text-warning-foreground mt-1 text-[11px] font-semibold">
                    needs you
                  </p>
                ) : null}
                <p className="text-muted-foreground mt-1.5 text-[13px] leading-relaxed lg:mx-auto lg:max-w-[22ch]">
                  {stage.handled}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
