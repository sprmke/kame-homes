import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarRange,
  Clapperboard,
  Globe,
  DollarSign,
  ImagePlus,
  Inbox,
  MessageSquare,
  PhoneCall,
  Smartphone,
  Sparkles,
  Tags,
  Users,
  Wrench,
} from 'lucide-react';
import { useCurrentFrame } from 'remotion';

import {
  Card,
  ease,
  FILM_HEIGHT,
  FILM_WIDTH,
  Kpi,
  reveal,
  useSceneDuration,
} from '@/features/guest/marketing/for-hosts/components/film/FilmPrimitives';
import { FilmShell } from '@/features/guest/marketing/for-hosts/components/film/FilmShell';

import { platformMarkInitial, platformWordmarkParts } from '@/lib/platformBranding';

const wordmark = platformWordmarkParts();
const markInitial = platformMarkInitial();

function BrandLockup({ frame, delay = 0 }: { frame: number; delay?: number }) {
  return (
    <div className="flex items-center gap-3" style={reveal(frame, delay)}>
      <span className="bg-primary text-primary-foreground flex size-12 items-center justify-center rounded-2xl text-xl font-black shadow-lg">
        {markInitial || 'K'}
      </span>
      <p className="text-foreground text-[28px] font-extrabold tracking-tight">
        {wordmark ? (
          <>
            {wordmark.primary}
            {wordmark.accent ? <span className="text-primary">{wordmark.accent}</span> : null}
          </>
        ) : (
          'Host workspace'
        )}
      </p>
    </div>
  );
}

function Backdrop() {
  return (
    <>
      <div
        className="bg-muted absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(620px circle at 0% 0%, hsl(var(--primary) / 0.16), transparent 70%), radial-gradient(640px circle at 100% 100%, hsl(var(--primary) / 0.1), transparent 70%)',
        }}
      />
    </>
  );
}

/* ---------------- Intro: hook + product peek ---------------- */

export function IntroScene() {
  const frame = useCurrentFrame();
  // The dashboard rises into view under the headline: product on screen within 2 seconds.
  const rise = ease(frame, 34, 96);
  const words = ['Your', 'rentals,', 'run', 'for', 'you.'];

  return (
    <div className="absolute inset-0 overflow-hidden">
      <Backdrop />
      <div className="absolute inset-x-0 top-[78px] flex flex-col items-center text-center">
        <BrandLockup frame={frame} />
        <h1 className="text-foreground mt-7 text-[64px] font-extrabold leading-[1.02] tracking-[-0.03em]">
          {words.map((word, index) => (
            <span
              key={word}
              className={index >= 2 ? 'text-primary' : undefined}
              style={{ ...reveal(frame, 10 + index * 5, 18), display: 'inline-block' }}
            >
              {word}
              {index < words.length - 1 ? ' ' : ''}
            </span>
          ))}
        </h1>
        <p className="text-muted-foreground mt-4 text-[20px]" style={reveal(frame, 40)}>
          Bookings, guests, money, and marketing in one simple workspace.
        </p>
      </div>

      <div
        className="border-border absolute left-1/2 overflow-hidden rounded-[18px] border shadow-[0_40px_90px_-25px_rgb(15_23_42_/_0.45)]"
        style={{
          width: FILM_WIDTH,
          height: FILM_HEIGHT,
          top: 372,
          opacity: rise,
          // Transform only (no animated `top`): the rise stays on the compositor.
          transform: `translate3d(-50%, ${(1 - rise) * 160}px, 0) scale(0.74)`,
          transformOrigin: '50% 0%',
          willChange: rise > 0 && rise < 1 ? 'transform, opacity' : undefined,
          transition:
            rise > 0 && rise < 1 ? 'transform 34ms linear, opacity 34ms linear' : undefined,
        }}
      >
        <FilmShell
          context="property"
          active="Dashboard"
          title="Dashboard"
          subtitle="Monaco 2604 · October 2026"
        >
          <div className="grid grid-cols-4 gap-4">
            <Kpi title="Revenue" value="₱184,650" icon={DollarSign} change="+12.4%" />
            <Kpi title="Bookings" value="18" icon={BookOpen} change="+3" />
            <Kpi title="Occupancy" value="74%" icon={BarChart3} change="+6 pts" />
            <Kpi title="Avg nightly rate" value="₱3,480" icon={Tags} change="+4.1%" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <Card className="h-[300px]" />
            <Card className="h-[300px]" />
          </div>
        </FilmShell>
      </div>
    </div>
  );
}

/* ---------------- Outro: recap + call to action ---------------- */

const RECAP = [
  { icon: BookOpen, label: 'Bookings' },
  { icon: Globe, label: 'Booking page' },
  { icon: Smartphone, label: 'Stay guide' },
  { icon: CalendarRange, label: 'Airbnb sync' },
  { icon: Tags, label: 'Smart Pricing' },
  { icon: DollarSign, label: 'Finance' },
  { icon: Wrench, label: 'Maintenance' },
  { icon: BarChart3, label: 'Analytics' },
  { icon: Inbox, label: 'Guest inbox' },
  { icon: PhoneCall, label: 'AI receptionist' },
  { icon: ImagePlus, label: 'AI photos' },
  { icon: Clapperboard, label: 'AI video' },
  { icon: Users, label: 'Team roles' },
  { icon: MessageSquare, label: 'AI mode' },
];

export function OutroScene() {
  const frame = useCurrentFrame();
  const duration = useSceneDuration();
  // Hold on the call to action, then fade toward the loop point.
  const fadeOut = 1 - ease(frame, duration - 18, duration);

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ opacity: fadeOut }}>
      <Backdrop />
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <BrandLockup frame={frame} />
        <h2
          className="text-foreground mt-7 text-[60px] font-extrabold leading-[1.04] tracking-[-0.03em]"
          style={reveal(frame, 8)}
        >
          Less busywork.
          <br />
          <span className="text-primary">More happy guests.</span>
        </h2>

        <div className="mt-9 flex max-w-[940px] flex-wrap justify-center gap-2.5">
          {RECAP.map(({ icon: Icon, label }, index) => (
            <span
              key={label}
              className="border-border bg-card text-foreground inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[15px] font-semibold shadow-sm"
              style={reveal(frame, 26 + index * 3, 8, 14)}
            >
              <Icon className="text-primary size-4" />
              {label}
            </span>
          ))}
        </div>

        <div className="mt-10 flex items-center gap-3" style={reveal(frame, 70)}>
          <span className="bg-primary text-primary-foreground inline-flex h-14 items-center gap-2 rounded-xl px-7 text-lg font-bold shadow-lg">
            Start free
            <ArrowRight className="size-5" />
          </span>
          <span className="text-muted-foreground inline-flex items-center gap-2 text-[17px] font-medium">
            <Sparkles className="text-primary size-4" />
            Set up in minutes
          </span>
        </div>
      </div>
    </div>
  );
}
