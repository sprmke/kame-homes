import { useRef, useState } from 'react';

import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from 'framer-motion';
import { CalendarDays, Check, AlertCircle } from 'lucide-react';

import { Reveal } from '@/features/guest/marketing/for-hosts/preview/components/Reveal';
import { Pill } from '@/features/guest/marketing/for-hosts/preview/components/showcase/ShowcasePrimitives';
import { v3Workflow } from '@/features/guest/marketing/for-hosts/v3/data/hostLandingV3';

import { cn } from '@/lib/utils';

const { eyebrow, title, lead, stages, sampleGuest } = v3Workflow;
const EASE = [0.22, 1, 0.36, 1] as const;

function SectionHeader({ className }: { className?: string }) {
  return (
    <div className={className}>
      <p className="text-primary text-sm font-semibold">{eyebrow}</p>
      <h2 className="text-foreground mt-3 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
        {title}
      </h2>
      <p className="text-muted-foreground mt-4 max-w-md leading-relaxed">{lead}</p>
    </div>
  );
}

/** The sample booking: status pill swaps and the activity log grows as stages are reached. */
function BookingCard({ active }: { active: number }) {
  const reduceMotion = useReducedMotion();
  const stage = stages[active];
  const isDone = active === stages.length - 1;

  return (
    <div className="border-border bg-card min-h-[30rem] rounded-[1.75rem] border p-6 shadow-[0_32px_80px_-40px_hsl(var(--shadow-color)/0.35)] xl:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-foreground text-xl font-bold tracking-tight">{sampleGuest.name}</p>
          <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-sm">
            <CalendarDays className="h-4 w-4" aria-hidden />
            {sampleGuest.stay} · {sampleGuest.unit}
          </p>
        </div>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={stage.status}
            initial={reduceMotion ? false : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.25, ease: EASE }}
          >
            <Pill tone={isDone ? 'green' : stage.needsYou ? 'amber' : 'teal'} className="text-xs">
              {stage.status}
            </Pill>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-6 flex gap-1.5" aria-hidden>
        {stages.map((item, index) => (
          <span
            key={item.status}
            className="bg-muted relative h-1.5 flex-1 overflow-hidden rounded-full"
          >
            <motion.span
              className="bg-primary absolute inset-0 origin-left rounded-full"
              initial={false}
              animate={{ scaleX: index <= active ? 1 : 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.45, ease: EASE }}
            />
          </span>
        ))}
      </div>

      <p className="text-muted-foreground mt-7 text-xs font-semibold">Activity</p>
      <ul className="mt-3 space-y-2.5">
        <AnimatePresence initial={false}>
          {stages.slice(0, active + 1).map((item, index) => (
            <motion.li
              key={item.log}
              layout={!reduceMotion}
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="flex items-center gap-3 text-sm"
            >
              {item.needsYou ? (
                <span className="bg-warning/15 text-warning-foreground dark:text-warning flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                  <AlertCircle className="h-3.5 w-3.5" aria-hidden />
                </span>
              ) : (
                <span className="bg-primary/10 text-primary flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                  <Check className="h-3.5 w-3.5" aria-hidden />
                </span>
              )}
              <span
                className={cn(
                  'text-foreground',
                  index < active ? 'text-muted-foreground' : 'font-semibold'
                )}
              >
                {item.log}
              </span>
              {item.needsYou ? (
                <span className="text-muted-foreground ml-auto shrink-0 text-xs">You approved</span>
              ) : null}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}

/**
 * Desktop: the section pins for six viewport-thirds and scroll drives one booking through the
 * real workflow, stage by stage. Below `lg` it becomes a plain vertical timeline (no pinning on
 * touch, where scroll-jacking feels broken).
 */
export function V3WorkflowScroll() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: trackRef, offset: ['start start', 'end end'] });

  useMotionValueEvent(scrollYProgress, 'change', (value) => {
    const next = Math.min(stages.length - 1, Math.max(0, Math.floor(value * stages.length)));
    setActive((current) => (current === next ? current : next));
  });

  return (
    <section id="how-it-works" className="scroll-mt-20">
      {/* Desktop: pinned scroll story */}
      <div
        ref={trackRef}
        className="relative hidden lg:block"
        style={{ height: `${stages.length * 60 + 40}vh` }}
      >
        <div className="sticky top-0 flex h-[100dvh] items-center">
          <div className="container mx-auto px-8">
            <div className="grid grid-cols-[0.9fr_1.1fr] items-center gap-16 xl:gap-24">
              <div>
                <SectionHeader />
                <ol className="relative mt-10 space-y-1">
                  <span
                    aria-hidden
                    className="bg-border absolute bottom-3 left-[9px] top-3 w-0.5"
                  />
                  <motion.span
                    aria-hidden
                    className="bg-primary absolute left-[9px] top-3 w-0.5 origin-top"
                    style={{ bottom: '0.75rem', scaleY: scrollYProgress }}
                  />
                  {stages.map((stage, index) => {
                    const reached = index <= active;
                    const current = index === active;
                    return (
                      <li key={stage.status} className="relative flex gap-4 py-2 pl-0">
                        <span
                          className={cn(
                            'relative z-10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-300',
                            reached ? 'border-primary bg-primary' : 'border-border bg-background'
                          )}
                        >
                          {reached ? (
                            <Check className="h-3 w-3 text-white" strokeWidth={3} aria-hidden />
                          ) : null}
                        </span>
                        <div className="min-w-0">
                          <p
                            className={cn(
                              'text-base font-semibold transition-colors duration-300',
                              current ? 'text-foreground' : 'text-muted-foreground/70'
                            )}
                          >
                            {stage.title}
                          </p>
                          <motion.div
                            initial={false}
                            animate={{ height: current ? 'auto' : 0, opacity: current ? 1 : 0 }}
                            transition={{ duration: 0.35, ease: EASE }}
                            className="overflow-hidden"
                          >
                            <p className="text-muted-foreground max-w-sm pt-1 text-sm leading-relaxed">
                              {stage.body}
                            </p>
                          </motion.div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
              <BookingCard active={active} />
            </div>
          </div>
        </div>
      </div>

      {/* Phone / tablet: vertical timeline */}
      <div className="container mx-auto px-4 py-20 sm:px-6 lg:hidden">
        <Reveal>
          <SectionHeader />
        </Reveal>
        <ol className="mt-10">
          {stages.map((stage, index) => (
            <Reveal
              as="li"
              key={stage.status}
              delay={0.04 * index}
              className="relative flex gap-4 pb-8 last:pb-0"
            >
              {index < stages.length - 1 ? (
                <span
                  aria-hidden
                  className="bg-primary/25 absolute bottom-0 left-[9px] top-6 w-0.5"
                />
              ) : null}
              <span className="border-primary bg-primary relative z-10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2">
                <Check className="h-3 w-3 text-white" strokeWidth={3} aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-primary text-xs font-semibold">{stage.status}</p>
                <p className="text-foreground mt-0.5 text-base font-semibold">{stage.title}</p>
                <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{stage.body}</p>
                {stage.needsYou ? (
                  <Pill tone="amber" className="mt-2">
                    Needs your approval
                  </Pill>
                ) : null}
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
