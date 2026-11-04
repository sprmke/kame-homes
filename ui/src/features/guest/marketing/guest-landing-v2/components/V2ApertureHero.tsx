import { useLayoutEffect, useRef } from 'react';

import { Link } from 'react-router-dom';

import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';

import { HeroSearch } from '@/features/guest/marketing/guest-landing/components/HeroSearch';
import { apertureBackdrop } from '@/features/guest/marketing/guest-landing-v2/data/landingV2Content';
import { useV2FeaturedStays } from '@/features/guest/marketing/guest-landing-v2/hooks/useV2FeaturedStays';
import {
  apertureClipPath,
  EASE_OUT,
  progressBetween,
  rise,
  riseStagger,
  type ApertureFrame,
} from '@/features/guest/marketing/guest-landing-v2/lib/apertureMotion';
import { MarketingImage as Image } from '@/features/guest/marketing/shared/components/MarketingImage';

import { cn } from '@/lib/utils';

/** Gap between the search and the window's top edge at rest. */
const WINDOW_GAP_PX = 28;

/** Scroll progress over which the window widens to full bleed. */
const OPEN_FROM = 0;
const OPEN_TO = 0.55;

/** Layout offsets (not client rects) so a scroll-driven transform on the copy never skews it. */
function measureFrame(copy: HTMLElement): ApertureFrame {
  const width = window.innerWidth;
  const side = width >= 1024 ? 32 : width >= 640 ? 24 : 16;
  return {
    top: Math.round(copy.offsetTop + copy.offsetHeight + WINDOW_GAP_PX),
    side,
    bottom: side,
    radius: width >= 1024 ? 32 : 24,
  };
}

/**
 * First viewport: headline + the live search, with a rounded window onto a stay below it.
 * Scrolling holds the stage in place and widens that window to full bleed, then lands the
 * page's promise inside it. Reduced motion gets the resting composition with no pinning.
 */
export function V2ApertureHero() {
  const reduce = useReducedMotion() ?? false;
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  // Geometry lives in a ref; bumping `frameVersion` re-runs the clip-path transform.
  const frameRef = useRef<ApertureFrame | null>(null);
  const frameVersion = useMotionValue(0);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  });
  const progress: MotionValue<number> = useTransform(scrollYProgress, (v) => (reduce ? 0 : v));

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const copy = copyRef.current;
    if (!stage || !copy) return;
    const update = () => {
      frameRef.current = measureFrame(copy);
      frameVersion.set(frameVersion.get() + 1);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(stage);
    observer.observe(copy);
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [frameVersion]);

  const open = useTransform(progress, (v) => progressBetween(v, OPEN_FROM, OPEN_TO));
  const clipPath = useTransform([open, frameVersion], ([o]: number[]) =>
    frameRef.current
      ? apertureClipPath(frameRef.current, o)
      : 'inset(60% 16px 16px 16px round 24px)'
  );
  const imageScale = useTransform(open, [0, 1], [1.14, 1]);

  const copyOpacity = useTransform(progress, [0, 0.28], [1, 0]);
  const copyY = useTransform(progress, [0, 0.32], [0, -48]);
  const copyPointer = useTransform(progress, (v) => (v > 0.16 ? 'none' : 'auto'));

  const promiseOpacity = useTransform(progress, [0.5, 0.72], [0, 1]);
  const promiseY = useTransform(progress, [0.5, 0.8], [28, 0]);
  const veilOpacity = useTransform(progress, [0.3, 0.7], [0.15, 1]);

  return (
    <section
      ref={sectionRef}
      aria-label="Search stays"
      className={cn('relative', reduce ? '' : 'h-[185svh] lg:h-[235svh]')}
    >
      <div
        ref={stageRef}
        className={cn('top-0 w-full', reduce ? 'relative min-h-[92svh]' : 'sticky h-svh')}
      >
        {/* The window. clip-path does the opening so the radius stays true at every size. */}
        <motion.div className="absolute inset-0 bg-slate-900" style={{ clipPath }} aria-hidden>
          <motion.div className="absolute inset-0" style={{ scale: imageScale }}>
            <Image
              src={apertureBackdrop.src}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
          </motion.div>
          <motion.div
            className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/10"
            style={{ opacity: veilOpacity }}
          />
        </motion.div>

        {/* Headline + search. Sits above the window so the search panel can overlap it. */}
        <motion.div
          ref={copyRef}
          style={
            reduce ? undefined : { opacity: copyOpacity, y: copyY, pointerEvents: copyPointer }
          }
          className="relative z-20 mx-auto w-full max-w-4xl px-4 pt-[calc(var(--public-nav-h)+1.25rem)] text-center sm:px-6 md:pt-[calc(var(--public-nav-h)+2rem)] lg:pt-[calc(var(--public-nav-h)+1.5rem)]"
        >
          <motion.div variants={riseStagger} initial={reduce ? false : 'hidden'} animate="shown">
            <motion.h1
              variants={rise}
              className="text-foreground mx-auto max-w-[14ch] text-balance text-[2rem] font-bold leading-[1.05] tracking-[-0.035em] sm:text-5xl lg:text-[4.25rem]"
            >
              Your stay, sorted before you arrive
            </motion.h1>
            <motion.p
              variants={rise}
              className="public-lead text-muted-foreground mx-auto mt-3 max-w-md md:mt-4"
            >
              Homes and parking, booked direct with local hosts.
            </motion.p>
          </motion.div>

          <motion.div
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.22 }}
            className="mx-auto mt-5 w-full max-w-3xl text-left md:mt-7"
          >
            <div className="bg-background border-border/70 rounded-[1.4rem] border p-1.5 shadow-[0_18px_40px_-18px_rgb(15_23_42/0.35)]">
              <HeroSearch />
            </div>
          </motion.div>
        </motion.div>

        {!reduce ? <ApertureCaption opacity={promiseOpacity} y={promiseY} /> : null}
      </div>
    </section>
  );
}

function ApertureCaption({ opacity, y }: { opacity: MotionValue<number>; y: MotionValue<number> }) {
  const pointer = useTransform(opacity, (v) => (v > 0.6 ? 'auto' : 'none'));

  return (
    <motion.div
      style={{ opacity, y, pointerEvents: pointer }}
      className="absolute inset-x-0 bottom-0 z-10 px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:pb-14"
    >
      <div className="container mx-auto flex flex-col gap-6 px-0 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-balance text-[2rem] font-bold leading-[1.05] tracking-[-0.03em] text-white sm:text-5xl lg:text-6xl">
            One booking covers the whole stay
          </p>
          <p className="public-lead mt-3 text-white/80">
            The home, a parking slot, the building pass, and a line to your host.
          </p>
        </div>
        <FeaturedStayChip />
      </div>
    </motion.div>
  );
}

/** The live top-ranked stay, so the full-bleed moment always points at something bookable. */
function FeaturedStayChip() {
  const { stays } = useV2FeaturedStays();
  const stay = stays[0];
  if (!stay) return null;

  return (
    <Link
      to={`/properties/${stay.slug}`}
      className="group flex w-full max-w-sm items-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-2 pr-4 text-white backdrop-blur-md transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
    >
      <span className="relative size-14 shrink-0 overflow-hidden rounded-xl">
        <Image src={stay.images[0] ?? ''} alt="" fill sizes="56px" className="object-cover" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{stay.name}</span>
        <span className="block truncate text-xs text-white/75">
          ₱{stay.price.toLocaleString()} a night
        </span>
      </span>
      <ArrowUpRight
        className="size-5 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
        aria-hidden
      />
    </Link>
  );
}
