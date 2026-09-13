import {
  Calendar,
  Check,
  Clapperboard,
  Facebook,
  FileText,
  Globe,
  Instagram,
  LayoutGrid,
  Mic,
  PhoneOff,
  Play,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  Wand2,
  Zap,
} from 'lucide-react';
import { Img, Video, useCurrentFrame } from 'remotion';

import {
  blink,
  Cursor,
  grow,
  PushIn,
  reveal,
  SceneHeading,
  SceneOutro,
  stepAt,
  StatusPill,
  TierBadge,
  typewriter,
} from '@/features/guest/marketing/for-hosts/components/film/FilmPrimitives';
import { FilmShell } from '@/features/guest/marketing/for-hosts/components/film/FilmShell';

import { cn } from '@/lib/utils';

/* ---------------- 10. Guest inbox — AI suggest + auto-reply ---------------- */

export function GuestInboxScene() {
  const frame = useCurrentFrame();

  const suggestion =
    'Early check-in from 12:30 PM works for your dates. I’ve added it to your booking. See you then!';
  const suggestTyped = typewriter(suggestion, frame, 44, 124);
  const sent = frame >= 136;
  const autoOn = frame >= 152;
  const secondMsg = frame >= 176;
  const autoReply =
    'The Wi-Fi is “Monaco-2604”, password “skyline88”. It’s also in your stay guide.';
  const autoTyped = typewriter(autoReply, frame, 200, 286);

  return (
    <FilmShell activeLabel="Inbox">
      <PushIn>
        <SceneHeading
          eyebrow="Unified guest inbox"
          title="AI suggests the reply, or sends it for you"
          frame={frame}
          action={
            <div
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-bold',
                autoOn
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
              )}
              style={reveal(frame, 90)}
            >
              <Zap className="h-3.5 w-3.5" />
              {autoOn ? 'Auto-reply on' : 'Auto-reply off'}
              <TierBadge tier="Business" />
            </div>
          }
        />

        <div
          className="grid h-[492px] grid-cols-[0.68fr_1.4fr] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
          style={reveal(frame, 8)}
        >
          <div className="border-r border-slate-200 p-3 dark:border-slate-700">
            <div className="mb-3 rounded-xl bg-slate-100 px-3 py-2 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              Search conversations
            </div>
            {[
              ['AR', 'Ana Reyes', 'Wi-Fi password please?', 'Now', 'Chat', true],
              ['KS', 'Kyle Soriano', 'Thanks for the details!', '8m', 'Facebook', false],
              ['MT', 'Mia Tan', 'Parking receipt attached', '24m', 'Instagram', false],
              ['JL', 'Jon Lim', 'What time is check-out?', '1h', 'Chat', false],
            ].map(([initials, name, message, time, channel, active]) => (
              <div
                key={String(name)}
                className={cn(
                  'mb-1 flex gap-2.5 rounded-xl p-2.5',
                  active && 'bg-teal-50 dark:bg-teal-500/15'
                )}
              >
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                    active
                      ? 'bg-teal-600 text-white'
                      : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                  )}
                >
                  {String(initials)}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[11px] font-bold text-slate-700 dark:text-slate-200">
                      {String(name)}
                    </p>
                    <span className="ml-auto text-[8px] text-slate-400 dark:text-slate-500">
                      {String(time)}
                    </span>
                  </div>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-[9px] text-slate-500 dark:text-slate-400">
                    <span className="rounded bg-slate-100 px-1 text-[7px] font-bold uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      {String(channel)}
                    </span>
                    {String(message)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex min-w-0 flex-col bg-slate-50/60 dark:bg-slate-950/40">
            <div className="flex h-14 items-center border-b border-slate-200 bg-white px-5 dark:border-slate-700 dark:bg-slate-900">
              <div>
                <p className="text-[13px] font-black">Ana Reyes</p>
                <p className="text-[9px] text-slate-500 dark:text-slate-400">
                  Web chat · Monaco 2604
                </p>
              </div>
              <span
                className={cn(
                  'ml-auto flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-bold',
                  autoOn
                    ? 'bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300'
                    : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                )}
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    autoOn ? 'bg-teal-500' : 'bg-emerald-500'
                  )}
                />
                {autoOn ? 'AI auto-replying' : 'Online'}
              </span>
            </div>

            <div className="flex-1 space-y-2.5 p-5">
              <div
                className="max-w-[62%] rounded-2xl rounded-bl-md bg-white p-3 text-[11px] leading-relaxed shadow-sm dark:bg-slate-900"
                style={reveal(frame, 16)}
              >
                Hi! Our flight lands early — any chance of checking in before 2 PM?
              </div>

              {!sent ? (
                <div className="ml-auto max-w-[80%]" style={reveal(frame, 40)}>
                  <div className="mb-1.5 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-teal-600 dark:text-teal-300">
                    <Sparkles className="h-3 w-3" /> AI suggested reply
                  </div>
                  <div className="rounded-2xl border border-teal-200 bg-teal-50 p-3 text-[11px] leading-relaxed text-teal-950 shadow-sm dark:border-teal-500/30 dark:bg-teal-500/15 dark:text-teal-100">
                    {suggestTyped}
                    {frame < 126 ? (
                      <span
                        className="ml-0.5 inline-block h-3 w-0.5 bg-teal-600"
                        style={{ opacity: blink(frame) }}
                      />
                    ) : null}
                  </div>
                  <div className="mt-1.5 flex justify-end gap-1.5">
                    <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[9px] font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                      Edit
                    </span>
                    <span className="rounded-md bg-teal-600 px-2 py-1 text-[9px] font-bold text-white">
                      Use &amp; send
                    </span>
                  </div>
                </div>
              ) : (
                <div
                  className="ml-auto max-w-[70%] rounded-2xl rounded-br-md bg-teal-600 p-3 text-[11px] leading-relaxed text-white shadow-sm"
                  style={reveal(frame, 136)}
                >
                  {suggestion}
                </div>
              )}

              {secondMsg ? (
                <div
                  className="max-w-[52%] rounded-2xl rounded-bl-md bg-white p-3 text-[11px] leading-relaxed shadow-sm dark:bg-slate-900"
                  style={reveal(frame, 176)}
                >
                  Perfect. Also — what’s the Wi-Fi?
                </div>
              ) : null}

              {frame >= 194 ? (
                <div className="ml-auto max-w-[80%]" style={reveal(frame, 194)}>
                  <div className="mb-1.5 flex items-center justify-end gap-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-teal-600 dark:text-teal-300">
                    <Zap className="h-3 w-3" /> Auto-replied · 0.8s
                  </div>
                  <div className="rounded-2xl rounded-br-md bg-teal-600 p-3 text-[11px] leading-relaxed text-white shadow-sm">
                    {autoTyped}
                    {frame >= 200 && frame < 288 ? (
                      <span
                        className="ml-0.5 inline-block h-3 w-0.5 bg-white/80"
                        style={{ opacity: blink(frame) }}
                      />
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="m-4 flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[10px] text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <Plus className="h-3.5 w-3.5" />
              </span>
              {autoOn
                ? 'AI is handling replies. Jump in any time'
                : 'Insert Stay Guide · Approved GAF · SD refund link'}
              <button
                className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg bg-teal-600 text-white"
                type="button"
                tabIndex={-1}
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </PushIn>
      <Cursor from={[620, 470]} to={[1010, 236]} moveStart={122} moveEnd={134} clickAt={136} />
      <SceneOutro text="Review the AI's draft, or let it reply on its own." />
    </FilmShell>
  );
}

/* ---------------- 11. AI voice receptionist (Kame) ---------------- */

const TURTLE_IDLE_SRC = '/avatars/receptionist-turtle-idle.png';
const TURTLE_TALK_SRC = '/avatars/receptionist-turtle-talk.mp4';

export function AiReceptionistScene() {
  const frame = useCurrentFrame();

  const guestSpeaking = frame >= 34 && frame < 96;
  const thinking = frame >= 96 && frame < 112;
  // Kame talks for the rest of the scene, so the video avatar is on-screen and moving
  // for most of the chapter (including the reduced-motion hold frame).
  const kameActive = frame >= 112;
  const showVideo = frame >= 104;
  const status = guestSpeaking
    ? "You're speaking"
    : thinking
      ? 'Thinking…'
      : kameActive
        ? 'Speaking'
        : frame < 34
          ? 'Connecting…'
          : 'Listening';

  const settle = grow(frame, 0, 1, 12, 30);
  const active = guestSpeaking || kameActive;
  const amp = (active ? 0.42 + 0.42 * Math.abs(Math.sin(frame * 0.42)) : 0.12) * settle;
  const bars = Array.from({ length: 26 }, (_, i) => {
    const a = 0.28 + 0.72 * Math.abs(Math.sin(frame * 0.4 + i * 0.55));
    return (active ? a : 0.16) * settle;
  });

  const guestLine = 'Hi Kame, what time is check-in, and where do I park?';
  const kameLine =
    'Check-in is from 2 PM, and your stay includes one parking slot on Level 3. Want me to note an early arrival?';
  const guestTyped = typewriter(guestLine, frame, 34, 92);
  const kameTyped = typewriter(kameLine, frame, 116, 272);

  const secsLeft = Math.max(0, 300 - Math.floor(frame / 30));
  const countdown = `${Math.floor(secsLeft / 60)}:${String(secsLeft % 60).padStart(2, '0')}`;
  const boothTransform = `translateY(${kameActive ? -amp : 0}px) scale(${1.2 + (kameActive ? amp * 0.02 : 0)})`;

  return (
    <FilmShell activeLabel="Settings">
      <PushIn>
        <SceneHeading
          eyebrow="AI voice receptionist"
          title="Meet Kame, your guests’ voice receptionist"
          frame={frame}
          action={<StatusPill label="Business plan" tone="amber" />}
        />

        <div className="grid grid-cols-[0.72fr_1.6fr] gap-4">
          <div
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
            style={reveal(frame, 8)}
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600 dark:bg-teal-500/15 dark:text-teal-300">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[12px] font-black text-slate-800 dark:text-slate-100">
                  Voice Receptionist
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">
                  Settings · Monaco 2604
                </p>
              </div>
              <span className="ml-auto flex h-5 w-9 items-center rounded-full bg-teal-500 px-0.5">
                <span className="ml-auto h-4 w-4 rounded-full bg-white shadow" />
              </span>
            </div>
            <div className="mt-4 space-y-2.5">
              {[
                ['Persona', 'Kame · the turtle'],
                ['Voice', 'Warm · friendly'],
                ['Reachable from', 'Stay guide & chat'],
              ].map(([label, value], index) => (
                <div key={label} style={reveal(frame, 16 + index * 6, 6)}>
                  <p className="mb-1 text-[9px] font-semibold text-slate-400 dark:text-slate-500">
                    {label}
                  </p>
                  <div className="truncate rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
                    {value}
                  </div>
                </div>
              ))}
              <div
                className="flex items-center gap-2 rounded-lg bg-teal-50 px-3 py-2 text-[10px] font-semibold text-teal-700 dark:bg-teal-500/15 dark:text-teal-300"
                style={reveal(frame, 40, 6)}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Speaks from your property details
              </div>
              {frame > 250 ? (
                <div
                  className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-semibold text-slate-500 dark:border-slate-700 dark:text-slate-400"
                  style={reveal(frame, 252, 6)}
                >
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                  Transcript saved to the booking
                </div>
              ) : null}
            </div>
          </div>

          <div
            className="flex flex-col items-center overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
            style={reveal(frame, 16)}
          >
            <div className="flex w-full items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-2.5 dark:border-slate-800 dark:bg-slate-800/50">
              <span className="w-12 text-[10px] font-bold tabular-nums text-slate-400 dark:text-slate-500">
                {countdown}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-teal-600 dark:text-teal-300">
                {status}
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 dark:text-slate-500">
                <PhoneOff className="h-4 w-4" />
              </span>
            </div>

            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 py-4">
              <div className="relative h-[212px] w-[212px]" style={reveal(frame, 20, 6)}>
                <svg
                  viewBox="0 0 100 100"
                  className="absolute inset-0 h-full w-full text-teal-500 dark:text-teal-400"
                >
                  <circle
                    cx="50"
                    cy="50"
                    r="47"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={kameActive ? 1.5 + amp * 2.5 : 1.5}
                    strokeOpacity={active ? 0.35 + amp * 0.5 : 0.4}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-[10px] overflow-hidden rounded-full bg-[#B8E0C8] ring-1 ring-teal-500/25">
                  <Img
                    src={TURTLE_IDLE_SRC}
                    className="absolute inset-0 h-full w-full object-cover"
                    style={{
                      objectPosition: '50% 46%',
                      transform: boothTransform,
                      transformOrigin: '50% 5%',
                      opacity: showVideo ? 0 : 1,
                    }}
                  />
                  <Video
                    src={TURTLE_TALK_SRC}
                    muted
                    className="absolute inset-0 h-full w-full object-cover"
                    style={{
                      objectPosition: '50% 46%',
                      transform: boothTransform,
                      transformOrigin: '50% 5%',
                      opacity: showVideo ? 1 : 0,
                    }}
                  />
                </div>
              </div>

              <div className="text-center" style={reveal(frame, 26, 6)}>
                <p className="text-[12px] font-black text-slate-800 dark:text-slate-100">
                  Kame · Receptionist
                </p>
                <p className="text-[9px] text-slate-400 dark:text-slate-500">
                  Live voice · Monaco 2604 stay guide
                </p>
              </div>

              <div className="flex h-6 items-end gap-[3px]">
                {bars.map((h, i) => (
                  <span
                    key={i}
                    className="w-[3px] rounded-full bg-teal-500"
                    style={{ height: `${Math.max(3, h * 22)}px` }}
                  />
                ))}
              </div>

              <div className="flex w-full max-w-[460px] flex-col gap-2 pt-1">
                <div
                  className="w-fit max-w-[85%] self-end rounded-2xl rounded-br-md bg-teal-600 px-3 py-2 text-[11px] leading-snug text-white"
                  style={reveal(frame, 30)}
                >
                  {guestTyped}
                  {frame >= 34 && frame < 96 ? (
                    <span
                      className="ml-0.5 inline-block h-3 w-0.5 bg-white/80"
                      style={{ opacity: blink(frame) }}
                    />
                  ) : null}
                </div>
                {frame >= 112 ? (
                  <div
                    className="w-fit max-w-[90%] self-start rounded-2xl rounded-bl-md border border-slate-200 bg-white px-3 py-2 text-[11px] leading-snug text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    style={reveal(frame, 112)}
                  >
                    {kameTyped}
                    {frame >= 116 && frame < 274 ? (
                      <span
                        className="ml-0.5 inline-block h-3 w-0.5 bg-teal-600"
                        style={{ opacity: blink(frame) }}
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex w-full items-center justify-center gap-3 border-t border-slate-100 bg-white px-5 py-2.5 dark:border-slate-800 dark:bg-slate-900">
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-teal-500/40 text-slate-600 dark:text-slate-300">
                <Mic className="h-4 w-4" />
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-500 text-white">
                <PhoneOff className="h-4 w-4" />
              </span>
            </div>
          </div>
        </div>
      </PushIn>
      <SceneOutro text="Kame answers from your property details, and saves the transcript." />
    </FilmShell>
  );
}

/* ---------------- 12. Marketing Content Studio ---------------- */

const STUDIO_MODES = [
  {
    label: 'Calendar',
    icon: Calendar,
    templates: ['Sweet Social', 'Botanical', 'Photo Story', 'Twilight', 'Paper & Ink'],
  },
  {
    label: 'Design',
    icon: LayoutGrid,
    templates: ['₱500 off', 'Last 3 slots', 'Free breakfast', 'Giveaway', 'Fully booked'],
  },
  {
    label: 'Video',
    icon: Clapperboard,
    templates: ['Soft stay', 'Flash deal', 'Last openings', 'Guest love', 'Ber months'],
  },
];

export function MarketingStudioScene() {
  const frame = useCurrentFrame();
  const mode = stepAt(frame, 20, 262, 3);
  const saveStage = stepAt(frame, 26, 96, 3);
  const saveLabel = ['Unsaved', 'Saving…', 'Saved'][saveStage];
  const publishOn = frame > 252;
  const activeTpl = 1;

  return (
    <FilmShell activeLabel="Marketing">
      <PushIn>
        <SceneHeading
          eyebrow="Marketing Content Studio"
          title="Calendars, graphics, and videos in one studio"
          frame={frame}
        />

        <div
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
          style={reveal(frame, 8)}
        >
          {/* Builder top bar */}
          <div className="flex items-center gap-2 border-b border-slate-100 bg-white px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900">
            <span className="text-[11px] font-black text-slate-800 dark:text-slate-100">
              {STUDIO_MODES[mode].label} Builder
            </span>
            <div className="ml-3 flex items-center gap-1">
              {STUDIO_MODES.map((m, index) => (
                <div
                  key={m.label}
                  className={cn(
                    'flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-bold',
                    index === mode ? 'bg-teal-600 text-white' : 'text-slate-400 dark:text-slate-500'
                  )}
                >
                  <m.icon className="h-3.5 w-3.5" />
                  {m.label}
                </div>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-2 py-1 text-[9px] font-bold',
                  saveStage === 2
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                )}
              >
                {saveStage === 2 ? <Check className="h-3 w-3" /> : null}
                {saveLabel}
              </span>
              <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[9px] font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                Download {mode === 2 ? 'MP4' : 'PNG'}
              </span>
              <span
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[9px] font-black',
                  publishOn
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                )}
              >
                {publishOn ? <Check className="h-3 w-3" /> : <Send className="h-3 w-3" />}
                {publishOn ? 'Scheduled' : 'Publish'}
                <TierBadge tier="Business" />
              </span>
            </div>
          </div>

          <div className="grid h-[392px] grid-cols-[0.66fr_1.7fr_0.64fr]">
            {/* Templates sidebar */}
            <div className="flex flex-col border-r border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800">
              <div className="mb-2.5 flex items-center gap-1.5 rounded-lg bg-teal-50 px-2.5 py-1.5 text-[9px] font-bold text-teal-700 dark:bg-teal-500/15 dark:text-teal-300">
                <Wand2 className="h-3 w-3" /> Generate with AI <TierBadge tier="Business" />
              </div>
              <p className="mb-1.5 px-0.5 text-[8px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Custom
              </p>
              <div className="mb-2 flex items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-2.5 py-2 text-[9px] font-bold text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500">
                <Plus className="h-3 w-3" /> Save template
              </div>
              <p className="mb-1.5 px-0.5 text-[8px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Templates
              </p>
              <div className="space-y-1.5">
                {STUDIO_MODES[mode].templates.map((name, i) => (
                  <div
                    key={name}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border px-2 py-1.5',
                      i === activeTpl
                        ? 'border-teal-400 bg-white shadow-sm dark:border-teal-500/50 dark:bg-slate-900'
                        : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
                    )}
                  >
                    <span
                      className={cn(
                        'h-6 w-6 shrink-0 rounded',
                        i % 3 === 0
                          ? 'bg-gradient-to-br from-teal-300 to-emerald-200'
                          : i % 3 === 1
                            ? 'bg-gradient-to-br from-rose-200 to-amber-200'
                            : 'bg-gradient-to-br from-indigo-200 to-slate-200'
                      )}
                    />
                    <span className="truncate text-[9px] font-bold text-slate-600 dark:text-slate-300">
                      {name}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Canvas — a white "Live Preview" workspace that swaps per mode */}
            <div className="flex flex-col bg-slate-100/70 dark:bg-slate-800/40">
              <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-1.5 text-[8px] font-bold text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500">
                <span className="flex items-center gap-1.5">
                  <RotateCcw className="h-2.5 w-2.5" /> Undo · Redo · Reset
                </span>
                <span className="ml-auto rounded bg-slate-100 px-1.5 py-0.5 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  100%
                </span>
              </div>
              <div className="flex flex-1 items-center justify-center p-5">
                {mode === 0 ? (
                  <div className="w-full max-w-[300px] rounded-2xl border border-slate-200 bg-[#f6f3ee] p-4 shadow-md">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[12px] font-black tracking-tight text-slate-800">
                        Monaco 2604
                      </p>
                      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">
                        August
                      </p>
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {Array.from({ length: 28 }, (_, i) => {
                        const day = i + 1;
                        const booked = [4, 5, 6, 12, 13, 19, 20].includes(day);
                        return (
                          <div
                            key={i}
                            className={cn(
                              'flex aspect-square items-center justify-center rounded-full text-[8px] font-bold',
                              booked ? 'bg-[#e7c9c9] text-[#9a5b5b]' : 'bg-[#cfe6d8] text-[#3f7a5f]'
                            )}
                          >
                            {day}
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-3 flex items-center justify-between text-[8px] font-bold">
                      <span className="flex items-center gap-1 text-[#3f7a5f]">
                        <i className="inline-block h-2 w-2 rounded-full bg-[#cfe6d8]" /> Available
                      </span>
                      <span className="flex items-center gap-1 text-[#9a5b5b]">
                        <i className="inline-block h-2 w-2 rounded-full bg-[#e7c9c9]" /> Booked
                      </span>
                      <span className="rounded-full bg-white px-2 py-0.5 text-slate-500 shadow-sm">
                        from ₱2,799
                      </span>
                    </div>
                  </div>
                ) : mode === 1 ? (
                  <div className="relative aspect-square w-full max-w-[264px] overflow-hidden rounded-2xl shadow-md">
                    <div className="absolute inset-0 bg-gradient-to-br from-teal-700 via-slate-700 to-slate-900" />
                    <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/70 to-transparent" />
                    <span className="absolute left-4 top-4 text-[8px] font-bold uppercase tracking-[0.22em] text-white/80">
                      Weekend escape
                    </span>
                    <div className="absolute inset-x-4 bottom-4 text-white">
                      <p className="text-[20px] font-black leading-[1.08]">
                        ₱500 off your next quiet weekend.
                      </p>
                      <span className="mt-2 inline-block rounded-full border border-white/70 px-3 py-1 text-[9px] font-bold">
                        Book direct →
                      </span>
                    </div>
                    <span className="absolute right-4 top-4 h-6 w-0.5 bg-teal-300" />
                  </div>
                ) : (
                  <div className="w-full max-w-[340px]">
                    <div className="relative aspect-video overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 via-teal-900 to-slate-800 shadow-md">
                      <span className="absolute left-3 top-3 rounded bg-black/40 px-2 py-0.5 text-[8px] font-bold text-white">
                        00:04 / 00:12
                      </span>
                      <span className="absolute inset-0 m-auto flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-teal-700 dark:text-teal-300">
                        <Play className="h-4 w-4 fill-current" />
                      </span>
                      <span className="absolute inset-x-4 bottom-3 text-[11px] font-black text-white/95">
                        Your quiet weekend, waiting.
                      </span>
                    </div>
                    <div className="mt-2 flex gap-1">
                      {['Open', 'Hook', 'Room', 'Deck', 'CTA'].map((label, i) => (
                        <div
                          key={label}
                          className={cn(
                            'flex h-9 flex-1 flex-col items-center justify-center rounded border text-[7px] font-bold',
                            i === 1
                              ? 'border-teal-400 bg-teal-50 text-teal-700 dark:border-teal-500/50 dark:bg-teal-500/15 dark:text-teal-300'
                              : 'border-slate-200 bg-white text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500'
                          )}
                        >
                          <span
                            className={cn(
                              'mb-0.5 h-3 w-full rounded-sm',
                              i % 2
                                ? 'bg-gradient-to-br from-teal-200 to-emerald-100'
                                : 'bg-slate-200 dark:bg-slate-700'
                            )}
                          />
                          {label}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Publish panel */}
            <div className="border-l border-slate-100 p-3 dark:border-slate-800">
              <p className="mb-2 text-[8px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Publish to
              </p>
              <div className="space-y-1.5">
                {[
                  ['Facebook Page', Facebook],
                  ['Instagram', Instagram],
                ].map(([label, Icon]) => (
                  <div
                    key={String(label)}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900"
                  >
                    {typeof Icon === 'function' ? (
                      <Icon className="h-3.5 w-3.5 text-teal-600 dark:text-teal-300" />
                    ) : null}
                    <span className="text-[9px] font-semibold text-slate-700 dark:text-slate-200">
                      {String(label)}
                    </span>
                    <Check className="ml-auto h-3.5 w-3.5 text-emerald-500" />
                  </div>
                ))}
              </div>
              <div className="mt-2.5 flex gap-1.5">
                {['Post', 'Story'].map((t, i) => (
                  <span
                    key={t}
                    className={cn(
                      'flex-1 rounded-md px-2 py-1 text-center text-[8px] font-bold',
                      i === 0
                        ? 'bg-teal-600 text-white'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    )}
                  >
                    {t}
                  </span>
                ))}
              </div>
              <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
                <div className="aspect-[4/3] rounded bg-gradient-to-br from-teal-500/25 to-emerald-500/15" />
                <p className="mt-1.5 flex items-center gap-1 text-[8px] font-semibold text-teal-600 dark:text-teal-300">
                  <Wand2 className="h-2.5 w-2.5" /> Caption drafted by AI
                </p>
              </div>
            </div>
          </div>
        </div>
      </PushIn>
      <SceneOutro text="Calendar, Design, and Video builders. Style with AI, publish to Meta." />
    </FilmShell>
  );
}

/* ---------------- 13. Public Pages editor ---------------- */

export function PublicPagesScene() {
  const frame = useCurrentFrame();
  const tabs = ['Listing page', 'Stay guide', 'Showcase'];
  const tab = stepAt(frame, 138, 208, 3);
  const sections = ['Hero', 'Description', 'Amenities', 'House rules', 'Location', 'Gallery'];
  const activeSection = stepAt(frame, 28, 138, sections.length);
  const templates = ['Aurora', 'Monolith', 'Editorial'];
  const activeTemplate = stepAt(frame, 168, 210, 3);
  const saved = frame > 126;
  const descTyped = typewriter(
    'A calm two-bedroom retreat with skyline views, fast Wi-Fi, and a pool deck two floors down.',
    frame,
    46,
    132
  );

  return (
    <FilmShell activeLabel="Public Pages">
      <PushIn>
        <SceneHeading
          eyebrow="Public pages editor"
          title="Edit your listing with a live preview"
          frame={frame}
          action={
            <span
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-bold',
                saved
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
              )}
              style={reveal(frame, 90)}
            >
              {saved ? <Check className="h-3.5 w-3.5" /> : null}
              {saved ? 'Saved' : 'Autosaving…'} <TierBadge tier="Pro" />
            </span>
          }
        />

        <div className="flex gap-1.5" style={reveal(frame, 6)}>
          {tabs.map((label, index) => (
            <span
              key={label}
              className={cn(
                'rounded-lg px-3 py-1.5 text-[10px] font-bold',
                index === tab
                  ? 'bg-teal-600 text-white'
                  : 'border border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'
              )}
            >
              {label}
            </span>
          ))}
        </div>

        <div className="mt-3 grid h-[452px] grid-cols-[0.5fr_1fr_1.15fr] gap-3">
          {/* Section list */}
          <div
            className="rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
            style={reveal(frame, 10)}
          >
            <p className="mb-2 px-1.5 text-[8px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Sections
            </p>
            {sections.map((s, index) => (
              <div
                key={s}
                className={cn(
                  'mb-1 flex items-center gap-2 rounded-lg px-2.5 py-2 text-[10px] font-bold',
                  index === activeSection
                    ? 'bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300'
                    : 'text-slate-500 dark:text-slate-400'
                )}
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    index === activeSection ? 'bg-teal-500' : 'bg-slate-300 dark:bg-slate-600'
                  )}
                />
                {s}
              </div>
            ))}
          </div>

          {/* Edit form */}
          <div
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
            style={reveal(frame, 16)}
          >
            <p className="text-[11px] font-black text-slate-800 dark:text-slate-100">
              {tab === 2 ? 'Showcase template' : sections[activeSection]}
            </p>
            {tab === 2 ? (
              <div className="mt-3 space-y-2">
                {templates.map((label, index) => (
                  <div
                    key={label}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border px-3 py-2.5 text-[10px] font-bold',
                      index === activeTemplate
                        ? 'border-teal-400 bg-teal-50 text-teal-700 dark:border-teal-500/50 dark:bg-teal-500/15 dark:text-teal-300'
                        : 'border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400'
                    )}
                  >
                    <span
                      className={cn(
                        'h-3 w-3 rounded-sm',
                        index === activeTemplate ? 'bg-teal-500' : 'bg-slate-200 dark:bg-slate-700'
                      )}
                    />
                    {label}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <div>
                  <p className="mb-1 text-[9px] font-semibold text-slate-400 dark:text-slate-500">
                    Headline
                  </p>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-[10px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-200">
                    Monaco 2604 — Azure North
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-[9px] font-semibold text-slate-400 dark:text-slate-500">
                    Description
                  </p>
                  <div className="min-h-[64px] rounded-lg border border-teal-300 bg-white px-2.5 py-2 text-[10px] leading-relaxed text-slate-700 dark:border-teal-500/40 dark:bg-slate-900 dark:text-slate-200">
                    {descTyped}
                    {frame >= 46 && frame < 134 ? (
                      <span
                        className="ml-0.5 inline-block h-3 w-0.5 bg-teal-600"
                        style={{ opacity: blink(frame) }}
                      />
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {['Pool', 'Wi-Fi 300M', 'Parking', 'Skyline view'].map((a) => (
                    <span
                      key={a}
                      className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-1 text-[8px] font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Live preview */}
          <div
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
            style={reveal(frame, 22)}
          >
            <div className="flex h-7 items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 dark:border-slate-800 dark:bg-slate-800/50">
              <span className="flex items-center gap-1 text-[9px] font-bold text-slate-500 dark:text-slate-400">
                <Globe className="h-3 w-3" /> Live preview
              </span>
              <span className="ml-auto rounded bg-white px-1.5 py-0.5 text-[8px] font-semibold text-teal-600 shadow-sm dark:bg-slate-900 dark:text-teal-300">
                Open ↗
              </span>
            </div>
            <div className="p-4">
              <div
                className={cn(
                  'h-36 rounded-xl',
                  tab === 2 && activeTemplate === 0
                    ? 'bg-gradient-to-br from-indigo-400/40 via-teal-300/40 to-amber-200/40'
                    : tab === 2 && activeTemplate === 1
                      ? 'bg-gradient-to-b from-slate-800 to-slate-500'
                      : tab === 2
                        ? 'bg-gradient-to-br from-amber-100 to-rose-100'
                        : 'bg-gradient-to-br from-teal-500/30 via-slate-200 to-slate-100'
                )}
              />
              <p className="mt-3 text-[14px] font-black tracking-tight text-slate-900 dark:text-slate-50">
                Monaco 2604 — Azure North
              </p>
              <p className="mt-1 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
                {descTyped}
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {['Pool', 'Wi-Fi 300M', 'Parking'].map((label) => (
                  <div
                    key={label}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-center text-[9px] font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300"
                  >
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </PushIn>
      <SceneOutro text="Listing, stay guide, and showcase. A live preview beside every edit." />
    </FilmShell>
  );
}

/* ---------------- 14. Templates — edit + preview ---------------- */

export function TemplatesScene() {
  const frame = useCurrentFrame();
  const groups = [
    { heading: 'Stay guide', items: ['House rules', 'Check-in', 'Check-out', 'Parking'] },
    {
      heading: 'Email',
      items: ['Ready for check-in', 'Booking acknowledgement', 'Document request'],
    },
  ];
  const flatCount = groups.reduce((n, g) => n + g.items.length, 0);
  const selected = stepAt(frame, 24, 138, flatCount);
  // Edit for the first ~half of the scene, Preview for the rest, with room to hold.
  const showPreview = frame >= 140;
  const resetPulse = frame >= 188;

  let flatIndex = -1;

  return (
    <FilmShell activeLabel="Templates">
      <PushIn>
        <SceneHeading
          eyebrow="Template management"
          title="Edit every message, and preview it first"
          frame={frame}
          action={
            <div className="flex gap-1.5" style={reveal(frame, 90)}>
              <span
                className={cn(
                  'rounded-md px-2 py-1 text-[9px] font-bold',
                  !showPreview
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                )}
              >
                Edit
              </span>
              <span
                className={cn(
                  'rounded-md px-2 py-1 text-[9px] font-bold',
                  showPreview
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                )}
              >
                Preview
              </span>
            </div>
          }
        />

        <div className="grid grid-cols-[0.8fr_1.4fr] gap-4">
          <div className="space-y-3">
            {groups.map((group) => (
              <div key={group.heading}>
                <p className="mb-1.5 px-1 text-[8px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {group.heading} templates
                </p>
                <div className="space-y-1.5">
                  {group.items.map((title) => {
                    flatIndex += 1;
                    const isActive = flatIndex === selected;
                    return (
                      <div
                        key={title}
                        className={cn(
                          'flex items-center gap-2 rounded-xl border bg-white p-2.5 shadow-sm dark:bg-slate-900',
                          isActive
                            ? 'border-teal-400 dark:border-teal-500/50'
                            : 'border-slate-200 dark:border-slate-700'
                        )}
                        style={reveal(frame, 10 + flatIndex * 8)}
                      >
                        <FileText
                          className={cn(
                            'h-3.5 w-3.5',
                            isActive
                              ? 'text-teal-600 dark:text-teal-300'
                              : 'text-slate-400 dark:text-slate-500'
                          )}
                        />
                        <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                          {title}
                        </p>
                        {group.heading === 'Email' ? (
                          <span className="ml-auto">
                            <TierBadge tier="Starter" />
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
            style={reveal(frame, 20)}
          >
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-black text-slate-800 dark:text-slate-100">
                Ready for check-in
              </p>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[8px] font-bold uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                Email
              </span>
              <span
                className={cn(
                  'ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-[9px] font-bold',
                  resetPulse
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                )}
              >
                <RotateCcw className="h-3 w-3" /> Reset to default
              </span>
            </div>

            {showPreview ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-inner dark:border-slate-700 dark:bg-slate-900">
                <p className="text-[13px] font-black text-slate-900 dark:text-slate-50">
                  Your stay is ready 🎉
                </p>
                <p className="mt-2 text-[10px] leading-relaxed text-slate-600 dark:text-slate-300">
                  Hi Ana, your check-in for Monaco 2604 is confirmed for Aug 14 at 2:00 PM. Your
                  door code and directions are in the stay guide below.
                </p>
                <div className="mt-3 rounded-lg bg-teal-50 px-3 py-2 text-[10px] font-bold text-teal-700 dark:bg-teal-500/15 dark:text-teal-300">
                  Open stay guide →
                </div>
                <p className="mt-3 text-[9px] text-slate-400 dark:text-slate-500">
                  - The Monaco 2604 team
                </p>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                <p className="text-[12px] font-black text-slate-800 dark:text-slate-100">
                  Your stay is ready 🎉
                </p>
                <p className="mt-2 text-[10px] leading-relaxed text-slate-600 dark:text-slate-300">
                  Hi{' '}
                  <span className="rounded bg-teal-100 px-1 font-bold text-teal-700 dark:bg-teal-500/20 dark:text-teal-200">
                    {'{{guest_name}}'}
                  </span>
                  , your check-in for{' '}
                  <span className="rounded bg-teal-100 px-1 font-bold text-teal-700 dark:bg-teal-500/20 dark:text-teal-200">
                    {'{{property_name}}'}
                  </span>{' '}
                  is confirmed for{' '}
                  <span className="rounded bg-teal-100 px-1 font-bold text-teal-700 dark:bg-teal-500/20 dark:text-teal-200">
                    {'{{check_in_date}}'}
                  </span>
                  .
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {['{{door_code}}', '{{stay_guide_link}}', '{{email_signature_section}}'].map(
                    (token) => (
                      <span
                        key={token}
                        className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[8px] font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
                      >
                        {token}
                      </span>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </PushIn>
      <SceneOutro text="Placeholders, a real preview, and reset-to-default on every template." />
    </FilmShell>
  );
}
