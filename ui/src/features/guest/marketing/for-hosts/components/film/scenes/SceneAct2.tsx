import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  FileCheck2,
  FileSpreadsheet,
  PawPrint,
  Plus,
  Receipt,
  RefreshCw,
  Send,
  Sparkles,
} from 'lucide-react';
import { Easing, interpolate, useCurrentFrame } from 'remotion';

import {
  Cursor,
  grow,
  PushIn,
  reveal,
  SceneHeading,
  SceneOutro,
  stepAt,
  StatusPill,
  TierBadge,
} from '@/features/guest/marketing/for-hosts/components/film/FilmPrimitives';
import { FilmShell } from '@/features/guest/marketing/for-hosts/components/film/FilmShell';

import { cn } from '@/lib/utils';

/* ---------------- 3. Booking workflow ---------------- */

export function BookingWorkflowScene() {
  const frame = useCurrentFrame();
  const steps = [
    'Pending review',
    'Pending documents',
    'Ready for check-in',
    'Ready for check-out',
    'Completed',
  ];
  const activeStep = stepAt(frame, 46, 272, steps.length);
  const summary = [
    ['Action required', '4', 'rose'],
    ['Pending docs', '2', 'amber'],
    ['Confirmed stays', '9', 'emerald'],
    ['History', '38', 'slate'],
  ] as const;

  return (
    <FilmShell activeLabel="Bookings">
      <PushIn>
        <SceneHeading
          eyebrow="Automated booking flow"
          title="Move every stay forward"
          frame={frame}
        />

        <div className="mb-3.5 grid grid-cols-4 gap-3">
          {summary.map(([label, count, tone], index) => (
            <div
              key={label}
              className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3.5 shadow-sm"
              style={reveal(frame, 6 + index * 6)}
            >
              <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">{label}</p>
              <p className="mt-1 text-[20px] font-black text-slate-900 dark:text-slate-50">{count}</p>
              <span
                className={cn(
                  'mt-1 inline-block h-1 w-8 rounded-full',
                  tone === 'rose'
                    ? 'bg-rose-400'
                    : tone === 'amber'
                      ? 'bg-amber-400'
                      : tone === 'emerald'
                        ? 'bg-emerald-400'
                        : 'bg-slate-300 dark:bg-slate-600'
                )}
              />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-[1.5fr_0.85fr] gap-4">
          <div
            className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm"
            style={reveal(frame, 26)}
          >
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-500/15 font-black text-teal-700 dark:text-teal-300">
                KS
              </div>
              <div>
                <p className="text-sm font-black">Kyle Soriano</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Jul 30 – Aug 2 · 4 guests · Facebook</p>
              </div>
              <span className="ml-auto rounded-full bg-amber-50 dark:bg-amber-500/15 px-3 py-1.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                Workflow active
              </span>
            </div>
            <div className="py-4">
              {steps.map((step, index) => {
                const complete = index < activeStep;
                const active = index === activeStep;
                return (
                  <div key={step} className="relative flex min-h-[52px] gap-4">
                    {index < steps.length - 1 ? (
                      <div
                        className={cn(
                          'absolute left-[15px] top-8 h-[28px] w-0.5',
                          complete ? 'bg-teal-500' : 'bg-slate-200 dark:bg-slate-700'
                        )}
                      />
                    ) : null}
                    <div
                      className={cn(
                        'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold',
                        complete && 'border-teal-500 dark:border-teal-400 bg-teal-500 text-white',
                        active &&
                          'border-teal-500 dark:border-teal-400 bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-300 shadow-lg shadow-teal-500/20',
                        !complete && !active && 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500'
                      )}
                    >
                      {complete ? <Check className="h-4 w-4" /> : index + 1}
                    </div>
                    <div className="pt-1">
                      <p
                        className={cn(
                          'text-[13px] font-bold',
                          active ? 'text-teal-700 dark:text-teal-300' : 'text-slate-700 dark:text-slate-200'
                        )}
                      >
                        {step}
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">
                        {complete
                          ? 'Done automatically'
                          : active
                            ? 'Working on this step'
                            : 'Queued'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-2.5">
            {[
              { icon: Receipt, label: 'Receipt validated', sub: 'AI confidence 98%', delay: 46 },
              {
                icon: FileCheck2,
                label: 'GAF approved',
                sub: 'Matched from inbound email',
                delay: 108,
              },
              { icon: PawPrint, label: 'Pet request cleared', sub: 'Document saved', delay: 160 },
              {
                icon: CalendarDays,
                label: 'Calendar updated',
                sub: 'Stay dates synced',
                delay: 208,
              },
              { icon: Send, label: 'Guest email sent', sub: 'Ready-for-check-in', delay: 250 },
            ].map((event) => (
              <div
                key={event.label}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3.5 shadow-sm"
                style={reveal(frame, event.delay, 20)}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-500/15 text-teal-600 dark:text-teal-300">
                  <event.icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-extrabold text-slate-800 dark:text-slate-100">{event.label}</p>
                  <p className="mt-0.5 text-[9px] text-slate-400 dark:text-slate-500">{event.sub}</p>
                </div>
                <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-500" />
              </div>
            ))}
          </div>
        </div>
      </PushIn>
      <SceneOutro text="Documents, receipts, calendar, and emails, handled as it moves." />
    </FilmShell>
  );
}

/* ---------------- 4. Bookings board (kanban + quick add) ---------------- */

const BOARD_COLUMNS = [
  { title: 'Action required', tone: 'rose', cards: ['Ana Reyes', 'Jon Lim'] },
  { title: 'Pending docs', tone: 'amber', cards: ['Mia Tan'] },
  { title: 'Confirmed', tone: 'emerald', cards: ['Kyle Soriano', 'Rae Cruz'] },
  { title: 'History', tone: 'slate', cards: ['Nico Yu'] },
] as const;

function toneDot(tone: string) {
  return tone === 'rose'
    ? 'bg-rose-500'
    : tone === 'amber'
      ? 'bg-amber-500'
      : tone === 'emerald'
        ? 'bg-emerald-500'
        : 'bg-slate-400';
}

export function BookingsBoardScene() {
  const frame = useCurrentFrame();

  // One card is dragged from "Action required" (col 0) to "Confirmed" (col 2) and lands
  // in the placeholder slot there — a single element, no teleport between columns.
  const drag = interpolate(frame, [30, 98], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
  const dropped = frame >= 100;
  const lift = Math.sin(drag * Math.PI); // 0 → 1 → 0 arc
  const cardLeftPct = interpolate(drag, [0, 1], [0.7, 51.2]);
  const cardTop = 150 - lift * 20;

  return (
    <FilmShell activeLabel="Bookings">
      <PushIn>
        <SceneHeading
          eyebrow="Work bookings your way"
          title="Drag a stay forward, or add one by hand"
          frame={frame}
          action={
            <span
              className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-2.5 py-1.5 text-[10px] font-bold text-white"
              style={reveal(frame, 90)}
            >
              <Plus className="h-3.5 w-3.5" /> New booking
            </span>
          }
        />

        <div className="relative grid grid-cols-4 gap-2.5" style={reveal(frame, 12)}>
          {BOARD_COLUMNS.map((column, columnIndex) => (
            <div
              key={column.title}
              className="min-h-[236px] rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-2.5"
            >
              <div className="mb-2 flex items-center gap-1.5">
                <span className={cn('h-2 w-2 rounded-full', toneDot(column.tone))} />
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {column.title}
                </p>
              </div>
              <div className="space-y-2">
                {column.cards.map((card) => (
                  <div
                    key={card}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 shadow-sm"
                  >
                    <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200">{card}</p>
                    <p className="mt-0.5 text-[9px] text-slate-400 dark:text-slate-500">Aug · 3 nights</p>
                  </div>
                ))}
                {columnIndex === 2 ? (
                  dropped ? (
                    <div
                      className="rounded-xl border-2 border-teal-400 dark:border-teal-500/50 bg-teal-50 dark:bg-teal-500/15 p-2.5"
                      style={reveal(frame, 102, 8)}
                    >
                      <p className="text-[11px] font-bold text-teal-700 dark:text-teal-300">Rae Reyes</p>
                      <p className="mt-0.5 text-[9px] text-teal-600 dark:text-teal-300">Moved to Confirmed</p>
                    </div>
                  ) : (
                    <div className="rounded-xl border-2 border-dashed border-teal-300 dark:border-teal-500/40 bg-teal-50/40 p-2.5 opacity-70">
                      <p className="text-[10px] font-semibold text-teal-500 dark:text-teal-400">Drop here</p>
                    </div>
                  )
                ) : null}
              </div>
            </div>
          ))}

          {!dropped ? (
            <div
              className="absolute w-[22%] rounded-xl border-2 border-teal-400 dark:border-teal-500/50 bg-white dark:bg-slate-900 p-2.5 shadow-xl"
              style={{
                left: `${cardLeftPct}%`,
                top: cardTop,
                transform: `rotate(${lift * -3}deg) scale(${1 + lift * 0.05})`,
              }}
            >
              <p className="text-[11px] font-bold text-teal-700 dark:text-teal-300">Rae Reyes</p>
              <p className="mt-0.5 text-[9px] text-slate-400 dark:text-slate-500">Documents received</p>
            </div>
          ) : null}
        </div>

        <div
          className="mt-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm"
          style={reveal(frame, 112)}
        >
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 dark:bg-teal-500/15 text-teal-600 dark:text-teal-300">
              <Plus className="h-3.5 w-3.5" />
            </span>
            <div>
              <p className="text-[11px] font-black text-slate-700 dark:text-slate-200">New booking</p>
              <p className="text-[9px] text-slate-400 dark:text-slate-500">Same guest form, right in the dashboard</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {['Guest name', 'Stay dates', 'Guests', 'Downpayment receipt'].map((label, index) => (
              <div
                key={label}
                className="flex h-8 items-center rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 text-[9px] text-slate-500 dark:text-slate-400"
                style={reveal(frame, 122 + index * 10, 6)}
              >
                <span className="truncate">{label}</span>
                {frame > 168 ? (
                  <Check className="ml-auto h-3 w-3 shrink-0 text-emerald-500" />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </PushIn>
      <Cursor from={[210, 250]} to={[640, 250]} moveStart={30} moveEnd={98} clickAt={28} />
      <SceneOutro text="A board when you want one, plus one-tap manual bookings." />
    </FilmShell>
  );
}

/* ---------------- 5. AI-assisted data import ---------------- */

export function DataImportScene() {
  const frame = useCurrentFrame();
  const rows: [string, string, string][] = [
    ['guest', 'Guest name', '99%'],
    ['arrive', 'Check-in date', '98%'],
    ['depart', 'Check-out date', '98%'],
    ['# pax', 'Guests', '96%'],
    ['paid?', 'Downpayment', '92%'],
  ];
  const mappedThrough = stepAt(frame, 44, 196, rows.length + 1);
  const wizardStep = stepAt(frame, 26, 210, 4);
  const wizard = ['Upload', 'Match with AI', 'Preview', 'Commit'];

  return (
    <FilmShell activeLabel="Bookings">
      <PushIn>
        <SceneHeading
          eyebrow="AI-assisted data import"
          title="Bring existing bookings in. AI maps the columns"
          frame={frame}
          action={
            <span
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-[10px] font-bold text-slate-600 dark:text-slate-300"
              style={reveal(frame, 12)}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> bookings-2024.xlsx{' '}
              <TierBadge tier="Starter" />
            </span>
          }
        />

        <div
          className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm"
          style={reveal(frame, 10)}
        >
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 dark:bg-teal-500/15 text-teal-600 dark:text-teal-300">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <p className="text-[12px] font-black text-slate-800 dark:text-slate-100">AI column matching</p>
            <span className="ml-auto text-[9px] font-semibold text-slate-400 dark:text-slate-500">
              Your headers → Kame fields
            </span>
          </div>

          <div className="space-y-2">
            {rows.map(([source, target, confidence], index) => {
              const done = index < mappedThrough;
              const t = grow(frame, 0, 1, 46 + index * 28, 80 + index * 28);
              return (
                <div
                  key={source}
                  className="grid grid-cols-[1fr_auto_1fr] items-center gap-3"
                  style={reveal(frame, 24 + index * 10, 6)}
                >
                  <div className="flex items-center justify-end">
                    <span className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-2.5 py-1.5 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                      {source}
                    </span>
                  </div>
                  <div className="relative flex w-[120px] items-center">
                    <span className="h-0.5 w-full rounded-full bg-slate-200 dark:bg-slate-700" />
                    <span
                      className="absolute left-0 h-0.5 rounded-full bg-teal-500"
                      style={{ width: `${t * 100}%` }}
                    />
                    <ArrowRight
                      className="absolute h-3.5 w-3.5 text-teal-500 dark:text-teal-400"
                      style={{ left: `${t * 100}%`, transform: 'translateX(-60%)' }}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'rounded-lg border px-2.5 py-1.5 text-[10px] font-bold',
                        done
                          ? 'border-teal-300 dark:border-teal-500/40 bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-300'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500'
                      )}
                    >
                      {target}
                    </span>
                    {done ? (
                      <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-300">{confidence}</span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-[1.5fr_1fr] gap-4">
          <div
            className="flex items-center gap-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 shadow-sm"
            style={reveal(frame, 30)}
          >
            {wizard.map((label, index) => (
              <div
                key={label}
                className={cn(
                  'flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-[9px] font-bold',
                  index < wizardStep
                    ? 'bg-teal-500/15 text-teal-600 dark:text-teal-300'
                    : index === wizardStep
                      ? 'bg-teal-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                )}
              >
                {index < wizardStep ? <Check className="h-3 w-3" /> : null}
                {label}
              </div>
            ))}
          </div>
          <div
            className="flex items-center gap-3 rounded-2xl bg-teal-600 p-3.5 text-white shadow-lg shadow-teal-600/20"
            style={reveal(frame, 200)}
          >
            <CheckCircle2 className="h-5 w-5" />
            <div>
              <p className="text-[11px] font-black">184 rows ready</p>
              <p className="text-[9px] text-teal-100">6 flagged for a quick review</p>
            </div>
          </div>
        </div>
      </PushIn>
      <SceneOutro text="AI does the column mapping. You just check the odd ones." />
    </FilmShell>
  );
}

/* ---------------- 6. Two-way Airbnb sync ---------------- */

export function ChannelSyncScene() {
  const frame = useCurrentFrame();
  const inbound = interpolate(frame, [46, 122], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
  const outbound = interpolate(frame, [140, 214], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
  const spin = (frame * 3) % 360;

  return (
    <FilmShell activeLabel="Pricing">
      <PushIn>
        <SceneHeading
          eyebrow="Two-way Airbnb calendar sync"
          title="Airbnb and Kame, always in step"
          frame={frame}
          action={<StatusPill label="Pro plan" tone="amber" />}
        />

        <div className="grid grid-cols-[0.9fr_auto_1.1fr] items-stretch gap-4">
          {/* Airbnb side */}
          <div
            className="flex flex-col rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm"
            style={reveal(frame, 12)}
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 dark:bg-rose-500/15 text-[12px] font-black text-rose-500 dark:text-rose-400">
                A
              </span>
              <p className="text-[12px] font-black text-slate-800 dark:text-slate-100">Airbnb calendar</p>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {Array.from({ length: 12 }, (_, i) => {
                const blockedOut = outbound > 0.5 && (i === 5 || i === 6 || i === 9);
                return (
                  <div
                    key={i}
                    className={cn(
                      'flex h-9 items-center justify-center rounded-md border text-[9px] font-bold',
                      blockedOut
                        ? 'border-slate-300 dark:border-slate-700 bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
                        : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400'
                    )}
                  >
                    {i + 10}
                  </div>
                );
              })}
            </div>
            <p className="mt-auto pt-3 text-[9px] font-semibold text-slate-400 dark:text-slate-500">
              Sept 10 – 21 · reservations &amp; blocks
            </p>
          </div>

          {/* Center: sync engine + two arrows */}
          <div className="flex w-[150px] flex-col items-center justify-center gap-3">
            <div
              className="flex items-center gap-1.5 rounded-full border border-rose-200 dark:border-rose-500/30 bg-white dark:bg-slate-900 px-2.5 py-1 text-[9px] font-bold text-rose-500 dark:text-rose-400 shadow-sm"
              style={{ opacity: inbound }}
            >
              <ArrowRight className="h-3 w-3" /> Reservation
            </div>
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-600 text-white shadow-lg shadow-teal-600/25"
              style={reveal(frame, 20)}
            >
              <RefreshCw className="h-6 w-6" style={{ transform: `rotate(${spin}deg)` }} />
            </div>
            <p className="text-center text-[8px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Two-way · every 15 min
            </p>
            <div
              className="flex items-center gap-1.5 rounded-full border border-teal-200 dark:border-teal-500/30 bg-white dark:bg-slate-900 px-2.5 py-1 text-[9px] font-bold text-teal-600 dark:text-teal-300 shadow-sm"
              style={{ opacity: outbound }}
            >
              Blocks &amp; booked <ArrowRight className="h-3 w-3 rotate-180" />
            </div>
          </div>

          {/* Kame side */}
          <div
            className="flex flex-col rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm"
            style={reveal(frame, 16)}
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600 text-[11px] font-black text-white">
                K
              </span>
              <p className="text-[12px] font-black text-slate-800 dark:text-slate-100">Monaco 2604 · Pricing</p>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {Array.from({ length: 12 }, (_, i) => {
                const arrived = inbound > 0.6 && (i === 2 || i === 3 || i === 4);
                const blocked = i === 5 || i === 6 || i === 9;
                return (
                  <div
                    key={i}
                    className={cn(
                      'relative flex h-9 items-center justify-center rounded-md border text-[9px] font-bold',
                      arrived
                        ? 'border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-300'
                        : blocked
                          ? 'border-slate-200 dark:border-slate-700 bg-[repeating-linear-gradient(45deg,#f1f5f9,#f1f5f9_3px,#e2e8f0_3px,#e2e8f0_6px)] text-slate-400 dark:text-slate-500'
                          : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'
                    )}
                  >
                    {i + 10}
                  </div>
                );
              })}
            </div>
            {inbound > 0.7 ? (
              <div
                className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-500/15 px-2.5 py-1.5 text-[9px] font-bold text-amber-700 dark:text-amber-300"
                style={reveal(frame, 124, 8)}
              >
                <ArrowRight className="h-3 w-3" /> Airbnb · Sept 12–15 → Pending review
              </div>
            ) : (
              <p className="mt-auto pt-3 text-[9px] font-semibold text-slate-400 dark:text-slate-500">
                Incoming reservations arrive here to review
              </p>
            )}
          </div>
        </div>
      </PushIn>
      <SceneOutro text="Reservations flow in, blocks flow out. No double-bookings." />
    </FilmShell>
  );
}
