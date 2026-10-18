import { useRef, type PointerEvent, type ReactNode } from 'react';

import { motion, useInView, useReducedMotion } from 'framer-motion';
import {
  CalendarClock,
  Facebook,
  Globe,
  Instagram,
  PhoneCall,
  RefreshCw,
  Send,
  Sparkles,
} from 'lucide-react';

import {
  TURTLE_IDLE_POSTER_SRC,
  TURTLE_LOOP_VIDEO_SRC,
  TURTLE_PLATE_COLOR,
} from '@/features/guest/chat/components/voice/receptionistAvatarVideo';
import { Reveal } from '@/features/guest/marketing/for-hosts/preview/components/Reveal';
import { BookingsDemo } from '@/features/guest/marketing/for-hosts/preview/components/showcase/ShowcaseDemos';
import { Pill } from '@/features/guest/marketing/for-hosts/preview/components/showcase/ShowcasePrimitives';
import { V3SectionHeading } from '@/features/guest/marketing/for-hosts/v3/components/V3SectionHeading';
import { v3Features, v3Images } from '@/features/guest/marketing/for-hosts/v3/data/hostLandingV3';
import { MarketingImage } from '@/features/guest/marketing/shared/components/MarketingImage';

import { cn } from '@/lib/utils';

const EASE = [0.22, 1, 0.36, 1] as const;
const { eyebrow, title, bookings, inbox, pricing, money, analytics, marketing, team } = v3Features;

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
        <div className="relative flex h-full flex-col p-5 sm:p-7">{children}</div>
      </div>
    </Reveal>
  );
}

function CellCopy({ heading, body }: { heading: string; body: string }) {
  return (
    <div>
      <h3 className="text-foreground text-lg font-bold tracking-tight sm:text-xl">{heading}</h3>
      <p className="text-muted-foreground mt-1.5 max-w-md text-sm leading-relaxed sm:text-[15px]">
        {body}
      </p>
    </div>
  );
}

/** Instagram thread that plays in once the tile is on screen: guest asks, Kame answers. */
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
    <div
      ref={ref}
      className="border-border bg-background -mx-1 mt-6 flex flex-1 flex-col rounded-2xl border sm:mx-0"
    >
      <div className="border-border flex items-center gap-2 border-b px-4 py-3">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-pink-500/15 text-pink-600 dark:text-pink-300">
          <Instagram className="h-3.5 w-3.5" aria-hidden />
        </span>
        <span className="text-foreground text-sm font-semibold">{inbox.guest}</span>
        <Pill tone="teal" className="ml-auto">
          {inbox.mode}
        </Pill>
      </div>
      <div className="flex flex-1 flex-col justify-end space-y-2.5 p-4">
        <motion.p
          {...bubble(0.2)}
          className="bg-muted text-foreground w-fit max-w-[85%] rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm"
        >
          {inbox.question}
        </motion.p>
        <motion.div {...bubble(0.9)} className="flex items-end justify-end gap-2">
          <p className="bg-primary w-fit max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2.5 text-sm text-white">
            {inbox.answer}
          </p>
          <span
            className="h-7 w-7 shrink-0 overflow-hidden rounded-full"
            style={{ backgroundColor: TURTLE_PLATE_COLOR }}
          >
            <img src={TURTLE_IDLE_POSTER_SRC} alt="" className="h-full w-full object-cover" />
          </span>
        </motion.div>
        <motion.p
          {...bubble(1.6)}
          className="bg-muted text-foreground w-fit max-w-[85%] rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm"
        >
          {inbox.followUp}
        </motion.p>
      </div>
    </div>
  );
}

const CHANNELS = [
  { label: 'Website chat', icon: Globe },
  { label: 'Facebook', icon: Facebook },
  { label: 'Instagram', icon: Instagram },
  { label: 'Voice calls', icon: PhoneCall },
];

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
      className="mt-4 h-20 w-full"
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

/** Occupancy ring that fills to the sample value once on screen. */
function OccupancyRing() {
  const reduceMotion = useReducedMotion();
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const fraction = analytics.occupancy / 100;

  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg ref={ref} viewBox="0 0 36 36" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="18" cy="18" r="15.5" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
        <motion.circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="3"
          strokeLinecap="round"
          initial={reduceMotion ? false : { pathLength: 0 }}
          animate={inView || reduceMotion ? { pathLength: fraction } : undefined}
          transition={{ duration: 1.2, ease: EASE }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-foreground text-xl font-bold tabular-nums tracking-tight">
          {analytics.occupancy}%
        </span>
        <span className="text-muted-foreground text-[10px] font-medium">Occupancy</span>
      </div>
    </div>
  );
}

export function V3FeatureBento() {
  return (
    <section id="features" className="scroll-mt-20 py-20 sm:py-24 lg:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <V3SectionHeading eyebrow={eyebrow} title={title} />

        <div className="mt-10 grid gap-4 sm:mt-12 md:grid-cols-6 lg:grid-cols-12 lg:gap-5">
          {/* Bookings: live board demo */}
          <BentoCell className="md:col-span-6 lg:col-span-7">
            <CellCopy heading={bookings.title} body={bookings.body} />
            <div className="mt-4 flex flex-wrap gap-1.5">
              {bookings.tags.map((tag) => (
                <Pill key={tag} tone="teal">
                  {tag}
                </Pill>
              ))}
            </div>
            <div className="border-border bg-background -mx-1 mt-6 h-[320px] rounded-2xl border p-3 sm:mx-0 sm:h-[340px] sm:p-4">
              <BookingsDemo />
            </div>
          </BentoCell>

          {/* Inbox + receptionist */}
          <BentoCell delay={0.06} className="md:col-span-6 lg:col-span-5">
            <div className="flex items-center gap-4">
              <div
                className="h-16 w-16 shrink-0 overflow-hidden rounded-full"
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
              <ul className="flex gap-1.5" aria-label="Channels">
                {CHANNELS.map(({ label, icon: Icon }) => (
                  <li
                    key={label}
                    className="border-border text-muted-foreground flex h-9 w-9 items-center justify-center rounded-full border"
                    title={label}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    <span className="sr-only">{label}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-5">
              <CellCopy heading={inbox.title} body={inbox.body} />
            </div>
            <ReceptionistChat />
          </BentoCell>

          {/* Pricing */}
          <BentoCell className="md:col-span-3 lg:col-span-4">
            <CellCopy heading={pricing.title} body={pricing.body} />
            <div className="mt-auto pt-6">
              <div className="grid grid-cols-7 gap-1">
                {pricing.week.map((night, index) => (
                  <div
                    key={index}
                    className={cn(
                      'relative flex flex-col items-center rounded-lg py-2',
                      night.booked ? 'bg-primary/10' : 'bg-muted/60',
                      'smart' in night && night.smart && 'ring-primary ring-2 ring-offset-0'
                    )}
                  >
                    <span className="text-muted-foreground text-[10px] font-semibold">
                      {night.day}
                    </span>
                    <span
                      className={cn(
                        'mt-0.5 text-[11px] font-bold tabular-nums',
                        night.booked ? 'text-primary' : 'text-foreground'
                      )}
                    >
                      {night.rate}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <Pill tone="teal">
                  <Sparkles className="h-3 w-3" aria-hidden />
                  {pricing.suggestion.label} {pricing.suggestion.value}
                </Pill>
                <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <RefreshCw className="text-primary h-3.5 w-3.5" aria-hidden />
                  Airbnb in sync
                </span>
              </div>
            </div>
          </BentoCell>

          {/* Finance */}
          <BentoCell delay={0.06} className="md:col-span-3 lg:col-span-4">
            <CellCopy heading={money.title} body={money.body} />
            <div className="mt-auto pt-6">
              <p className="text-muted-foreground text-xs font-semibold">{money.kpiLabel}</p>
              <p className="mt-1 flex items-baseline gap-2">
                <span className="text-foreground text-2xl font-bold tabular-nums tracking-tight">
                  {money.kpiValue}
                </span>
                <span className="text-success text-xs font-semibold">{money.kpiDelta}</span>
              </p>
              <MoneyChart />
            </div>
          </BentoCell>

          {/* Analytics */}
          <BentoCell delay={0.12} className="md:col-span-6 lg:col-span-4">
            <CellCopy heading={analytics.title} body={analytics.body} />
            <div className="mt-auto flex items-center gap-4 pt-6">
              <OccupancyRing />
              <div className="bg-muted/60 min-w-0 flex-1 rounded-xl p-3">
                <p className="text-primary flex items-center gap-1.5 text-[11px] font-semibold">
                  <Sparkles className="h-3 w-3" aria-hidden />
                  AI review
                </p>
                <p className="text-foreground mt-1 text-xs leading-relaxed sm:text-[13px]">
                  {analytics.tip}
                </p>
              </div>
            </div>
          </BentoCell>

          {/* Content Studio */}
          <BentoCell className="md:col-span-6 lg:col-span-7">
            <div className="grid h-full gap-6 sm:grid-cols-[1fr_1.1fr] sm:items-end">
              <div className="flex h-full flex-col">
                <CellCopy heading={marketing.title} body={marketing.body} />
                <div className="bg-muted mt-5 inline-flex w-fit rounded-full p-1 sm:mt-auto">
                  {marketing.modes.map((mode, index) => (
                    <span
                      key={mode}
                      className={cn(
                        'rounded-full px-3 py-1.5 text-xs font-semibold',
                        index === 1 ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                      )}
                    >
                      {mode}
                    </span>
                  ))}
                </div>
              </div>
              <div className="border-border bg-background overflow-hidden rounded-2xl border">
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

          {/* Team */}
          <BentoCell delay={0.06} className="md:col-span-6 lg:col-span-5">
            <CellCopy heading={team.title} body={team.body} />
            <ul className="divide-border border-border mt-6 divide-y rounded-2xl border">
              {team.members.map((member) => (
                <li key={member.name} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold">
                    {member.initials}
                  </span>
                  <span className="text-foreground text-sm font-medium">{member.name}</span>
                  <span className="text-muted-foreground ml-auto text-xs">{member.role}</span>
                </li>
              ))}
            </ul>
            <p className="border-border bg-background mt-3 flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-xs">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-300">
                <Send className="h-3 w-3" aria-hidden />
              </span>
              <span className="text-foreground min-w-0 truncate">{team.alert}</span>
              <span className="text-muted-foreground ml-auto shrink-0">now</span>
            </p>
          </BentoCell>
        </div>
      </div>
    </section>
  );
}
