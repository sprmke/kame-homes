import { BadgeCheck, CarFront, Check, FileText, KeyRound, MessageCircle, Wifi } from 'lucide-react';

import {
  journeyStayPhoto,
  type JourneyStepId,
} from '@/features/guest/marketing/guest-landing-v2/data/landingV2Content';

import { cn } from '@/lib/utils';

/**
 * Illustrative guest screens for the stay journey. Drawn in product tokens so they read as
 * the app, not a screenshot. Decorative: every step's meaning is in the adjacent text.
 */
export function V2JourneyScreen({ step, className }: { step: JourneyStepId; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('bg-background text-foreground flex h-full flex-col text-[13px]', className)}
    >
      {step === 'book' ? <BookScreen /> : null}
      {step === 'documents' ? <DocumentsScreen /> : null}
      {step === 'parking' ? <ParkingScreen /> : null}
      {step === 'arrive' ? <ArriveScreen /> : null}
    </div>
  );
}

function ScreenHeader({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="border-border/70 border-b px-4 pb-3 pt-5">
      <p className="text-muted-foreground text-[11px] font-medium">{meta}</p>
      <p className="mt-0.5 text-[15px] font-bold tracking-tight">{title}</p>
    </div>
  );
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
/** November 2026 starts on a Sunday; 30 days. */
const NOV_DAYS = Array.from({ length: 30 }, (_, i) => i + 1);
const RANGE = { from: 12, to: 15 };

function BookScreen() {
  return (
    <>
      <ScreenHeader title="Azure North Studio" meta="San Fernando, Pampanga" />
      <div className="relative mx-4 mt-3 h-24 overflow-hidden rounded-xl">
        <img
          src={journeyStayPhoto}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
      <div className="flex-1 px-4 pt-3">
        <p className="text-[12px] font-semibold">November 2026</p>
        <div className="mt-2 grid grid-cols-7 gap-y-1 text-center text-[11px]">
          {WEEKDAYS.map((d, i) => (
            <span key={i} className="text-muted-foreground pb-1 font-medium">
              {d}
            </span>
          ))}
          {NOV_DAYS.map((day) => {
            const inRange = day >= RANGE.from && day <= RANGE.to;
            const isEdge = day === RANGE.from || day === RANGE.to;
            return (
              <span
                key={day}
                className={cn(
                  'flex h-7 items-center justify-center tabular-nums',
                  inRange && 'bg-primary/[0.12]',
                  day === RANGE.from && 'rounded-l-full',
                  day === RANGE.to && 'rounded-r-full',
                  day < 6 && 'text-muted-foreground/50 line-through'
                )}
              >
                <span
                  className={cn(
                    'flex size-7 items-center justify-center rounded-full',
                    isEdge && 'bg-primary-strong text-primary-foreground font-semibold'
                  )}
                >
                  {day}
                </span>
              </span>
            );
          })}
        </div>
      </div>
      <div className="border-border/70 flex items-center justify-between border-t px-4 py-3">
        <div>
          <p className="text-muted-foreground text-[11px]">3 nights</p>
          <p className="font-bold tabular-nums">₱8,397</p>
        </div>
        <span className="bg-primary-strong text-primary-foreground rounded-full px-4 py-2 text-[12px] font-semibold">
          Book
        </span>
      </div>
    </>
  );
}

function DocRow({
  icon: Icon,
  label,
  state,
}: {
  icon: typeof FileText;
  label: string;
  state: string;
}) {
  return (
    <div className="border-border/70 flex items-center gap-3 rounded-xl border px-3 py-2.5">
      <span className="bg-muted flex size-8 items-center justify-center rounded-lg">
        <Icon className="size-4" />
      </span>
      <span className="flex-1 font-medium">{label}</span>
      <span className="text-primary flex items-center gap-1 text-[11px] font-semibold">
        <Check className="size-3.5" />
        {state}
      </span>
    </div>
  );
}

function DocumentsScreen() {
  return (
    <>
      <ScreenHeader title="Before you arrive" meta="Nov 12 to 15" />
      <div className="flex-1 space-y-2 px-4 pt-4">
        <DocRow icon={FileText} label="Valid ID" state="Sent" />
        <DocRow icon={FileText} label="Guest details" state="Sent" />
        <DocRow icon={CarFront} label="Vehicle details" state="Sent" />
        <div className="bg-primary/[0.08] border-primary/25 mt-4 rounded-2xl border p-3">
          <div className="flex items-center gap-2">
            <BadgeCheck className="text-primary size-5" />
            <p className="font-semibold">Building pass approved</p>
          </div>
          <p className="text-muted-foreground mt-1 text-[12px]">Show it at the lobby on arrival.</p>
        </div>
      </div>
      <div className="px-4 pb-4">
        <div className="bg-muted h-1.5 overflow-hidden rounded-full">
          <div className="bg-primary h-full w-full rounded-full" />
        </div>
        <p className="text-muted-foreground mt-2 text-[11px]">All set</p>
      </div>
    </>
  );
}

function ParkingScreen() {
  return (
    <>
      <ScreenHeader title="Add parking" meta="Same building" />
      <div className="flex-1 space-y-3 px-4 pt-4">
        <div className="border-border/70 relative overflow-hidden rounded-2xl border">
          <div className="bg-primary-strong text-primary-foreground flex items-center justify-between px-3 py-2.5">
            <span className="flex items-center gap-2 font-semibold">
              <CarFront className="size-4" />
              Bali tower
            </span>
            <span className="text-[11px] opacity-85">Inside tower</span>
          </div>
          <div className="bg-border/70 grid grid-cols-2 gap-px">
            <div className="bg-background px-3 py-2.5">
              <p className="text-muted-foreground text-[10px] uppercase tracking-wider">Level</p>
              <p className="text-lg font-bold">B1</p>
            </div>
            <div className="bg-background px-3 py-2.5">
              <p className="text-muted-foreground text-[10px] uppercase tracking-wider">Slot</p>
              <p className="text-lg font-bold">01</p>
            </div>
          </div>
        </div>
        <div className="border-border/70 flex items-center justify-between rounded-xl border px-3 py-2.5">
          <span className="font-medium">3 nights</span>
          <span className="font-semibold tabular-nums">₱900</span>
        </div>
        <p className="text-muted-foreground pt-1 text-[11px] font-semibold">Also open</p>
        {[
          { tower: 'Barbados', spot: 'B2 · Slot 12' },
          { tower: 'Monaco', spot: 'Ground · Slot 04' },
        ].map((slot) => (
          <div
            key={slot.tower}
            className="border-border/70 flex items-center gap-3 rounded-xl border border-dashed px-3 py-2.5"
          >
            <CarFront className="text-muted-foreground size-4" />
            <span className="flex-1">
              <span className="block font-medium">{slot.tower} tower</span>
              <span className="text-muted-foreground block text-[11px]">{slot.spot}</span>
            </span>
          </div>
        ))}
      </div>
      <div className="px-4 pb-4">
        <span className="bg-primary-strong text-primary-foreground flex h-10 items-center justify-center gap-1.5 rounded-full text-[12px] font-semibold">
          <Check className="size-4" />
          Added to your stay
        </span>
      </div>
    </>
  );
}

function ArriveScreen() {
  return (
    <>
      <ScreenHeader title="Your stay" meta="Check-in today, 2:00 PM" />
      <div className="grid grid-cols-3 gap-2 px-4 pt-4">
        {[
          { icon: KeyRound, label: 'Check-in' },
          { icon: Wifi, label: 'Wi-Fi' },
          { icon: MessageCircle, label: 'Host' },
        ].map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="border-border/70 flex flex-col items-center gap-1.5 rounded-xl border py-3"
          >
            <Icon className="text-primary size-4" />
            <span className="text-[11px] font-medium">{label}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-1 flex-col justify-end gap-2 px-4 pb-4">
        <p className="bg-muted max-w-[85%] rounded-2xl rounded-bl-md px-3 py-2">
          Welcome! The unit is ready. Your door code is in the stay guide.
        </p>
        <p className="bg-primary-strong text-primary-foreground ml-auto max-w-[70%] rounded-2xl rounded-br-md px-3 py-2">
          Perfect, see you at 2!
        </p>
      </div>
    </>
  );
}
