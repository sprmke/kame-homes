import type { CSSProperties } from 'react';

import {
  ArrowLeftRight,
  CalendarCheck,
  Check,
  FileCheck2,
  FileSpreadsheet,
  Filter,
  Link2,
  Mail,
  Plus,
  RefreshCw,
  ScanLine,
  Sparkles,
  Upload,
} from 'lucide-react';
import { useCurrentFrame } from 'remotion';

import {
  Btn,
  Card,
  CARD,
  CardHeader,
  Chip,
  type ChipTone,
  Cursor,
  ease,
  Field,
  FilmScene,
  MonthGrid,
  popIn,
  reveal,
  Segmented,
  typewriter,
} from '@/features/guest/marketing/for-hosts/components/film/FilmPrimitives';
import { FilmShell } from '@/features/guest/marketing/for-hosts/components/film/FilmShell';

import { cn } from '@/lib/utils';

/* ---------------- Booking workflow ---------------- */

/** Canonical lifecycle — STATUS_LABELS in features/dashboard/bookings/lib/bookingStatus.ts */
const STAGES: { label: string; tone: ChipTone }[] = [
  { label: 'Pending Review', tone: 'amber' },
  { label: 'Pending Documents', tone: 'sky' },
  { label: 'Ready for Check-in', tone: 'emerald' },
  { label: 'Ready for Check-out', tone: 'violet' },
  { label: 'Pending SD Refund', tone: 'amber' },
  { label: 'Completed', tone: 'muted' },
];

const AUTOMATIONS = [
  {
    at: 34,
    icon: ScanLine,
    text: 'Payment receipt checked by AI',
    meta: 'Amount and reference match',
  },
  { at: 66, icon: FileCheck2, text: 'Guest form PDF created', meta: 'Sent to building admin' },
  { at: 98, icon: CalendarCheck, text: 'Calendar updated', meta: 'Oct 14 – 17 marked booked' },
  { at: 130, icon: Mail, text: 'Check-in details emailed', meta: 'To kyle.santos@gmail.com' },
];

export function BookingWorkflowScene() {
  const frame = useCurrentFrame();
  const stage = frame < 52 ? 0 : frame < 112 ? 1 : 2;
  const current = STAGES[stage];

  return (
    <FilmScene
      camera={[
        { at: 0, x: 0.5, y: 0.5, zoom: 1 },
        { at: 80, x: 0.68, y: 0.48, zoom: 1.1 },
      ]}
    >
      <FilmShell
        context="property"
        active="Bookings"
        title="Kyle Santos"
        subtitle="Oct 14 – 17 · 3 nights · 2 guests · ₱10,600"
        actions={
          <>
            <Chip tone={current.tone} className="px-3 py-1.5 text-[13px]">
              {current.label}
            </Chip>
            <Btn variant="primary">Move forward</Btn>
          </>
        }
      >
        <div className="grid grid-cols-[1fr_1.15fr] gap-4">
          <Card style={reveal(frame, 4)}>
            <CardHeader title="Status" description="Every booking follows the same path" />
            <div className="relative ml-1">
              <div className="bg-border absolute bottom-3 left-[11px] top-3 w-0.5" />
              <div
                className="bg-primary absolute left-[11px] top-3 w-0.5"
                style={{ height: `${(stage / (STAGES.length - 1)) * 92}%` }}
              />
              {STAGES.map((item, index) => {
                const done = index < stage;
                const active = index === stage;
                return (
                  <div key={item.label} className="relative flex items-center gap-3.5 py-[9px]">
                    <span
                      className={cn(
                        'z-[1] flex size-6 items-center justify-center rounded-full border-2',
                        done && 'border-primary bg-primary text-primary-foreground',
                        active && 'border-primary bg-background ring-primary/20 ring-4',
                        !done && !active && 'border-border bg-background'
                      )}
                    >
                      {done ? <Check className="size-3.5" strokeWidth={3} /> : null}
                    </span>
                    <span
                      className={cn(
                        'text-sm',
                        active ? 'text-foreground font-semibold' : 'text-muted-foreground'
                      )}
                    >
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card style={reveal(frame, 8)}>
            <CardHeader
              icon={Sparkles}
              title="Done for you"
              description="Activity on this booking"
            />
            <div className="space-y-2.5">
              {AUTOMATIONS.map((item) => (
                <div
                  key={item.text}
                  className="border-border/70 bg-muted/30 flex items-center gap-3 rounded-xl border p-3"
                  style={reveal(frame, item.at, 12)}
                >
                  <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
                    <item.icon className="size-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground text-sm font-semibold">{item.text}</p>
                    <p className="text-muted-foreground text-xs">{item.meta}</p>
                  </div>
                  <Check
                    className="size-4 text-emerald-600 dark:text-emerald-400"
                    strokeWidth={3}
                  />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </FilmShell>
    </FilmScene>
  );
}

/* ---------------- Board + manual booking ---------------- */

const COLUMNS: { label: string; tone: ChipTone; cards: { guest: string; dates: string }[] }[] = [
  {
    label: 'Pending Review',
    tone: 'amber',
    cards: [
      { guest: 'Ana Lim', dates: 'Oct 21 – 23' },
      { guest: 'Marco Cruz', dates: 'Oct 25 – 27' },
    ],
  },
  { label: 'Pending Documents', tone: 'sky', cards: [{ guest: 'Joy Tan', dates: 'Oct 19 – 20' }] },
  {
    label: 'Ready for Check-in',
    tone: 'emerald',
    cards: [
      { guest: 'Kyle Santos', dates: 'Oct 14 – 17' },
      { guest: 'Ria Gomez', dates: 'Oct 18 – 19' },
    ],
  },
  {
    label: 'Ready for Check-out',
    tone: 'violet',
    cards: [{ guest: 'Leo Uy', dates: 'Oct 11 – 14' }],
  },
];

function BoardCard({
  guest,
  dates,
  style,
}: {
  guest: string;
  dates: string;
  style?: CSSProperties;
}) {
  return (
    <div className={cn(CARD, 'p-3.5')} style={style}>
      <p className="text-foreground text-sm font-semibold">{guest}</p>
      <p className="text-muted-foreground mt-0.5 text-xs">{dates} · Monaco 2604</p>
    </div>
  );
}

export function BookingsBoardScene() {
  const frame = useCurrentFrame();
  // Drag "Ana Lim" from Pending Review into Pending Documents.
  const drag = ease(frame, 40, 84);
  const dropped = frame >= 86;
  const dialog = frame >= 128;

  return (
    <FilmScene
      camera={[
        { at: 0, x: 0.5, y: 0.5, zoom: 1 },
        { at: 40, x: 0.45, y: 0.45, zoom: 1.1 },
        { at: 150, x: 0.55, y: 0.5, zoom: 1.08 },
      ]}
    >
      <FilmShell
        context="property"
        active="Bookings"
        title="Bookings"
        subtitle="18 bookings in October"
        actions={
          <>
            <Segmented options={['Table', 'Kanban']} active="Kanban" />
            <Btn icon={Filter}>Filter</Btn>
            <Btn variant="primary" icon={Plus}>
              New booking
            </Btn>
          </>
        }
      >
        <div className="grid grid-cols-4 gap-3">
          {COLUMNS.map((column, columnIndex) => (
            <div key={column.label} className="bg-muted/50 min-h-[520px] rounded-xl p-3">
              <div className="mb-3 flex items-center justify-between">
                <Chip tone={column.tone}>{column.label}</Chip>
                <span className="text-muted-foreground text-xs font-semibold tabular-nums">
                  {column.cards.length +
                    (columnIndex === 1 && dropped ? 1 : 0) -
                    (columnIndex === 0 && dropped ? 1 : 0)}
                </span>
              </div>
              <div className="space-y-2.5">
                {columnIndex === 1 && dropped ? (
                  <BoardCard
                    guest="Ana Lim"
                    dates="Oct 21 – 23"
                    style={{ boxShadow: '0 0 0 2px hsl(var(--primary))' }}
                  />
                ) : null}
                {column.cards.map((card, cardIndex) => {
                  if (columnIndex === 0 && cardIndex === 0) {
                    if (dropped) return null;
                    const lifted = frame >= 34;
                    return (
                      <BoardCard
                        key={card.guest}
                        {...card}
                        style={{
                          position: 'relative',
                          zIndex: 20,
                          transform: `translate3d(${drag * 240}px, ${drag * -2}px, 0) rotate(${lifted && !dropped ? 2 * (1 - drag) + 1 : 0}deg)`,
                          boxShadow: lifted ? '0 18px 40px -12px rgb(15 23 42 / 0.35)' : undefined,
                        }}
                      />
                    );
                  }
                  return (
                    <BoardCard
                      key={card.guest}
                      {...card}
                      style={reveal(frame, 4 + cardIndex * 4)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </FilmShell>

      {dialog ? (
        <>
          <div
            className="absolute inset-0 bg-slate-950/40"
            style={{ opacity: ease(frame, 128, 140) }}
          />
          <div
            className="border-border bg-card absolute left-[360px] top-[96px] w-[560px] rounded-2xl border p-6 shadow-2xl"
            style={popIn(frame, 130)}
          >
            <p className="text-foreground text-lg font-bold">New booking</p>
            <p className="text-muted-foreground text-sm">For walk-ins and phone bookings</p>
            <div className="mt-5 grid grid-cols-2 gap-4">
              <Field
                className="col-span-2"
                label="Guest name"
                value={typewriter('Paolo Reyes', frame, 146, 170)}
                caret={frame < 172}
              />
              <Field label="Check-in" value="Oct 29" />
              <Field label="Check-out" value="Oct 31" />
              <Field label="Guests" value="2 adults" />
              <Field label="Source" value="Phone" />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Btn>Cancel</Btn>
              <Btn variant="primary">Create booking</Btn>
            </div>
          </div>
        </>
      ) : null}

      <Cursor
        path={[
          { at: 20, x: 420, y: 250 },
          { at: 34, x: 400, y: 160, click: true },
          { at: 84, x: 640, y: 158 },
          { at: 118, x: 1188, y: 46, click: true },
          { at: 160, x: 760, y: 260 },
        ]}
      />
    </FilmScene>
  );
}

/* ---------------- AI data import ---------------- */

const MAPPINGS = [
  { from: 'Guest', to: 'Guest name' },
  { from: 'Arrival', to: 'Check-in date' },
  { from: 'Departure', to: 'Check-out date' },
  { from: 'Pax', to: 'Number of guests' },
  { from: 'Total PHP', to: 'Total amount' },
  { from: 'Mobile #', to: 'Phone number' },
];

export function DataImportScene() {
  const frame = useCurrentFrame();
  return (
    <FilmScene
      camera={[
        { at: 0, x: 0.5, y: 0.5, zoom: 1 },
        { at: 70, x: 0.58, y: 0.5, zoom: 1.14 },
      ]}
    >
      <FilmShell
        context="property"
        active="Bookings"
        title="Import bookings"
        subtitle="Bring your past and upcoming stays"
      >
        <div className="grid grid-cols-[300px_1fr] gap-4">
          <Card style={reveal(frame, 2)}>
            <div className="border-primary/40 bg-primary/5 flex flex-col items-center rounded-xl border-2 border-dashed px-4 py-8 text-center">
              <Upload className="text-primary size-7" />
              <p className="text-foreground mt-3 text-sm font-semibold">Drop a spreadsheet</p>
              <p className="text-muted-foreground mt-1 text-xs">CSV or Excel</p>
            </div>
            <div
              className="border-border mt-4 flex items-center gap-3 rounded-xl border p-3"
              style={reveal(frame, 14)}
            >
              <FileSpreadsheet className="size-8 text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="text-foreground text-sm font-semibold">bookings-2026.xlsx</p>
                <p className="text-muted-foreground text-xs">127 rows</p>
              </div>
            </div>
          </Card>
          <Card style={reveal(frame, 6)}>
            <CardHeader
              icon={Sparkles}
              title="Match your columns"
              description="AI matched these for you. Change any you like."
            />
            <div className="space-y-2">
              {MAPPINGS.map((row, index) => {
                const at = 26 + index * 12;
                const matched = frame >= at + 8;
                return (
                  <div
                    key={row.from}
                    className="grid grid-cols-[1fr_28px_1.3fr] items-center gap-2"
                    style={reveal(frame, at - 6, 8)}
                  >
                    <span className="bg-muted text-foreground rounded-lg px-3 py-2 text-sm font-medium">
                      {row.from}
                    </span>
                    <ArrowLeftRight className="text-muted-foreground size-4 justify-self-center" />
                    <span
                      className={cn(
                        'flex h-9 items-center justify-between rounded-lg border px-3 text-sm',
                        matched
                          ? 'border-primary/40 bg-primary/5 text-foreground'
                          : 'border-border text-muted-foreground'
                      )}
                    >
                      {matched ? row.to : 'Matching…'}
                      {matched ? <Sparkles className="text-primary size-3.5" /> : null}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex items-center gap-2" style={reveal(frame, 112)}>
              <Chip tone="emerald" icon={Check}>
                124 ready
              </Chip>
              <Chip tone="amber">3 need a look</Chip>
              <Btn variant="primary" className="ml-auto">
                Import 124 bookings
              </Btn>
            </div>
          </Card>
        </div>
      </FilmShell>
    </FilmScene>
  );
}

/* ---------------- Two-way Airbnb sync ---------------- */

export function ChannelSyncScene() {
  const frame = useCurrentFrame();
  const flow = (frame % 45) / 45;
  return (
    <FilmScene
      camera={[
        { at: 0, x: 0.5, y: 0.5, zoom: 1 },
        { at: 60, x: 0.6, y: 0.48, zoom: 1.14 },
      ]}
    >
      <FilmShell
        context="property"
        active="Pricing"
        title="Pricing"
        subtitle="Monaco 2604 · October 2026"
        actions={
          <>
            <Btn icon={RefreshCw} className="ring-primary/40 ring-2">
              Channel sync
            </Btn>
            <Btn variant="primary">Smart Pricing</Btn>
          </>
        }
      >
        <Card className="opacity-70">
          <MonthGrid
            frame={frame}
            booked={[14, 15, 16, 21, 22]}
            guests={{ 14: 'Kyle S.', 21: 'Ana L.' }}
            blocked={[28]}
            cellHeight={64}
          />
        </Card>
      </FilmShell>

      <div className="absolute inset-0 bg-slate-950/40" style={{ opacity: ease(frame, 6, 18) }} />
      <div
        className="border-border bg-card absolute left-[290px] top-[80px] w-[700px] rounded-2xl border p-6 shadow-2xl"
        style={popIn(frame, 8)}
      >
        <div className="flex items-center justify-between">
          <p className="text-foreground text-lg font-bold">Channel sync</p>
          <Chip tone="emerald" icon={Check}>
            Connected
          </Chip>
        </div>
        <div className="mt-6 flex items-center justify-between px-8">
          <div className="flex flex-col items-center gap-2">
            <span className="bg-primary text-primary-foreground flex size-16 items-center justify-center rounded-2xl text-2xl font-black">
              K
            </span>
            <span className="text-foreground text-sm font-semibold">Your calendar</span>
          </div>
          <div className="relative mx-6 h-16 flex-1">
            <div className="bg-border absolute inset-x-0 top-5 h-0.5" />
            <div className="bg-border absolute inset-x-0 top-11 h-0.5" />
            <span
              className="bg-primary absolute top-[15px] size-3 rounded-full"
              style={{ left: `${flow * 100}%` }}
            />
            <span
              className="absolute top-[39px] size-3 rounded-full bg-rose-500"
              style={{ left: `${(1 - flow) * 100}%` }}
            />
          </div>
          <div className="flex flex-col items-center gap-2">
            <span className="flex size-16 items-center justify-center rounded-2xl bg-rose-500 text-white">
              <Link2 className="size-7" />
            </span>
            <span className="text-foreground text-sm font-semibold">Airbnb</span>
          </div>
        </div>
        <div className="mt-6 space-y-2.5">
          {[
            {
              at: 50,
              text: 'New Airbnb reservation',
              meta: 'Ana Lim · Oct 21 – 23 · added for review',
              tone: 'rose' as const,
            },
            {
              at: 86,
              text: 'Booked nights sent to Airbnb',
              meta: 'Oct 14 – 17 · Kyle Santos',
              tone: 'primary' as const,
            },
            {
              at: 122,
              text: 'Blocked date sent to Airbnb',
              meta: 'Oct 28 · owner stay',
              tone: 'primary' as const,
            },
          ].map((row) => (
            <div
              key={row.text}
              className="border-border flex items-center gap-3 rounded-xl border p-3"
              style={reveal(frame, row.at, 12)}
            >
              <Chip tone={row.tone}>{row.tone === 'rose' ? 'From Airbnb' : 'To Airbnb'}</Chip>
              <div>
                <p className="text-foreground text-sm font-semibold">{row.text}</p>
                <p className="text-muted-foreground text-xs">{row.meta}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </FilmScene>
  );
}
