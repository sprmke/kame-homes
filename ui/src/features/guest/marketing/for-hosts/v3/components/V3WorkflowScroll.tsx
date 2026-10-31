import { useRef, useState } from 'react';

import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from 'framer-motion';
import { Check } from 'lucide-react';

import { Reveal } from '@/features/guest/marketing/for-hosts/preview/components/Reveal';
import { Pill } from '@/features/guest/marketing/for-hosts/preview/components/showcase/ShowcasePrimitives';
import {
  InViewWorkflowScene,
  WorkflowScene,
} from '@/features/guest/marketing/for-hosts/v3/components/V3WorkflowScenes';
import { v3Workflow } from '@/features/guest/marketing/for-hosts/v3/data/hostLandingV3';

import { cn } from '@/lib/utils';

const { eyebrow, title, lead, stages, sampleGuest } = v3Workflow;
const EASE = [0.16, 1, 0.3, 1] as const;

function SectionHeader({ className }: { className?: string }) {
  return (
    <div className={className}>
      <p className="text-primary text-sm font-semibold">{eyebrow}</p>
      <h2 className="text-foreground mt-3 text-balance text-3xl font-bold tracking-[-0.025em] sm:text-4xl lg:text-[2.75rem] lg:leading-[1.08]">
        {title}
      </h2>
      <p className="text-muted-foreground mt-4 max-w-md leading-relaxed">{lead}</p>
    </div>
  );
}

function YouTag() {
  return (
    <Pill tone="amber" className="ml-2 align-middle">
      You
    </Pill>
  );
}

function stageTone(index: number) {
  if (stages[index].needsYou) return 'amber';
  return index === stages.length - 1 ? 'green' : 'teal';
}

/**
 * The stage canvas: a fixed guest strip with step progress, and a dot-grid area where the
 * current step's scene plays. Scenes swap with a quick blur cross-fade so the change reads as
 * the same booking moving on, not a new slide.
 */
function StageCanvas({ active }: { active: number }) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      aria-hidden
      className="border-border bg-card overflow-hidden rounded-[1.75rem] border shadow-[0_32px_80px_-40px_hsl(var(--shadow-color)/0.35)]"
    >
      <div className="border-border flex items-center gap-3 border-b px-6 py-4">
        <span className="bg-primary/10 text-primary flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold">
          {sampleGuest.initials}
        </span>
        <div className="min-w-0">
          <p className="text-foreground text-sm font-bold">{sampleGuest.name}</p>
          <p className="text-muted-foreground text-xs">
            {sampleGuest.stay} · {sampleGuest.unit}
          </p>
        </div>
        <div className="ml-auto flex w-36 flex-col items-end gap-2">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={stages[active].status}
              initial={reduceMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
            >
              <Pill tone={stageTone(active)}>{stages[active].status}</Pill>
            </motion.span>
          </AnimatePresence>
          <div className="flex w-full gap-1">
            {stages.map((stage, index) => (
              <span
                key={stage.status}
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
        </div>
      </div>

      <div className="relative flex h-[26rem] items-center justify-center px-8 [background-image:radial-gradient(hsl(var(--border))_1px,transparent_1px)] [background-size:18px_18px] xl:h-[28rem]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={active}
            className="flex w-full justify-center"
            initial={reduceMotion ? false : { opacity: 0, y: 14, filter: 'blur(6px)' }}
            animate={{
              opacity: 1,
              y: 0,
              filter: 'blur(0px)',
              transition: { duration: 0.4, ease: EASE },
            }}
            exit={
              reduceMotion
                ? undefined
                : { opacity: 0, y: -10, filter: 'blur(6px)', transition: { duration: 0.18 } }
            }
          >
            <div className="flex w-full justify-center lg:scale-[1.15] xl:scale-[1.3]">
              <WorkflowScene index={active} />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/**
 * Desktop: the section pins for ~3.5 viewports and scroll moves one booking through the six
 * steps. The left rail carries the words; the canvas on the right plays each step as a short
 * scene. Rail steps are buttons that scroll to their stop. Below `lg` it becomes a vertical
 * timeline where every step has its own compact scene that plays when it scrolls into view.
 */
export function V3WorkflowScroll() {
  const reduceMotion = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: trackRef, offset: ['start start', 'end end'] });

  useMotionValueEvent(scrollYProgress, 'change', (value) => {
    const next = Math.min(stages.length - 1, Math.max(0, Math.floor(value * stages.length)));
    setActive((current) => (current === next ? current : next));
  });

  const goToStage = (index: number) => {
    const track = trackRef.current;
    if (!track) return;
    const top = track.getBoundingClientRect().top + window.scrollY;
    const travel = track.offsetHeight - window.innerHeight;
    window.scrollTo({
      top: top + ((index + 0.5) / stages.length) * travel,
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  };

  return (
    <section id="how-it-works" className="scroll-mt-20">
      {/* Desktop: pinned scroll story */}
      <div
        ref={trackRef}
        className="relative hidden lg:block"
        style={{ height: `${stages.length * 55 + 45}vh` }}
      >
        <div className="sticky top-0 flex h-[100dvh] items-center">
          <div className="container mx-auto px-8">
            <div className="grid grid-cols-[0.85fr_1.15fr] items-center gap-16 xl:gap-24">
              <div>
                <SectionHeader />
                <ol className="relative mt-10">
                  <span
                    aria-hidden
                    className="bg-border absolute bottom-[22px] left-[9px] top-[22px] w-0.5"
                  />
                  <motion.span
                    aria-hidden
                    className="bg-primary absolute left-[9px] top-[22px] w-0.5 origin-top"
                    style={{ bottom: '22px', scaleY: scrollYProgress }}
                  />
                  {stages.map((stage, index) => {
                    const reached = index <= active;
                    const current = index === active;
                    return (
                      <li key={stage.status}>
                        <button
                          type="button"
                          onClick={() => goToStage(index)}
                          aria-current={current ? 'step' : undefined}
                          className="focus-visible:ring-ring group relative flex min-h-[44px] w-full gap-4 rounded-lg py-2.5 text-left focus-visible:outline-none focus-visible:ring-2"
                        >
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
                          <span className="min-w-0">
                            <span
                              className={cn(
                                'block text-base font-semibold transition-colors duration-300',
                                current
                                  ? 'text-foreground'
                                  : 'text-muted-foreground/70 group-hover:text-foreground'
                              )}
                            >
                              {stage.title}
                              {stage.needsYou ? <YouTag /> : null}
                            </span>
                            <motion.span
                              initial={false}
                              animate={{ height: current ? 'auto' : 0, opacity: current ? 1 : 0 }}
                              transition={{ duration: 0.35, ease: EASE }}
                              className="block overflow-hidden"
                            >
                              <span className="text-muted-foreground block max-w-sm pt-1 text-sm leading-relaxed">
                                {stage.body}
                              </span>
                            </motion.span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </div>
              <StageCanvas active={active} />
            </div>
          </div>
        </div>
      </div>

      {/* Phone / tablet: vertical timeline with a scene per step */}
      <div className="container mx-auto px-4 py-10 sm:px-6 sm:py-20 lg:hidden">
        <Reveal>
          <SectionHeader />
        </Reveal>
        <ol className="mt-10">
          {stages.map((stage, index) => (
            <li key={stage.status} className="relative flex gap-4 pb-10 last:pb-0">
              {index < stages.length - 1 ? (
                <span
                  aria-hidden
                  className="bg-primary/25 absolute bottom-0 left-[9px] top-6 w-0.5"
                />
              ) : null}
              <span className="border-primary bg-primary relative z-10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2">
                <Check className="h-3 w-3 text-white" strokeWidth={3} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-foreground text-base font-semibold">
                  {stage.title}
                  {stage.needsYou ? <YouTag /> : null}
                </p>
                <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{stage.body}</p>
                <InViewWorkflowScene index={index} />
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
