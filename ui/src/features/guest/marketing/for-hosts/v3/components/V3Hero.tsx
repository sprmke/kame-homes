import { useEffect, useRef, useState } from 'react';

import { Link } from 'react-router-dom';

import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'framer-motion';
import { ArrowRight, CalendarDays, Check, Play } from 'lucide-react';

import { scrollToSection } from '@/features/guest/marketing/for-hosts/lib/scrollToSection';
import { Pill } from '@/features/guest/marketing/for-hosts/preview/components/showcase/ShowcasePrimitives';
import {
  V3_SIGNUP_CTA,
  v3Hero,
  v3HeroStatuses,
  v3Images,
  v3Workflow,
} from '@/features/guest/marketing/for-hosts/v3/data/hostLandingV3';
import { MarketingImage } from '@/features/guest/marketing/shared/components/MarketingImage';

import { Button } from '@/components/ui/button';

const EASE = [0.22, 1, 0.36, 1] as const;
const CYCLE_MS = 2600;

/** Sample booking card that steps through real workflow statuses while the hero is visible. */
function LiveBookingCard() {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: '-40px' });
  const [step, setStep] = useState(0);
  const { sampleGuest } = v3Workflow;

  useEffect(() => {
    if (reduceMotion || !inView) return;
    const id = window.setInterval(
      () => setStep((current) => (current + 1) % v3HeroStatuses.length),
      CYCLE_MS
    );
    return () => window.clearInterval(id);
  }, [reduceMotion, inView]);

  const status = v3HeroStatuses[step];

  return (
    <div
      ref={ref}
      className="border-border/70 bg-card/95 w-[min(19rem,calc(100vw-3rem))] rounded-2xl border p-4 shadow-[0_24px_60px_-28px_hsl(var(--shadow-color)/0.35)] backdrop-blur-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-foreground truncate text-sm font-bold">{sampleGuest.name}</p>
          <p className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
            <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {sampleGuest.stay}
          </p>
        </div>
        <span className="text-muted-foreground shrink-0 text-[11px] font-medium">
          {sampleGuest.unit}
        </span>
      </div>

      <div className="mt-4 flex gap-1" aria-hidden>
        {v3HeroStatuses.map((item, index) => (
          <span
            key={item.label}
            className="bg-muted relative h-1 flex-1 overflow-hidden rounded-full"
          >
            <motion.span
              className="bg-primary absolute inset-0 origin-left rounded-full"
              initial={false}
              animate={{ scaleX: index <= step ? 1 : 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.5, ease: EASE }}
            />
          </span>
        ))}
      </div>

      <div className="relative mt-3 h-[52px]" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={status.label}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="absolute inset-0"
          >
            <Pill tone={status.tone}>{status.label}</Pill>
            <p className="text-muted-foreground mt-1.5 flex items-center gap-1.5 text-xs">
              <Check className="text-primary h-3.5 w-3.5 shrink-0" aria-hidden />
              {status.note}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export function V3Hero() {
  const reduceMotion = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  });
  const imageY = useTransform(scrollYProgress, [0, 1], ['0%', reduceMotion ? '0%' : '12%']);
  const cardY = useTransform(scrollYProgress, [0, 1], [0, reduceMotion ? 0 : -60]);

  const enter = (delay: number) => ({
    initial: reduceMotion ? false : { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, delay: reduceMotion ? 0 : delay, ease: EASE },
  });

  return (
    <section
      ref={sectionRef}
      id="top"
      className="relative overflow-hidden pb-16 pt-24 sm:pt-28 lg:flex lg:min-h-[100dvh] lg:items-center lg:pb-20"
    >
      <div className="container mx-auto w-full px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.05fr] lg:gap-14 xl:gap-20">
          <div className="max-w-2xl">
            <h1 className="text-foreground text-[clamp(2.4rem,4.4vw,4rem)] font-extrabold leading-[1.04] tracking-[-0.035em]">
              {v3Hero.headline.map((line, index) => (
                <span key={line} className="block overflow-hidden pb-[0.08em]">
                  <motion.span
                    className="block"
                    initial={reduceMotion ? false : { y: '110%' }}
                    animate={{ y: 0 }}
                    transition={{
                      duration: 0.8,
                      delay: reduceMotion ? 0 : 0.08 + index * 0.1,
                      ease: EASE,
                    }}
                  >
                    {index === v3Hero.headline.length - 1 ? (
                      <span className="text-primary">{line}</span>
                    ) : (
                      line
                    )}
                  </motion.span>
                </span>
              ))}
            </h1>

            <motion.p
              {...enter(0.35)}
              className="text-muted-foreground mt-6 max-w-[34rem] text-base leading-relaxed sm:text-lg"
            >
              {v3Hero.lead}
            </motion.p>

            <motion.div
              {...enter(0.45)}
              className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center"
            >
              <Button
                asChild
                size="lg"
                className="group min-h-[52px] rounded-full px-7 text-base font-semibold text-white transition-transform active:scale-[0.98]"
              >
                <Link to={V3_SIGNUP_CTA.to}>
                  {V3_SIGNUP_CTA.label}
                  <ArrowRight
                    className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
              </Button>
              <Button
                type="button"
                size="lg"
                variant="ghost"
                onClick={() =>
                  scrollToSection(v3Hero.secondaryCta.sectionId, Boolean(reduceMotion))
                }
                className="text-foreground hover:bg-muted min-h-[52px] rounded-full px-5 text-base"
              >
                <span className="bg-primary/10 text-primary mr-2.5 flex h-7 w-7 items-center justify-center rounded-full">
                  <Play className="h-3.5 w-3.5 translate-x-px fill-current" aria-hidden />
                </span>
                {v3Hero.secondaryCta.label}
              </Button>
            </motion.div>
          </div>

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, delay: reduceMotion ? 0 : 0.15, ease: EASE }}
            className="relative pb-10 sm:pb-12 lg:pb-0"
          >
            <div className="relative aspect-[4/5] overflow-hidden rounded-[1.75rem] sm:aspect-[5/4] lg:aspect-[4/5] xl:aspect-[5/6]">
              <motion.div className="absolute inset-[-8%_0]" style={{ y: imageY }}>
                <MarketingImage
                  src={v3Images.hero}
                  alt={v3Hero.imageAlt}
                  fill
                  priority
                  className="object-cover"
                />
              </motion.div>
              <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent"
              />
            </div>

            <motion.div
              style={{ y: cardY }}
              className="absolute bottom-0 left-3 sm:left-6 lg:-left-10 lg:bottom-12"
            >
              <motion.div
                initial={reduceMotion ? false : { opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: reduceMotion ? 0 : 0.55, ease: EASE }}
              >
                <LiveBookingCard />
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
