import type { CSSProperties } from 'react';

import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Check,
  DollarSign,
  Download,
  Gauge,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Tags,
  ThumbsUp,
  TrendingUp,
  Users,
  Wand2,
  Wrench,
} from 'lucide-react';
import { useCurrentFrame } from 'remotion';

import {
  AreaChart,
  Btn,
  Card,
  CardHeader,
  Chip,
  countTo,
  Cursor,
  ease,
  FilmScene,
  Kpi,
  filmNightlyRate,
  MonthGrid,
  peso,
  popIn,
  reveal,
  Segmented,
  Toast,
  Toggle,
} from '@/features/guest/marketing/for-hosts/components/film/FilmPrimitives';
import { FilmShell } from '@/features/guest/marketing/for-hosts/components/film/FilmShell';

import { cn } from '@/lib/utils';

/* ---------------- Pricing + Smart Pricing ---------------- */

/** Open nights Smart Pricing reprices (booked + blocked nights are never touched). */
const SMART_DAYS = [3, 4, 6, 9, 10, 17, 23, 24, 25, 26, 30, 31];
const SMART_PRICE: Record<number, string> = {
  3: '₱4,650',
  4: '₱3,450',
  6: '₱2,890',
  9: '₱4,800',
  10: '₱4,950',
  17: '₱4,700',
  23: '₱4,500',
  24: '₱4,650',
  25: '₱3,300',
  26: '₱2,890',
  30: '₱5,200',
  31: '₱5,400',
};

export function PricingScene() {
  const frame = useCurrentFrame();
  const dialogOpen = frame >= 52 && frame < 146;
  const applied = frame >= 150;
  // Smart prices land row by row once applied.
  const appliedDays = applied
    ? SMART_DAYS.filter((day) => frame >= 150 + Math.floor((day - 1) / 7) * 5)
    : [];

  return (
    <FilmScene
      camera={[
        { at: 0, x: 0.5, y: 0.5, zoom: 1 },
        { at: 60, x: 0.62, y: 0.42, zoom: 1.08 },
        { at: 176, x: 0.5, y: 0.56, zoom: 1.16 },
      ]}
    >
      <FilmShell
        context="property"
        active="Pricing"
        title="Pricing"
        subtitle="Monaco 2604 · October 2026"
        actions={
          <>
            <Btn icon={RefreshCw}>Channel sync</Btn>
            <Btn icon={Wand2} variant={applied ? 'outline' : 'primary'}>
              Smart Pricing
            </Btn>
          </>
        }
      >
        <Card>
          <MonthGrid
            frame={frame}
            booked={[14, 15, 16, 21, 22]}
            guests={{ 14: 'Kyle S.', 21: 'Ana L.' }}
            blocked={[28]}
            smart={appliedDays}
            cellHeight={72}
            priceFor={(day) =>
              appliedDays.includes(day) ? SMART_PRICE[day] : filmNightlyRate(day)
            }
          />
          <div className="mt-3 flex items-center gap-4 text-xs" style={reveal(frame, 160)}>
            <span className="text-muted-foreground flex items-center gap-1.5">
              <span className="bg-primary size-2.5 rounded-sm" /> Booked
            </span>
            <span className="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
              <Wand2 className="size-3.5" /> Smart Pricing · {appliedDays.length} nights
            </span>
          </div>
        </Card>
      </FilmShell>

      {dialogOpen ? (
        <>
          <div
            className="absolute inset-0 bg-slate-950/40"
            style={{ opacity: ease(frame, 52, 62) * (1 - ease(frame, 138, 146)) }}
          />
          <div
            className="border-border bg-card absolute left-[350px] top-[70px] w-[580px] rounded-2xl border p-6 shadow-2xl"
            style={{
              ...popIn(frame, 54),
              opacity: ease(frame, 54, 66) * (1 - ease(frame, 136, 146)),
            }}
          >
            <div className="flex items-center gap-3">
              <span className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-xl">
                <Wand2 className="size-5" />
              </span>
              <div className="flex-1">
                <p className="text-foreground text-lg font-bold">Smart Pricing</p>
                <p className="text-muted-foreground text-sm">AI suggests a rate for every night</p>
              </div>
              <Toggle on={frame >= 78} />
            </div>
            <div className="mt-5 space-y-4">
              <div>
                <p className="text-foreground mb-2 text-[13px] font-medium">Strength</p>
                <Segmented options={['Gentle', 'Balanced', 'Bold']} active="Balanced" fill />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="border-border rounded-lg border p-3">
                  <p className="text-muted-foreground text-xs">Lowest rate</p>
                  <p className="text-foreground text-base font-semibold">₱2,800</p>
                </div>
                <div className="border-border rounded-lg border p-3">
                  <p className="text-muted-foreground text-xs">Highest rate</p>
                  <p className="text-foreground text-base font-semibold">₱5,500</p>
                </div>
              </div>
              <div className="bg-muted/50 rounded-xl p-3.5" style={reveal(frame, 92)}>
                <p className="text-foreground text-[13px] font-semibold">Preview</p>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                  {[
                    ['Oct 31', '₱5,400', 'Holiday weekend'],
                    ['Oct 26', '₱2,890', 'Quiet Monday'],
                    ['Oct 10', '₱4,950', 'Busy Saturday'],
                  ].map(([day, price, why]) => (
                    <div key={day} className="bg-card rounded-lg p-2">
                      <p className="text-muted-foreground text-[11px]">{day}</p>
                      <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                        {price}
                      </p>
                      <p className="text-muted-foreground text-[10px]">{why}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Btn>Preview</Btn>
              <Btn variant="primary">Apply</Btn>
            </div>
          </div>
        </>
      ) : null}

      <Cursor
        path={[
          { at: 22, x: 900, y: 300 },
          { at: 48, x: 1176, y: 46, click: true },
          { at: 76, x: 896, y: 108, click: true },
          { at: 130, x: 862, y: 486, click: true },
          { at: 170, x: 1000, y: 470 },
        ]}
      />
    </FilmScene>
  );
}

/* ---------------- Finance ---------------- */

const TRANSACTIONS = [
  { label: 'Kyle Santos · booking', amount: 10600, income: true },
  { label: 'Ria Gomez · booking', amount: 4200, income: true },
  { label: 'Cleaning · Oct 17', amount: -800, income: false },
  { label: 'Association dues', amount: -6500, income: false },
];

export function FinanceScene() {
  const frame = useCurrentFrame();
  const added = frame >= 104;
  const expenses = added ? 43050 : 38200;
  const net = 184650 - expenses;

  return (
    <FilmScene
      camera={[
        { at: 0, x: 0.5, y: 0.5, zoom: 1 },
        { at: 92, x: 0.72, y: 0.6, zoom: 1.18 },
      ]}
    >
      <FilmShell
        context="property"
        active="Finance"
        title="Finance"
        subtitle="Monaco 2604 · October 2026"
        actions={
          <>
            <Btn icon={Download}>Export</Btn>
            <Btn variant="primary" icon={Plus}>
              Add expense
            </Btn>
          </>
        }
      >
        <div className="grid grid-cols-4 gap-4">
          <Kpi
            title="Income"
            value={peso(countTo(frame, 184650, 4))}
            icon={ArrowUpRight}
            change="+12.4%"
            style={reveal(frame, 2)}
          />
          <Kpi
            title="Expenses"
            value={peso(expenses)}
            icon={ArrowDownRight}
            change="-3.2%"
            style={reveal(frame, 5)}
          />
          <Kpi
            title="Net profit"
            value={peso(countTo(frame, net, 8))}
            icon={DollarSign}
            change="+16.8%"
            style={reveal(frame, 8)}
          />
          <Kpi
            title="Profit margin"
            value={`${Math.round((net / 184650) * 100)}%`}
            icon={TrendingUp}
            style={reveal(frame, 11)}
          />
        </div>
        <div className="mt-4 grid grid-cols-[1.2fr_1fr] gap-4">
          <Card style={reveal(frame, 14)}>
            <CardHeader
              icon={BarChart3}
              title="Cash flow"
              action={<Segmented options={['All', 'Income', 'Expenses']} active="All" />}
            />
            <AreaChart
              frame={frame}
              points={[18, 26, 22, 34, 41, 38, 52, 49, 60, 72, 68, 84]}
              height={250}
              width={470}
              startFrame={18}
              endFrame={70}
            />
          </Card>
          <Card style={reveal(frame, 18)}>
            <CardHeader icon={DollarSign} title="Transactions" />
            <div className="divide-border divide-y">
              {added ? (
                <Row
                  label="Electricity · October"
                  amount={-4850}
                  style={{
                    ...reveal(frame, 104, 12),
                    backgroundColor: 'hsl(var(--primary) / 0.06)',
                  }}
                />
              ) : null}
              {TRANSACTIONS.map((item, index) => (
                <Row
                  key={item.label}
                  label={item.label}
                  amount={item.amount}
                  style={reveal(frame, 26 + index * 6)}
                />
              ))}
            </div>
          </Card>
        </div>
      </FilmShell>
      <Cursor
        path={[
          { at: 40, x: 900, y: 300 },
          { at: 96, x: 1186, y: 46, click: true },
          { at: 140, x: 1010, y: 360 },
        ]}
      />
    </FilmScene>
  );
}

function Row({ label, amount, style }: { label: string; amount: number; style?: CSSProperties }) {
  const income = amount > 0;
  return (
    <div className="flex items-center gap-3 rounded-lg px-1 py-3" style={style}>
      <span
        className={cn(
          'flex size-8 items-center justify-center rounded-lg',
          income
            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
            : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
        )}
      >
        {income ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
      </span>
      <span className="text-foreground flex-1 text-sm font-medium">{label}</span>
      <span
        className={cn(
          'text-sm font-semibold tabular-nums',
          income ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'
        )}
      >
        {income ? '+' : '-'}
        {peso(Math.abs(amount))}
      </span>
    </div>
  );
}

/* ---------------- Maintenance ---------------- */

const TASKS = [
  { name: 'Aircon cleaning', every: 'Every 3 months', due: 'Due today', tone: 'amber' as const },
  { name: 'Water filter change', every: 'Monthly', due: 'Due Oct 15', tone: 'muted' as const },
  { name: 'Pest control', every: 'Every 6 months', due: 'Due Oct 22', tone: 'muted' as const },
  { name: 'Deep clean', every: 'After each check-out', due: 'Due Oct 17', tone: 'muted' as const },
  { name: 'Smoke detector test', every: 'Yearly', due: 'Due Nov 2', tone: 'muted' as const },
];

export function MaintenanceScene() {
  const frame = useCurrentFrame();
  const checked = frame >= 72;
  return (
    <FilmScene
      camera={[
        { at: 0, x: 0.5, y: 0.5, zoom: 1 },
        { at: 56, x: 0.5, y: 0.36, zoom: 1.16 },
      ]}
    >
      <FilmShell
        context="property"
        active="Maintenance"
        title="Maintenance"
        subtitle="Monaco 2604"
        actions={
          <>
            <Btn icon={Download}>Report</Btn>
            <Btn variant="primary" icon={Plus}>
              Add task
            </Btn>
          </>
        }
      >
        <Segmented options={['Upcoming', 'Overdue', 'Done']} active="Upcoming" className="mb-4" />
        <Card className="p-0">
          <div className="divide-border divide-y">
            {TASKS.map((task, index) => {
              const isDone = index === 0 && checked;
              return (
                <div
                  key={task.name}
                  className="flex items-center gap-4 px-5 py-4"
                  style={reveal(frame, 4 + index * 5)}
                >
                  <span
                    className={cn(
                      'flex size-6 items-center justify-center rounded-md border-2',
                      isDone ? 'border-primary bg-primary text-primary-foreground' : 'border-border'
                    )}
                  >
                    {isDone ? <Check className="size-4" strokeWidth={3} /> : null}
                  </span>
                  <span className="bg-muted flex size-9 items-center justify-center rounded-lg">
                    <Wrench className="text-muted-foreground size-[18px]" />
                  </span>
                  <div className="flex-1">
                    <p
                      className={cn(
                        'text-foreground text-sm font-semibold',
                        isDone && 'text-muted-foreground line-through'
                      )}
                    >
                      {task.name}
                    </p>
                    <p className="text-muted-foreground text-xs">{task.every}</p>
                  </div>
                  {isDone ? (
                    <Chip tone="emerald" icon={Check}>
                      Done
                    </Chip>
                  ) : (
                    <Chip tone={task.tone}>{task.due}</Chip>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </FilmShell>
      <div className="absolute right-[48px] top-[540px]">
        <Toast
          icon={Send}
          title="Reminder sent to Telegram"
          body="Ops team · Water filter change is due Oct 15"
          style={reveal(frame, 110, 14)}
        />
      </div>
      <Cursor
        path={[
          { at: 36, x: 500, y: 300 },
          { at: 66, x: 294, y: 168, click: true },
          { at: 120, x: 520, y: 260 },
        ]}
      />
    </FilmScene>
  );
}

/* ---------------- Analytics + AI review ---------------- */

export function AnalyticsScene() {
  const frame = useCurrentFrame();
  const onReview = frame >= 54;
  const score = countTo(frame, 82, 64, 30);

  return (
    <FilmScene
      camera={[
        { at: 0, x: 0.5, y: 0.5, zoom: 1 },
        { at: 92, x: 0.6, y: 0.66, zoom: 1.16 },
      ]}
    >
      <FilmShell
        context="property"
        active="Analytics"
        title="Analytics"
        subtitle="Monaco 2604 · October 2026"
        actions={
          <>
            <Segmented options={['Week', 'Month', 'Year']} active="Month" />
            <Btn icon={Download}>Export PDF</Btn>
          </>
        }
      >
        <div className="grid grid-cols-4 gap-4">
          <Kpi
            title="Occupancy"
            value="74%"
            icon={Gauge}
            change="+6 pts"
            style={reveal(frame, 2)}
          />
          <Kpi
            title="Avg nightly rate"
            value="₱3,480"
            icon={Tags}
            change="+4.1%"
            style={reveal(frame, 4)}
          />
          <Kpi
            title="Revenue per night"
            value="₱2,575"
            icon={DollarSign}
            change="+9.8%"
            style={reveal(frame, 6)}
          />
          <Kpi title="Bookings" value="18" icon={BookOpen} change="+3" style={reveal(frame, 8)} />
        </div>
        <Segmented
          options={['Overview', 'Trends', 'Guests', 'AI review']}
          active={onReview ? 'AI review' : 'Overview'}
          className="mt-4"
        />
        {onReview ? (
          <Card className="mt-3 flex gap-6" style={reveal(frame, 56)}>
            <div className="flex w-[150px] shrink-0 flex-col items-center justify-center">
              <div className="relative size-[120px]">
                <svg viewBox="0 0 120 120" className="size-full -rotate-90">
                  <circle
                    cx="60"
                    cy="60"
                    r="50"
                    fill="none"
                    stroke="hsl(var(--muted))"
                    strokeWidth="11"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r="50"
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="11"
                    strokeLinecap="round"
                    strokeDasharray={`${(score / 100) * 314} 314`}
                  />
                </svg>
                <span className="text-foreground absolute inset-0 flex items-center justify-center text-3xl font-bold tabular-nums">
                  {score}
                </span>
              </div>
              <p className="text-muted-foreground mt-2 text-xs font-semibold">Performance score</p>
            </div>
            <div className="grid flex-1 grid-cols-2 gap-4">
              <div>
                <p className="text-foreground mb-2 flex items-center gap-1.5 text-sm font-semibold">
                  <ThumbsUp className="size-4 text-emerald-600 dark:text-emerald-400" /> What’s
                  working
                </p>
                {[
                  'Weekends are 92% booked',
                  'Replies within 1 hour on average',
                  'Guest rating up to 4.9',
                ].map((line, index) => (
                  <p
                    key={line}
                    className="text-muted-foreground mb-1.5 flex gap-2 text-sm"
                    style={reveal(frame, 76 + index * 8)}
                  >
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />{' '}
                    {line}
                  </p>
                ))}
              </div>
              <div>
                <p className="text-foreground mb-2 flex items-center gap-1.5 text-sm font-semibold">
                  <Sparkles className="text-primary size-4" /> What to improve
                </p>
                {[
                  'Tuesdays sit empty. Try a midweek rate.',
                  'Add photos of the pool area.',
                  'Most guests book 9 days ahead.',
                ].map((line, index) => (
                  <p
                    key={line}
                    className="text-muted-foreground mb-1.5 flex gap-2 text-sm"
                    style={reveal(frame, 100 + index * 8)}
                  >
                    <ArrowUpRight className="text-primary mt-0.5 size-4 shrink-0" /> {line}
                  </p>
                ))}
              </div>
            </div>
          </Card>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-4">
            <Card style={reveal(frame, 10)}>
              <CardHeader icon={TrendingUp} title="New bookings" />
              <AreaChart
                frame={frame}
                points={[3, 5, 4, 6, 8, 7, 9]}
                height={150}
                width={420}
                startFrame={12}
                endFrame={46}
              />
            </Card>
            <Card style={reveal(frame, 14)}>
              <CardHeader icon={Users} title="Where bookings come from" />
              <div className="flex flex-col gap-2">
                {[
                  ['Direct', 46],
                  ['Airbnb', 38],
                  ['Facebook', 16],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center gap-3 text-sm">
                    <span className="text-foreground w-20">{label}</span>
                    <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
                      <div
                        className="bg-primary h-full rounded-full"
                        style={{ width: `${Number(value) * ease(frame, 14, 50)}%` }}
                      />
                    </div>
                    <span className="text-muted-foreground w-10 text-right tabular-nums">
                      {value}%
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </FilmShell>
      <Cursor
        path={[
          { at: 24, x: 700, y: 300 },
          { at: 50, x: 618, y: 244, click: true },
          { at: 110, x: 760, y: 420 },
        ]}
      />
    </FilmScene>
  );
}
