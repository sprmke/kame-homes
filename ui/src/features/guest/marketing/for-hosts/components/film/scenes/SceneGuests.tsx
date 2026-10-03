import {
  BedDouble,
  Check,
  Eye,
  Facebook,
  Globe,
  Instagram,
  MapPin,
  MessageCircle,
  Mic,
  PhoneCall,
  PhoneOff,
  Send,
  Sparkles,
  Star,
  Waves,
  Wifi,
} from 'lucide-react';
import { Img, useCurrentFrame, Video } from 'remotion';

import {
  blink,
  Btn,
  Card,
  CARD,
  Chip,
  Cursor,
  Field,
  FilmScene,
  PhoneFrame,
  PhotoTile,
  reveal,
  Segmented,
  Toggle,
  typewriter,
} from '@/features/guest/marketing/for-hosts/components/film/FilmPrimitives';
import { FilmShell } from '@/features/guest/marketing/for-hosts/components/film/FilmShell';

import { cn } from '@/lib/utils';

/* ---------------- Guest inbox ---------------- */

const THREADS = [
  { name: 'Ana Lim', preview: 'Is parking available for…', channel: 'instagram', time: '2m' },
  { name: 'Marco Cruz', preview: 'Thanks! See you Friday', channel: 'facebook', time: '18m' },
  { name: 'Web visitor', preview: 'Do you allow pets?', channel: 'web', time: '1h' },
  { name: 'Joy Tan', preview: 'Uploaded my ID', channel: 'facebook', time: '3h' },
];

const CHANNEL_ICON = { instagram: Instagram, facebook: Facebook, web: Globe } as const;
const CHANNEL_TONE = {
  instagram: 'bg-pink-500/15 text-pink-600 dark:text-pink-300',
  facebook: 'bg-blue-500/15 text-blue-600 dark:text-blue-300',
  web: 'bg-primary/10 text-primary',
} as const;

const DRAFT =
  'Hi Ana! Yes, a parking slot is free for Oct 21 to 23 at ₱350 a night. Want me to add it to your booking?';

export function GuestInboxScene() {
  const frame = useCurrentFrame();
  const sent = frame >= 150;
  return (
    <FilmScene
      camera={[
        { at: 0, x: 0.5, y: 0.5, zoom: 1 },
        { at: 70, x: 0.66, y: 0.56, zoom: 1.12 },
      ]}
    >
      <FilmShell context="property" active="Inbox" dense>
        <div className={cn(CARD, 'flex h-[560px] overflow-hidden')}>
          <div className="border-border w-[300px] shrink-0 border-r">
            <div className="border-border flex items-center justify-between border-b px-4 py-3.5">
              <p className="text-foreground text-base font-semibold">Inbox</p>
              <span className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
                Auto-reply <Toggle on={false} />
              </span>
            </div>
            {THREADS.map((thread, index) => {
              const Icon = CHANNEL_ICON[thread.channel as keyof typeof CHANNEL_ICON];
              return (
                <div
                  key={thread.name}
                  className={cn(
                    'border-border/60 flex gap-3 border-b px-4 py-3.5',
                    index === 0 && 'bg-primary/5'
                  )}
                  style={reveal(frame, 2 + index * 4)}
                >
                  <span
                    className={cn(
                      'flex size-9 shrink-0 items-center justify-center rounded-full',
                      CHANNEL_TONE[thread.channel as keyof typeof CHANNEL_TONE]
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between">
                      <p className="text-foreground text-sm font-semibold">{thread.name}</p>
                      <span className="text-muted-foreground text-xs">{thread.time}</span>
                    </div>
                    <p className="text-muted-foreground truncate text-xs">{thread.preview}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-1 flex-col">
            <div className="border-border flex items-center gap-3 border-b px-5 py-3">
              <p className="text-foreground text-base font-semibold">Ana Lim</p>
              <Chip tone="rose" icon={Instagram}>
                Instagram
              </Chip>
              <Chip tone="amber" className="ml-auto">
                Pending Review · Oct 21 – 23
              </Chip>
            </div>
            <div className="flex flex-1 flex-col justify-end gap-3 p-5">
              <div className="bg-muted text-foreground max-w-[420px] rounded-2xl rounded-bl-md px-4 py-2.5 text-sm">
                Hello! We just booked Monaco 2604 for Oct 21 to 23.
              </div>
              <div className="bg-primary/90 text-primary-foreground ml-auto max-w-[420px] rounded-2xl rounded-br-md px-4 py-2.5 text-sm">
                Welcome, Ana! We got it. Your guest form is next.
              </div>
              <div
                className="bg-muted text-foreground max-w-[420px] rounded-2xl rounded-bl-md px-4 py-2.5 text-sm"
                style={reveal(frame, 8)}
              >
                Hi! Is parking available for Oct 21 to 23? We’re bringing a car.
              </div>
              {sent ? (
                <div
                  className="bg-primary text-primary-foreground ml-auto max-w-[460px] rounded-2xl rounded-br-md px-4 py-2.5 text-sm"
                  style={reveal(frame, 150, 12)}
                >
                  {DRAFT}
                </div>
              ) : null}
            </div>
            <div className="border-border border-t p-4">
              {sent ? (
                <div className="border-input text-muted-foreground flex h-11 items-center rounded-xl border px-4 text-sm">
                  Write a reply…
                </div>
              ) : (
                <div
                  className="border-primary/40 bg-primary/5 rounded-xl border p-3.5"
                  style={reveal(frame, 30)}
                >
                  <p className="text-primary mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide">
                    <Sparkles className="size-3.5" /> AI suggested reply
                  </p>
                  <p className="text-foreground min-h-[42px] text-sm leading-relaxed">
                    {typewriter(DRAFT, frame, 40, 110)}
                    {frame < 112 ? (
                      <span
                        className="bg-primary ml-0.5 inline-block h-4 w-0.5 align-middle"
                        style={{ opacity: blink(frame) }}
                      />
                    ) : null}
                  </p>
                  <div className="mt-2.5 flex justify-end gap-2">
                    <Btn className="h-9">Edit</Btn>
                    <Btn variant="primary" icon={Send} className="h-9">
                      Send
                    </Btn>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </FilmShell>
      <Cursor
        path={[
          { at: 100, x: 900, y: 420 },
          { at: 142, x: 1186, y: 536, click: true },
          { at: 180, x: 1060, y: 450 },
        ]}
      />
    </FilmScene>
  );
}

/* ---------------- AI voice receptionist ---------------- */

const RECEPTIONIST_AVATAR = '/avatars/receptionist-turtle-idle.png';
/** Same talk loop the live receptionist plays while it speaks (see public/avatars/ATTRIBUTION.md). */
const RECEPTIONIST_TALK = '/avatars/receptionist-turtle-talk.mp4';

const CALL_LINES = [
  { at: 40, who: 'guest', text: 'What time is check-in?' },
  { at: 70, who: 'kame', text: 'Check-in starts at 2 PM. Your stay guide has the door code.' },
  { at: 118, who: 'guest', text: 'Is the pool open at night?' },
  { at: 146, who: 'kame', text: 'Yes, until 10 PM. Towels are in the hallway closet.' },
];

export function AiReceptionistScene() {
  const frame = useCurrentFrame();
  const speaking = CALL_LINES.some(
    (line) => line.who === 'kame' && frame >= line.at && frame < line.at + 40
  );
  return (
    <FilmScene
      camera={[
        { at: 0, x: 0.5, y: 0.5, zoom: 1 },
        { at: 60, x: 0.5, y: 0.5, zoom: 1.06 },
      ]}
    >
      <div className="bg-muted/40 flex h-full w-full items-center justify-center gap-14 px-14">
        <PhoneFrame style={reveal(frame, 0, 16)}>
          <Video
            src={RECEPTIONIST_TALK}
            muted
            loop
            className="absolute inset-0 size-full object-cover"
          />
          {/* Idle still covers the talk loop whenever Kame is listening. */}
          <Img
            src={RECEPTIONIST_AVATAR}
            className="absolute inset-0 size-full object-cover"
            style={{ opacity: speaking ? 0 : 1 }}
          />
          <div className="absolute inset-x-0 top-10 flex justify-center">
            <span className="rounded-full bg-black/55 px-3 py-1 text-xs font-semibold text-white">
              Kame · AI receptionist
            </span>
          </div>
          <div className="absolute inset-x-0 bottom-0 flex flex-col items-center bg-gradient-to-t from-black/75 via-black/40 to-transparent px-5 pb-8 pt-16">
            <div className="flex h-8 items-end gap-1">
              {Array.from({ length: 16 }, (_, index) => {
                const h = speaking ? 8 + Math.abs(Math.sin((frame + index * 7) / 4)) * 22 : 4;
                return (
                  <span key={index} className="w-1.5 rounded-full bg-white" style={{ height: h }} />
                );
              })}
            </div>
            <p className="mt-2 text-xs tabular-nums text-white/80">
              0:{String(Math.floor(frame / 30) + 12).padStart(2, '0')}
            </p>
            <div className="mt-4 flex gap-6">
              <span className="flex size-14 items-center justify-center rounded-full bg-white/25 text-white">
                <Mic className="size-6" />
              </span>
              <span className="flex size-14 items-center justify-center rounded-full bg-rose-500 text-white">
                <PhoneOff className="size-6" />
              </span>
            </div>
          </div>
        </PhoneFrame>

        <div className="w-[520px]">
          <div className="mb-4 flex items-center gap-2" style={reveal(frame, 6)}>
            <Chip tone="primary" icon={PhoneCall}>
              Live call
            </Chip>
            <span className="text-muted-foreground text-sm">
              Answers from your property details
            </span>
          </div>
          <div className="space-y-3">
            {CALL_LINES.map((line) => (
              <div
                key={line.text}
                className={cn(
                  'max-w-[440px] rounded-2xl px-4 py-3 text-[15px] leading-snug',
                  line.who === 'guest'
                    ? 'bg-card text-foreground border-border border'
                    : 'bg-primary text-primary-foreground ml-auto'
                )}
                style={reveal(frame, line.at, 12)}
              >
                {line.text}
              </div>
            ))}
          </div>
          <div
            className={cn(CARD, 'mt-5 flex items-center gap-3 p-3.5')}
            style={reveal(frame, 186)}
          >
            <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
              <MessageCircle className="size-[18px]" />
            </span>
            <p className="text-foreground flex-1 text-sm font-semibold">
              Transcript saved to your inbox
            </p>
            <Check className="size-4 text-emerald-600 dark:text-emerald-400" strokeWidth={3} />
          </div>
        </div>
      </div>
    </FilmScene>
  );
}

/* ---------------- Public pages editor ---------------- */

const SECTIONS = ['Hero', 'About', 'Amenities', 'Gallery', 'Reviews', 'Location'];
const HEADLINE = 'Sunset views over Manila Bay';

export function PublicPagesScene() {
  const frame = useCurrentFrame();
  const typed = typewriter(HEADLINE, frame, 30, 92);
  return (
    <FilmScene
      camera={[
        { at: 0, x: 0.5, y: 0.5, zoom: 1 },
        { at: 80, x: 0.74, y: 0.45, zoom: 1.14 },
      ]}
    >
      <FilmShell
        context="property"
        active="Public Pages"
        title="Public Pages"
        actions={
          <>
            <Segmented options={['Listing', 'Stay guide', 'Showcase']} active="Showcase" />
            <Btn icon={Eye}>View</Btn>
          </>
        }
      >
        <div className="grid grid-cols-[160px_1fr_1.25fr] gap-4">
          <Card className="p-2.5">
            {SECTIONS.map((section, index) => (
              <div
                key={section}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm font-medium',
                  index === 0 ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
                )}
              >
                {section}
              </div>
            ))}
          </Card>
          <Card className="space-y-4">
            <Field label="Headline" value={typed} caret={frame < 96} />
            <Field
              multiline
              label="Subheading"
              value="A bright 1-bedroom with a pool, fast Wi-Fi, and a balcony made for slow mornings."
            />
            <Field label="Button" value="Book your stay" />
          </Card>
          <div className={cn(CARD, 'overflow-hidden')}>
            <PhotoTile variant={2} className="h-[250px] rounded-none">
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <div className="absolute inset-x-5 bottom-5 text-white">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/80">
                  Monaco 2604 · Pasay
                </p>
                <p className="mt-1 min-h-[34px] text-[26px] font-bold leading-tight">
                  {typed || ' '}
                </p>
                <span className="mt-3 inline-flex rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-slate-900">
                  Book your stay
                </span>
              </div>
            </PhotoTile>
            <div className="flex gap-4 p-5">
              {[
                [Waves, 'Pool'],
                [Wifi, 'Fast Wi-Fi'],
                [BedDouble, '1 bedroom'],
                [MapPin, 'Near MOA'],
              ].map(([Icon, label]) => {
                const I = Icon as typeof Waves;
                return (
                  <span
                    key={label as string}
                    className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium"
                  >
                    <I className="text-primary size-4" /> {label as string}
                  </span>
                );
              })}
            </div>
            <div className="border-border mx-5 flex items-center gap-1 border-t pt-4 text-sm">
              {[0, 1, 2, 3, 4].map((star) => (
                <Star key={star} className="size-4 fill-amber-400 text-amber-400" />
              ))}
              <span className="text-foreground ml-1 font-semibold">4.9</span>
              <span className="text-muted-foreground">· 128 reviews</span>
            </div>
          </div>
        </div>
      </FilmShell>
    </FilmScene>
  );
}

/* ---------------- Email templates ---------------- */

const TEMPLATES = ['Booking received', 'Documents needed', 'Ready for check-in', 'Thank you'];

export function TemplatesScene() {
  const frame = useCurrentFrame();
  const preview = frame >= 96;
  const token = (text: string) => (
    <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 font-mono text-[12px] font-semibold">
      {text}
    </span>
  );
  return (
    <FilmScene
      camera={[
        { at: 0, x: 0.5, y: 0.5, zoom: 1 },
        { at: 70, x: 0.66, y: 0.5, zoom: 1.14 },
      ]}
    >
      <FilmShell
        context="property"
        active="Templates"
        title="Templates"
        subtitle="Emails and stay guide"
        actions={<Segmented options={['Edit', 'Preview']} active={preview ? 'Preview' : 'Edit'} />}
      >
        <div className="grid grid-cols-[240px_1fr] gap-4">
          <Card className="p-2.5">
            {TEMPLATES.map((template, index) => (
              <div
                key={template}
                className={cn(
                  'rounded-lg px-3 py-2.5 text-sm font-medium',
                  index === 2 ? 'bg-primary/10 text-primary' : 'text-foreground'
                )}
              >
                {template}
              </div>
            ))}
          </Card>
          <Card>
            <div className="border-border mb-4 border-b pb-4">
              <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                Subject
              </p>
              <p className="text-foreground mt-1 text-base font-semibold">
                {preview ? (
                  'You’re all set for Monaco 2604, Kyle!'
                ) : (
                  <>
                    You’re all set for {token('{{propertyName}}')}, {token('{{guestName}}')}!
                  </>
                )}
              </p>
            </div>
            <div
              className="text-foreground space-y-3 text-[15px] leading-relaxed"
              key={preview ? 'p' : 'e'}
              style={reveal(frame, preview ? 96 : 0, 6, 12)}
            >
              <p>Hi {preview ? 'Kyle' : token('{{guestName}}')},</p>
              <p>
                Your stay is confirmed for {preview ? 'Oct 14 to 17' : token('{{stayDates}}')}.
                Check-in starts at {preview ? '2:00 PM' : token('{{checkInTime}}')}.
              </p>
              <p>Your stay guide has the Wi-Fi password, parking, and house rules.</p>
              <span className="bg-primary text-primary-foreground inline-flex rounded-lg px-4 py-2 text-sm font-semibold">
                Open stay guide
              </span>
            </div>
          </Card>
        </div>
      </FilmShell>
      <Cursor
        path={[
          { at: 50, x: 900, y: 360 },
          { at: 90, x: 1206, y: 44, click: true },
          { at: 130, x: 960, y: 330 },
        ]}
      />
    </FilmScene>
  );
}
