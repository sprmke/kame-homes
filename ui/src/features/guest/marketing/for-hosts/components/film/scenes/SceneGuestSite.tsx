import type { ReactNode } from 'react';

import {
  BedDouble,
  Check,
  ChevronLeft,
  Gift,
  Heart,
  KeyRound,
  Lock,
  MapPin,
  MessageCircle,
  PhoneCall,
  Search,
  Send,
  Star,
  Users,
  Waves,
  Wifi,
} from 'lucide-react';
import { useCurrentFrame } from 'remotion';

import {
  Btn,
  CARD,
  Cursor,
  ease,
  Field,
  FilmScene,
  PhoneFrame,
  PhotoTile,
  popIn,
  reveal,
  typewriter,
} from '@/features/guest/marketing/for-hosts/components/film/FilmPrimitives';
import { FILM_ORG_NAME } from '@/features/guest/marketing/for-hosts/components/film/FilmShell';

import { cn } from '@/lib/utils';

/** Minimal browser chrome: what a guest sees, not the host dashboard. */
function BrowserChrome({ path, children }: { path: string; children: ReactNode }) {
  return (
    <div className="bg-background flex h-full w-full flex-col">
      <div className="border-border bg-muted/60 flex h-11 shrink-0 items-center gap-3 border-b px-4">
        <div className="flex gap-1.5">
          <span className="size-3 rounded-full bg-rose-400" />
          <span className="size-3 rounded-full bg-amber-400" />
          <span className="size-3 rounded-full bg-emerald-400" />
        </div>
        <div className="bg-background text-muted-foreground mx-auto flex h-7 w-[460px] items-center gap-2 rounded-lg px-3 text-[13px]">
          <Lock className="size-3.5" />
          {path}
        </div>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

function Rating({ value = '4.9', count }: { value?: string; count?: string }) {
  return (
    <span className="text-foreground inline-flex items-center gap-1 text-sm font-semibold">
      <Star className="size-4 fill-amber-400 text-amber-400" />
      {value}
      {count ? <span className="text-muted-foreground font-normal">({count})</span> : null}
    </span>
  );
}

/* ---------------- Search → listing → book ---------------- */

const RESULTS = [
  { name: 'Monaco 2604', meta: 'Pasay · 1 bedroom', price: '₱3,200', variant: 2 },
  { name: 'Aspen 1710', meta: 'Pasay · Studio', price: '₱2,600', variant: 1 },
  { name: 'Vista 0912', meta: 'Parañaque · 2 bedrooms', price: '₱4,100', variant: 3 },
];

const FORM_STEPS = ['Stay', 'Guest', 'Pets', 'Parking', 'Payment'];

export function GuestBookingScene() {
  const frame = useCurrentFrame();
  const onListing = frame >= 58;
  const datesPicked = frame >= 112;
  const formOpen = frame >= 156;

  return (
    <FilmScene
      camera={[
        { at: 0, x: 0.5, y: 0.5, zoom: 1 },
        { at: 56, x: 0.5, y: 0.5, zoom: 1.03 },
        { at: 130, x: 0.72, y: 0.5, zoom: 1.12 },
        { at: 190, x: 0.5, y: 0.48, zoom: 1.06 },
      ]}
    >
      <BrowserChrome path={onListing ? 'properties/monaco-2604' : 'search?where=Pasay'}>
        {!onListing ? (
          <div className="px-10 py-7" style={reveal(frame, 0)}>
            <div className="border-border mx-auto flex w-[640px] items-center gap-3 rounded-full border px-5 py-3 shadow-sm">
              <Search className="text-muted-foreground size-4" />
              <span className="text-foreground text-sm font-semibold">Pasay</span>
              <span className="bg-border h-4 w-px" />
              <span className="text-muted-foreground text-sm">Oct 21 – 23</span>
              <span className="bg-border h-4 w-px" />
              <span className="text-muted-foreground text-sm">2 guests</span>
            </div>
            <p className="text-foreground mt-7 text-lg font-bold">3 stays in Pasay</p>
            <div className="mt-4 grid grid-cols-3 gap-5">
              {RESULTS.map((result, index) => (
                <div key={result.name} style={reveal(frame, 6 + index * 5)}>
                  <PhotoTile
                    variant={result.variant}
                    className={cn(
                      'h-[230px]',
                      index === 0 && frame >= 46 && 'ring-primary ring-2 ring-offset-2'
                    )}
                  >
                    <span className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-white/90">
                      <Heart
                        className={cn(
                          'size-4',
                          index === 0 ? 'fill-rose-500 text-rose-500' : 'text-slate-700'
                        )}
                      />
                    </span>
                  </PhotoTile>
                  <div className="mt-2.5 flex items-start justify-between">
                    <div>
                      <p className="text-foreground text-[15px] font-semibold">{result.name}</p>
                      <p className="text-muted-foreground text-[13px]">{result.meta}</p>
                    </div>
                    <Rating />
                  </div>
                  <p className="text-foreground mt-1 text-sm">
                    <span className="font-semibold">{result.price}</span>
                    <span className="text-muted-foreground"> night</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="px-10 py-6" style={reveal(frame, 58, 8)}>
            <div className="grid h-[260px] grid-cols-[1.6fr_1fr_1fr] grid-rows-2 gap-2 overflow-hidden rounded-2xl">
              <PhotoTile variant={2} className="row-span-2 rounded-none" />
              <PhotoTile variant={0} className="rounded-none" />
              <PhotoTile variant={1} className="rounded-none" />
              <PhotoTile variant={3} className="rounded-none" />
              <PhotoTile variant={0} className="rounded-none" />
            </div>
            <div className="mt-5 grid grid-cols-[1fr_340px] gap-8">
              <div>
                <h2 className="text-foreground text-2xl font-bold tracking-tight">Monaco 2604</h2>
                <p className="text-muted-foreground mt-1 flex items-center gap-3 text-sm">
                  <span className="flex items-center gap-1">
                    <MapPin className="size-4" /> Pasay
                  </span>
                  <span className="flex items-center gap-1">
                    <BedDouble className="size-4" /> 1 bedroom
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="size-4" /> 4 guests
                  </span>
                  <Rating count="128 reviews" />
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {[
                    [Waves, 'Pool'],
                    [Wifi, 'Fast Wi-Fi'],
                    [KeyRound, 'Self check-in'],
                  ].map(([Icon, label]) => {
                    const I = Icon as typeof Waves;
                    return (
                      <span
                        key={label as string}
                        className="border-border text-foreground flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium"
                      >
                        <I className="text-primary size-4" /> {label as string}
                      </span>
                    );
                  })}
                </div>
                <div className={cn(CARD, 'mt-4 flex items-center gap-3 p-3.5')}>
                  <span className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-full text-sm font-bold">
                    A
                  </span>
                  <div className="flex-1">
                    <p className="text-foreground text-sm font-semibold">
                      Hosted by {FILM_ORG_NAME}
                    </p>
                    <p className="text-muted-foreground text-xs">Replies within an hour</p>
                  </div>
                  <Btn className="h-9" icon={MessageCircle}>
                    Contact host
                  </Btn>
                </div>
              </div>

              <div className={cn(CARD, 'p-5 shadow-lg')}>
                <p className="text-foreground text-xl font-bold">
                  ₱3,200 <span className="text-muted-foreground text-sm font-normal">night</span>
                </p>
                <div className="border-border mt-3 grid grid-cols-2 overflow-hidden rounded-xl border">
                  <div className="border-border border-r p-2.5">
                    <p className="text-muted-foreground text-[10px] font-bold uppercase">
                      Check-in
                    </p>
                    <p className="text-foreground text-sm">{frame >= 96 ? 'Oct 21' : 'Add date'}</p>
                  </div>
                  <div className="p-2.5">
                    <p className="text-muted-foreground text-[10px] font-bold uppercase">
                      Check-out
                    </p>
                    <p className="text-foreground text-sm">{datesPicked ? 'Oct 23' : 'Add date'}</p>
                  </div>
                </div>
                {datesPicked ? (
                  <div
                    className="text-foreground mt-3 space-y-1.5 text-sm"
                    style={reveal(frame, 112, 6)}
                  >
                    <p className="flex justify-between">
                      <span className="text-muted-foreground">₱3,200 × 2 nights</span>₱6,400
                    </p>
                    <p className="flex justify-between">
                      <span className="text-muted-foreground">Cleaning fee</span>₱800
                    </p>
                    <p className="border-border flex justify-between border-t pt-1.5 font-semibold">
                      <span>Total</span>₱7,200
                    </p>
                  </div>
                ) : (
                  <div className="mt-3 grid grid-cols-7 gap-1" style={reveal(frame, 70, 6)}>
                    {Array.from({ length: 21 }, (_, index) => {
                      const date = index + 11;
                      const taken = date === 18 || date === 19;
                      const picked = (date === 21 && frame >= 96) || date === 23;
                      return (
                        <span
                          key={date}
                          className={cn(
                            'flex h-7 items-center justify-center rounded-md text-[11px] font-medium',
                            taken && 'text-muted-foreground/50 line-through',
                            picked && date === 21 && 'bg-primary text-primary-foreground',
                            !taken && !(picked && date === 21) && 'text-foreground'
                          )}
                        >
                          {date}
                        </span>
                      );
                    })}
                  </div>
                )}
                <span className="bg-primary text-primary-foreground mt-4 flex h-11 items-center justify-center rounded-xl text-sm font-semibold">
                  Reserve
                </span>
              </div>
            </div>
          </div>
        )}

        {formOpen ? (
          <>
            <div
              className="absolute inset-0 bg-slate-950/40"
              style={{ opacity: ease(frame, 156, 166) }}
            />
            <div
              className="border-border bg-card absolute left-[300px] top-[60px] w-[620px] rounded-2xl border p-6 shadow-2xl"
              style={popIn(frame, 158)}
            >
              <p className="text-foreground text-lg font-bold">Book Monaco 2604</p>
              <p className="text-muted-foreground text-sm">Oct 21 – 23 · 2 guests</p>
              <div className="mt-4 flex gap-1.5">
                {FORM_STEPS.map((step, index) => (
                  <div key={step} className="flex-1">
                    <div
                      className={cn('h-1.5 rounded-full', index <= 1 ? 'bg-primary' : 'bg-muted')}
                    />
                    <p
                      className={cn(
                        'mt-1.5 text-xs font-semibold',
                        index === 1 ? 'text-foreground' : 'text-muted-foreground'
                      )}
                    >
                      {step}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-5 grid grid-cols-2 gap-4">
                <Field
                  className="col-span-2"
                  label="Full name"
                  value={typewriter('Ana Lim', frame, 172, 192)}
                  caret={frame < 194}
                />
                <Field label="Phone" value="0917 555 0142" />
                <Field label="Nationality" value="Filipino" />
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <Btn>Back</Btn>
                <Btn variant="primary">Continue</Btn>
              </div>
            </div>
          </>
        ) : null}
      </BrowserChrome>

      <Cursor
        path={[
          { at: 22, x: 520, y: 400 },
          { at: 50, x: 300, y: 260, click: true },
          { at: 88, x: 1020, y: 500 },
          { at: 96, x: 1052, y: 508, click: true },
          { at: 110, x: 1138, y: 508, click: true },
          { at: 150, x: 1052, y: 590, click: true },
          { at: 200, x: 820, y: 420 },
        ]}
      />
    </FilmScene>
  );
}

/* ---------------- Stay guide, messages, review + voucher ---------------- */

function PhoneHeader({ title }: { title: string }) {
  return (
    <div className="border-border bg-background flex items-center gap-2 border-b px-4 pb-3 pt-10">
      <ChevronLeft className="text-muted-foreground size-4" />
      <p className="text-foreground text-sm font-semibold">{title}</p>
    </div>
  );
}

const VOUCHER_CODE = 'STAY-7Q4K';

export function GuestJourneyScene() {
  const frame = useCurrentFrame();
  const stars = Math.min(5, Math.max(0, Math.floor((frame - 118) / 5)));
  // Slot reels spin, then each character lands left to right.
  const spinChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const voucher = VOUCHER_CODE.split('')
    .map((char, index) => {
      if (char === '-') return char;
      const landsAt = 168 + index * 3;
      return frame >= landsAt ? char : spinChars[(frame * 7 + index * 11) % spinChars.length];
    })
    .join('');

  return (
    <FilmScene
      camera={[
        { at: 0, x: 0.5, y: 0.5, zoom: 1 },
        { at: 200, x: 0.5, y: 0.48, zoom: 1.05 },
      ]}
    >
      <div className="bg-muted/40 flex h-full w-full items-center justify-center gap-10 pb-16">
        {/* 1 · Stay guide */}
        <div className="flex flex-col items-center gap-3" style={reveal(frame, 0, 16)}>
          <PhoneFrame className="h-[520px] w-[264px]">
            <div className="flex h-full flex-col">
              <PhotoTile variant={2} className="h-[190px] shrink-0 rounded-none">
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <div className="absolute inset-x-4 bottom-4 text-white">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/80">
                    Stay guide
                  </p>
                  <p className="text-xl font-bold leading-tight">Welcome, Kyle</p>
                </div>
              </PhotoTile>
              <div className="space-y-2.5 p-3">
                <div
                  className="bg-primary text-primary-foreground rounded-xl p-3"
                  style={reveal(frame, 16)}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">
                    Stay pass
                  </p>
                  <p className="text-sm font-semibold">Oct 14 – 17 · Monaco 2604</p>
                  <p className="text-xs opacity-90">Check-in 2:00 PM · Check-out 12:00 PM</p>
                </div>
                {[
                  [Wifi, 'Wi-Fi', 'MonacoGuest'],
                  [KeyRound, 'Door code', 'Sent on check-in day'],
                  [MapPin, 'Parking', 'Basement B2-14'],
                ].map(([Icon, label, value], index) => {
                  const I = Icon as typeof Wifi;
                  return (
                    <div
                      key={label as string}
                      className="border-border flex items-center gap-2.5 rounded-xl border p-2.5"
                      style={reveal(frame, 26 + index * 7)}
                    >
                      <I className="text-primary size-4" />
                      <div>
                        <p className="text-foreground text-xs font-semibold">{label as string}</p>
                        <p className="text-muted-foreground text-[11px]">{value as string}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </PhoneFrame>
          <p className="text-foreground text-sm font-semibold">Stay guide</p>
        </div>

        {/* 2 · Messages */}
        <div className="flex flex-col items-center gap-3" style={reveal(frame, 40, 16)}>
          <PhoneFrame className="h-[520px] w-[264px]">
            <div className="flex h-full flex-col">
              <PhoneHeader title={FILM_ORG_NAME} />
              <div className="bg-muted/40 flex flex-1 flex-col justify-end gap-2 p-3">
                {[
                  { at: 52, guest: true, text: 'Can we check in early?' },
                  { at: 70, guest: false, text: 'Yes! The unit is ready by 12 PM.' },
                  { at: 88, guest: true, text: 'Perfect, thank you!' },
                ].map((message) => (
                  <div
                    key={message.text}
                    className={cn(
                      'max-w-[190px] rounded-2xl px-3 py-2 text-xs',
                      message.guest
                        ? 'bg-primary text-primary-foreground ml-auto rounded-br-md'
                        : 'bg-background text-foreground rounded-bl-md shadow-sm'
                    )}
                    style={reveal(frame, message.at, 10)}
                  >
                    {message.text}
                  </div>
                ))}
              </div>
              <div className="border-border space-y-2 border-t p-3">
                <span className="border-primary/40 text-primary flex h-9 items-center justify-center gap-1.5 rounded-xl border text-xs font-semibold">
                  <PhoneCall className="size-3.5" /> Talk to receptionist
                </span>
                <div className="border-input text-muted-foreground flex h-9 items-center justify-between rounded-xl border px-3 text-xs">
                  Message
                  <Send className="text-primary size-3.5" />
                </div>
              </div>
            </div>
          </PhoneFrame>
          <p className="text-foreground text-sm font-semibold">Chat with you</p>
        </div>

        {/* 3 · Review + voucher */}
        <div className="flex flex-col items-center gap-3" style={reveal(frame, 100, 16)}>
          <PhoneFrame className="h-[520px] w-[264px]">
            <div className="flex h-full flex-col">
              <PhoneHeader title="Check-out" />
              <div className="flex-1 space-y-4 p-4">
                <div className="flex gap-1.5 text-[11px] font-semibold">
                  {['Review', 'Surprise', 'Refund'].map((step, index) => (
                    <span
                      key={step}
                      className={cn(
                        'flex-1 rounded-full py-1 text-center',
                        index <= (frame >= 156 ? 1 : 0)
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {step}
                    </span>
                  ))}
                </div>
                <div>
                  <p className="text-foreground text-sm font-semibold">How was your stay?</p>
                  <div className="mt-2 flex gap-1.5">
                    {[0, 1, 2, 3, 4].map((star) => (
                      <Star
                        key={star}
                        className={cn(
                          'size-7',
                          star < stars
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-muted-foreground/40'
                        )}
                      />
                    ))}
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {['Clean', 'Great view', 'Easy check-in'].map((tag, index) => (
                      <span
                        key={tag}
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-[11px] font-medium',
                          frame >= 142 + index * 4
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-foreground'
                        )}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                {frame >= 156 ? (
                  <div
                    className="from-primary to-primary/70 text-primary-foreground rounded-2xl bg-gradient-to-br p-4 text-center shadow-lg"
                    style={popIn(frame, 156)}
                  >
                    <Gift className="mx-auto size-7" />
                    <p className="mt-1 text-sm font-semibold">You won a voucher</p>
                    <p className="mt-2 rounded-lg bg-white/20 py-2 font-mono text-lg font-bold tracking-[0.2em]">
                      {voucher}
                    </p>
                    <p className="mt-2 text-xs opacity-90">₱500 off your next stay</p>
                  </div>
                ) : null}
                {frame >= 196 ? (
                  <p
                    className="text-muted-foreground flex items-center gap-1.5 text-xs"
                    style={reveal(frame, 196)}
                  >
                    <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" /> Saved to
                    Vouchers in their account
                  </p>
                ) : null}
              </div>
            </div>
          </PhoneFrame>
          <p className="text-foreground text-sm font-semibold">Review and reward</p>
        </div>
      </div>
    </FilmScene>
  );
}
