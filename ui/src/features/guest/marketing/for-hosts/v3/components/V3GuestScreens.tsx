import { useRef, type ComponentType, type ReactNode } from 'react';

import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from 'framer-motion';
import { BadgeCheck, CalendarDays, Car, Copy, MapPin, Send, Star, Wifi } from 'lucide-react';

import { Reveal } from '@/features/guest/marketing/for-hosts/preview/components/Reveal';
import { Pill } from '@/features/guest/marketing/for-hosts/preview/components/showcase/ShowcasePrimitives';
import { v3Guests, v3Images } from '@/features/guest/marketing/for-hosts/v3/data/hostLandingV3';
import { MarketingImage } from '@/features/guest/marketing/shared/components/MarketingImage';

import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

const { eyebrow, title, lead, screens, listing, guide, trip } = v3Guests;

function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[2.4rem] bg-zinc-900 p-2 shadow-[0_40px_80px_-30px_rgba(15,23,42,0.45)] ring-1 ring-black/5 dark:ring-white/10">
      <div className="bg-background relative aspect-[9/17] overflow-hidden rounded-[1.95rem]">
        <div
          aria-hidden
          className="absolute left-1/2 top-2 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-zinc-900"
        />
        <div className="flex h-full flex-col pt-9">{children}</div>
      </div>
    </div>
  );
}

function BookScreen() {
  return (
    <>
      <div className="relative mx-3 aspect-[4/3] overflow-hidden rounded-2xl">
        <MarketingImage src={v3Images.listing} alt="" fill className="object-cover" />
        <span className="text-foreground absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-semibold">
          <BadgeCheck className="text-primary h-3 w-3" aria-hidden />
          Verified
        </span>
      </div>
      <div className="flex flex-1 flex-col px-4 pt-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-foreground text-sm font-bold leading-tight">{listing.name}</p>
          <span className="text-foreground flex shrink-0 items-center gap-0.5 text-[11px] font-semibold">
            <Star className="h-3 w-3 fill-current" aria-hidden />
            {listing.rating}
          </span>
        </div>
        <p className="text-muted-foreground mt-1 flex items-center gap-1 text-[11px]">
          <MapPin className="h-3 w-3" aria-hidden />
          {listing.place}
        </p>
        <div className="border-border mt-3 grid grid-cols-2 rounded-xl border text-[10px]">
          <div className="border-border border-r px-2.5 py-2">
            <p className="text-muted-foreground font-semibold">Check-in</p>
            <p className="text-foreground mt-0.5 font-semibold">Nov 14</p>
          </div>
          <div className="px-2.5 py-2">
            <p className="text-muted-foreground font-semibold">Check-out</p>
            <p className="text-foreground mt-0.5 font-semibold">Nov 17</p>
          </div>
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 pb-4 pt-3">
          <div>
            <p className="text-foreground text-sm font-bold tabular-nums">
              {listing.rate}
              <span className="text-muted-foreground text-[10px] font-medium"> / night</span>
            </p>
            <p className="text-muted-foreground text-[10px] tabular-nums">
              {listing.nights} · {listing.total}
            </p>
          </div>
          <span className="bg-primary-strong rounded-full px-4 py-2 text-[11px] font-semibold text-white">
            Reserve
          </span>
        </div>
      </div>
    </>
  );
}

function GuideScreen() {
  return (
    <div className="flex flex-1 flex-col px-4">
      <p className="text-muted-foreground text-[10px] font-semibold">Stay guide</p>
      <p className="text-foreground text-base font-bold tracking-tight">{listing.name}</p>
      <div className="border-border mt-3 grid grid-cols-2 rounded-xl border text-[10px]">
        <div className="border-border border-r px-2.5 py-2">
          <p className="text-muted-foreground font-semibold">Check-in</p>
          <p className="text-foreground mt-0.5 font-semibold">{guide.checkIn}</p>
        </div>
        <div className="px-2.5 py-2">
          <p className="text-muted-foreground font-semibold">Check-out</p>
          <p className="text-foreground mt-0.5 font-semibold">{guide.checkOut}</p>
        </div>
      </div>
      <div className="bg-primary-strong mt-3 rounded-2xl p-3 text-white">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold text-white/80">
          <Wifi className="h-3 w-3" aria-hidden />
          Wi-Fi
        </p>
        <p className="mt-1 text-sm font-bold">{guide.wifi.network}</p>
        <p className="mt-0.5 flex items-center justify-between text-[11px] text-white/85">
          {guide.wifi.password}
          <Copy className="h-3 w-3" aria-hidden />
        </p>
      </div>
      <p className="text-foreground mt-4 text-[11px] font-bold">Getting in</p>
      <ol className="mt-2 space-y-2">
        {guide.steps.map((step, index) => (
          <li key={step} className="flex items-start gap-2 text-[11px]">
            <span className="bg-primary/10 text-primary flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold">
              {index + 1}
            </span>
            <span className="text-foreground leading-snug">{step}</span>
          </li>
        ))}
      </ol>
      <div className="border-border mb-4 mt-auto flex items-center gap-2 rounded-xl border px-2.5 py-2 text-[10px]">
        <Car className="text-primary h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="text-muted-foreground font-semibold">Parking</span>
        <span className="text-foreground ml-auto font-semibold">{guide.parking}</span>
      </div>
    </div>
  );
}

function TripScreen() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="border-border border-b px-4 pb-3">
        <p className="text-foreground text-base font-bold tracking-tight">Your trip</p>
        <p className="text-muted-foreground mt-0.5 flex items-center gap-1 text-[11px]">
          <CalendarDays className="h-3 w-3" aria-hidden />
          Nov 14 to 17 · {listing.name}
        </p>
        <Pill tone="teal" className="mt-2">
          {trip.status}
        </Pill>
        <div className="mt-2 flex gap-1" aria-hidden>
          {Array.from({ length: trip.progressSteps }, (_, step) => (
            <span
              key={step}
              className={cn(
                'h-1 flex-1 rounded-full',
                step < trip.progress ? 'bg-primary' : 'bg-border'
              )}
            />
          ))}
        </div>
      </div>
      <p className="text-muted-foreground px-4 pt-3 text-[10px] font-semibold">
        Chat with {trip.host}, your host
      </p>
      <div className="flex flex-1 flex-col justify-end gap-1.5 px-4 pt-2">
        {trip.messages.map((message) => (
          <p
            key={message.text}
            className={cn(
              'w-fit max-w-[85%] rounded-2xl px-3 py-2 text-[11px] leading-snug',
              message.from === 'guest'
                ? 'bg-primary-strong ml-auto rounded-br-md text-white'
                : 'bg-muted text-foreground rounded-bl-md'
            )}
          >
            {message.text}
          </p>
        ))}
      </div>
      <div className="border-border mx-3 mb-4 mt-3 flex items-center gap-2 rounded-full border py-1.5 pl-3 pr-1.5">
        <span className="text-muted-foreground flex-1 text-[10px]">Message</span>
        <span className="bg-primary-strong flex h-6 w-6 items-center justify-center rounded-full text-white">
          <Send className="h-3 w-3" aria-hidden />
        </span>
      </div>
    </div>
  );
}

const SCREENS: Record<string, ComponentType> = {
  book: BookScreen,
  guide: GuideScreen,
  trip: TripScreen,
};

/** Outer phones fan out and the middle one lifts as the section scrolls in (desktop only). */
function FannedPhone({
  index,
  progress,
  reduceMotion,
  children,
}: {
  index: number;
  progress: MotionValue<number>;
  reduceMotion: boolean;
  children: ReactNode;
}) {
  const side = index - 1;
  const rotate = useTransform(progress, [0, 1], [0, side * 5]);
  const x = useTransform(progress, [0, 1], [side * -40, 0]);
  const y = useTransform(progress, [0, 1], side === 0 ? [60, -16] : [80, 24]);

  return (
    <motion.div
      style={reduceMotion ? undefined : { rotate, x, y }}
      className={cn('w-full', side === 0 && 'relative z-10')}
    >
      {children}
    </motion.div>
  );
}

/**
 * The guest side of the product: booking page, stay guide, and trip page, shown as three phones
 * on a soft light band. Phones fan out with scroll on `lg+`; below that they are a swipeable row.
 */
export function V3GuestScreens() {
  const prefersReduced = Boolean(useReducedMotion());
  const isBelowLg = useIsBelowLg();
  // The fan only reads on the three-up desktop row; the phone carousel stays still.
  const reduceMotion = prefersReduced || isBelowLg;
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'center 0.6'] });

  return (
    <section id="guests" className="scroll-mt-20 px-2 sm:px-4 lg:px-6">
      <div className="bg-card ring-border/70 relative mx-auto max-w-[96rem] overflow-hidden rounded-[2rem] py-20 ring-1 sm:py-24 lg:py-32">
        <div
          aria-hidden
          className="bg-primary/10 pointer-events-none absolute left-1/2 top-1/2 h-[28rem] w-[min(56rem,90%)] -translate-x-1/2 rounded-full blur-3xl"
        />
        <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-primary text-sm font-semibold">{eyebrow}</p>
            <h2 className="text-foreground mt-3 text-balance text-3xl font-bold tracking-[-0.025em] sm:text-4xl lg:text-[2.75rem] lg:leading-[1.08]">
              {title}
            </h2>
            <p className="text-muted-foreground mx-auto mt-4 max-w-lg leading-relaxed sm:text-lg">
              {lead}
            </p>
          </Reveal>

          <div
            ref={ref}
            className="-mx-4 mt-12 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-4 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-auto lg:mt-16 lg:grid lg:max-w-4xl lg:grid-cols-3 lg:gap-8 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden"
          >
            {screens.map((screen, index) => {
              const Screen = SCREENS[screen.key];
              return (
                <div
                  key={screen.key}
                  className="w-[68%] max-w-[16rem] shrink-0 snap-center sm:w-[38%] lg:mx-auto lg:w-full lg:max-w-[16.5rem]"
                >
                  <FannedPhone index={index} progress={scrollYProgress} reduceMotion={reduceMotion}>
                    <PhoneFrame>
                      <Screen />
                    </PhoneFrame>
                  </FannedPhone>
                  <div className="mt-8 text-center lg:mt-14">
                    <h3 className="text-foreground text-base font-bold sm:text-lg">
                      {screen.title}
                    </h3>
                    <p className="text-muted-foreground mt-1 text-sm">{screen.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
