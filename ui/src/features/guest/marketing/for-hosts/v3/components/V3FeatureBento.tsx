import { useRef, type PointerEvent, type ReactNode } from 'react';

import { motion, useInView, useReducedMotion } from 'framer-motion';
import { CalendarClock, Instagram, RefreshCw } from 'lucide-react';

import {
  TURTLE_IDLE_POSTER_SRC,
  TURTLE_LOOP_VIDEO_SRC,
  TURTLE_PLATE_COLOR,
} from '@/features/guest/chat/components/voice/receptionistAvatarVideo';
import { Reveal } from '@/features/guest/marketing/for-hosts/preview/components/Reveal';
import { BookingsDemo } from '@/features/guest/marketing/for-hosts/preview/components/showcase/ShowcaseDemos';
import { Chip } from '@/features/guest/marketing/for-hosts/preview/components/showcase/ShowcasePrimitives';
import { v3Features, v3Images } from '@/features/guest/marketing/for-hosts/v3/data/hostLandingV3';
import { MarketingImage } from '@/features/guest/marketing/shared/components/MarketingImage';

import { cn } from '@/lib/utils';

const EASE = [0.22, 1, 0.36, 1] as const;
const { title, bookings, receptionist, pricing, money, marketing, team } = v3Features;

/**
 * Bento tile with a soft cursor spotlight. The pointer position is written straight to CSS
 * variables (no React state), so hover tracking never re-renders.
 */
function BentoCell({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || event.pointerType !== 'mouse') return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--spot-x', `${event.clientX - rect.left}px`);
    el.style.setProperty('--spot-y', `${event.clientY - rect.top}px`);
  };

  return (
    <Reveal delay={delay} className={cn('min-w-0', className)}>
      <div
        ref={ref}
        onPointerMove={onPointerMove}
        className="border-border bg-card hover:border-primary/30 group relative flex h-full flex-col overflow-hidden rounded-[1.5rem] border transition-[border-color,box-shadow] duration-300 hover:shadow-[0_24px_60px_-36px_hsl(var(--shadow-color)/0.3)]"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background:
              'radial-gradient(28rem circle at var(--spot-x, 50%) var(--spot-y, 50%), hsl(var(--primary) / 0.07), transparent 60%)',
          }}
        />
        {children}
      </div>
    </Reveal>
  );
}

function CellCopy({
  heading,
  body,
  className,
}: {
  heading: string;
  body: string;
  className?: string;
}) {
  return (
    <div className={cn('relative', className)}>
      <h3 className="text-foreground text-lg font-bold tracking-tight sm:text-xl">{heading}</h3>
      <p className="text-muted-foreground mt-2 max-w-md text-sm leading-relaxed sm:text-[15px]">
        {body}
      </p>
    </div>
  );
}

/** Chat pair that types in once the tile is on screen. */
function ReceptionistChat() {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const show = reduceMotion || inView;

  const bubble = (delay: number) => ({
    initial: reduceMotion ? false : { opacity: 0, y: 10, scale: 0.97 },
    animate: show ? { opacity: 1, y: 0, scale: 1 } : undefined,
    transition: { duration: 0.4, delay: reduceMotion ? 0 : delay, ease: EASE },
  });

  return (
    <div ref={ref} className="relative mt-auto space-y-2.5 pt-6">
      <motion.p
        {...bubble(0.2)}
        className="bg-muted text-foreground ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2.5 text-sm"
      >
        {receptionist.question}
      </motion.p>
      <motion.div {...bubble(0.9)} className="flex items-end gap-2">
        <span
          className="h-8 w-8 shrink-0 overflow-hidden rounded-full"
          style={{ backgroundColor: TURTLE_PLATE_COLOR }}
        >
          <img src={TURTLE_IDLE_POSTER_SRC} alt="" className="h-full w-full object-cover" />
        </span>
        <p className="bg-primary w-fit max-w-[85%] rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm text-white">
          {receptionist.answer}
        </p>
      </motion.div>
    </div>
  );
}

function MoneyChart() {
  const reduceMotion = useReducedMotion();
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const width = 240;
  const height = 72;
  const stepX = width / (money.points.length - 1);
  const line = `M${money.points
    .map((value, index) => `${index * stepX},${height - (value / 100) * (height - 8) - 4}`)
    .join(' L')}`;

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="mt-5 h-20 w-full"
      aria-hidden
    >
      <defs>
        <linearGradient id="v3-money-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.2" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d={`${line} L${width},${height} L0,${height} Z`}
        fill="url(#v3-money-area)"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={inView || reduceMotion ? { opacity: 1 } : undefined}
        transition={{ duration: 0.6, delay: 0.8 }}
      />
      <motion.path
        d={line}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        initial={reduceMotion ? false : { pathLength: 0 }}
        animate={inView || reduceMotion ? { pathLength: 1 } : undefined}
        transition={{ duration: 1.2, ease: EASE }}
      />
    </svg>
  );
}

export function V3FeatureBento() {
  return (
    <section id="features" className="scroll-mt-20 py-20 sm:py-24 lg:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <h2 className="text-foreground max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]">
            {title}
          </h2>
        </Reveal>

        <div className="mt-12 grid gap-4 md:grid-cols-6 lg:grid-cols-12 lg:gap-5">
          {/* Bookings: live board demo */}
          <BentoCell className="md:col-span-6 lg:col-span-7">
            <CellCopy heading={bookings.title} body={bookings.body} className="p-6 sm:p-8" />
            <div className="relative mt-auto px-4 pb-4 sm:px-8 sm:pb-8">
              <div className="border-border bg-background h-[320px] rounded-2xl border p-4 sm:h-[360px]">
                <BookingsDemo />
              </div>
            </div>
          </BentoCell>

          {/* Receptionist: brand video + chat */}
          <BentoCell delay={0.06} className="md:col-span-6 lg:col-span-5">
            <div className="relative flex h-full flex-col p-6 sm:p-8">
              <div
                className="h-20 w-20 overflow-hidden rounded-full ring-4 ring-[hsl(var(--background))]"
                style={{ backgroundColor: TURTLE_PLATE_COLOR }}
              >
                <video
                  className="h-full w-full object-cover"
                  src={TURTLE_LOOP_VIDEO_SRC}
                  poster={TURTLE_IDLE_POSTER_SRC}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  aria-hidden
                />
              </div>
              <CellCopy heading={receptionist.title} body={receptionist.body} className="mt-6" />
              <ReceptionistChat />
            </div>
          </BentoCell>

          {/* Pricing */}
          <BentoCell className="md:col-span-3 lg:col-span-4">
            <div className="relative flex h-full flex-col p-6 sm:p-7">
              <CellCopy heading={pricing.title} body={pricing.body} />
              <div className="mt-6 grid grid-cols-3 gap-2">
                {pricing.rates.map((rate) => (
                  <div key={rate.label} className="bg-muted/60 rounded-xl px-3 py-2.5">
                    <p className="text-muted-foreground text-[11px] font-semibold">{rate.label}</p>
                    <p className="text-foreground mt-0.5 text-sm font-bold tabular-nums">
                      {rate.value}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-muted-foreground mt-3 flex items-center gap-1.5 text-xs">
                <RefreshCw className="text-primary h-3.5 w-3.5" aria-hidden />
                Airbnb calendar in sync
              </p>
            </div>
          </BentoCell>

          {/* Money */}
          <BentoCell delay={0.06} className="md:col-span-3 lg:col-span-4">
            <div className="relative flex h-full flex-col p-6 sm:p-7">
              <CellCopy heading={money.title} body={money.body} />
              <div className="mt-auto pt-6">
                <p className="text-muted-foreground text-xs font-semibold">{money.kpiLabel}</p>
                <p className="text-foreground mt-1 text-2xl font-bold tabular-nums tracking-tight">
                  {money.kpiValue}
                </p>
                <MoneyChart />
              </div>
            </div>
          </BentoCell>

          {/* Marketing: photo-led */}
          <BentoCell delay={0.12} className="md:col-span-6 lg:col-span-4">
            <div className="relative flex h-full flex-col p-6 sm:p-7">
              <CellCopy heading={marketing.title} body={marketing.body} />
              <div className="border-border mt-6 overflow-hidden rounded-2xl border">
                <div className="flex items-center gap-2 px-3 py-2">
                  <Instagram className="text-foreground h-4 w-4" aria-hidden />
                  <span className="text-foreground text-xs font-semibold">kamehomes</span>
                  <CalendarClock
                    className="text-muted-foreground ml-auto h-3.5 w-3.5"
                    aria-hidden
                  />
                  <span className="text-muted-foreground text-[11px]">Fri, 6 PM</span>
                </div>
                <div className="relative aspect-[16/10] overflow-hidden">
                  <MarketingImage
                    src={v3Images.marketing}
                    alt={marketing.imageAlt}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                  />
                </div>
                <p className="text-muted-foreground px-3 py-2.5 text-xs">{marketing.caption}</p>
              </div>
            </div>
          </BentoCell>

          {/* Team: full-width strip */}
          <BentoCell className="md:col-span-6 lg:col-span-12">
            <div className="relative grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-12">
              <CellCopy heading={team.title} body={team.body} />
              <div className="flex flex-wrap gap-2 lg:justify-end">
                {team.chips.map((chip) => (
                  <Chip key={chip.label} icon={chip.icon} label={chip.label} />
                ))}
              </div>
            </div>
          </BentoCell>
        </div>
      </div>
    </section>
  );
}
