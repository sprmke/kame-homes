import {
  BarChart3,
  BookOpen,
  Building2,
  CalendarDays,
  Car,
  Check,
  DollarSign,
  ExternalLink,
  Home,
  Plus,
  ShieldCheck,
  Tags,
  AlertTriangle,
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
  Field,
  Kpi,
  MonthGrid,
  peso,
  popIn,
  reveal,
  Segmented,
} from '@/features/guest/marketing/for-hosts/components/film/FilmPrimitives';
import { FilmShell } from '@/features/guest/marketing/for-hosts/components/film/FilmShell';

import { cn } from '@/lib/utils';

/* ---------------- Setup guide ---------------- */

const SETUP_STEPS = [
  { group: 'Organization', label: 'Brand' },
  { group: 'Monaco 2604', label: 'Details' },
  { group: 'Monaco 2604', label: 'Photos' },
  { group: 'Monaco 2604', label: 'Pricing' },
  { group: 'Monaco 2604', label: 'House rules' },
  { group: 'Verification', label: 'Go live' },
  { group: 'Finish', label: 'Invite team' },
];

export function SetupGuideScene() {
  const frame = useCurrentFrame();
  // Steps 0–2 are done; pricing completes on "Save & continue", then house rules opens.
  const saved = frame >= 128;
  const current = saved ? 4 : 3;
  const progress = ease(frame, 128, 150);
  const done = 3 + progress;

  return (
    <FilmScene
      camera={[
        { at: 0, x: 0.5, y: 0.5, zoom: 1 },
        { at: 70, x: 0.55, y: 0.46, zoom: 1.05 },
      ]}
    >
      <FilmShell
        context="property"
        active="Dashboard"
        title="Dashboard"
        subtitle="Monaco 2604 · October 2026"
        setupRemaining={7 - Math.floor(done)}
      >
        <div className="grid grid-cols-4 gap-4 opacity-60">
          <Kpi title="Revenue" value="₱0" icon={DollarSign} />
          <Kpi title="Bookings" value="0" icon={BookOpen} />
          <Kpi title="Occupancy" value="0%" icon={BarChart3} />
          <Kpi title="Avg nightly rate" value="₱0" icon={Tags} />
        </div>
      </FilmShell>

      <div className="absolute inset-0 bg-slate-950/40" style={{ opacity: ease(frame, 0, 14) }} />

      <div
        className="border-border bg-card absolute left-[150px] top-[66px] flex h-[588px] w-[980px] overflow-hidden rounded-2xl border shadow-2xl"
        style={popIn(frame, 4)}
      >
        <aside className="border-border bg-muted/40 w-[270px] shrink-0 border-r p-5">
          <p className="text-foreground text-sm font-semibold">Setup progress</p>
          <div className="bg-muted mt-2.5 h-2 overflow-hidden rounded-full">
            <div
              className="bg-primary h-full rounded-full"
              style={{ width: `${(done / SETUP_STEPS.length) * 100}%` }}
            />
          </div>
          <div className="mt-5 space-y-1">
            {SETUP_STEPS.map((step, index) => {
              const complete = index < Math.floor(done) || (index === 3 && saved);
              const active = index === current;
              const newGroup = index === 0 || SETUP_STEPS[index - 1].group !== step.group;
              return (
                <div key={step.label}>
                  {newGroup ? (
                    <p className="text-muted-foreground mb-1 mt-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider first:mt-0">
                      {step.group === 'Monaco 2604' ? <Home className="size-3" /> : null}
                      {step.group}
                    </p>
                  ) : null}
                  <div
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm',
                      active ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground'
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-5 items-center justify-center rounded-full border',
                        complete
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border'
                      )}
                    >
                      {complete ? <Check className="size-3" strokeWidth={3} /> : null}
                    </span>
                    {step.label}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        <div className="flex flex-1 flex-col">
          <div className="flex-1 p-7">
            <div className="mb-5 flex items-center gap-3">
              <span className="text-muted-foreground text-[13px] font-semibold tabular-nums">
                {saved ? '5' : '4'} / 7
              </span>
              <span className="text-foreground text-lg font-bold">
                {saved ? 'House rules' : 'Pricing'}
              </span>
            </div>
            {saved ? (
              <div className="space-y-4" style={reveal(frame, 136)}>
                <Field label="Check-in time" value="2:00 PM" />
                <Field label="Check-out time" value="12:00 PM" />
                <Field label="Max guests" value="4 adults, 2 children" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Weekday rate" value="₱3,200" />
                <Field label="Weekend rate" value="₱4,200" />
                <Field label="Cleaning fee" value="₱800" />
                <Field label="Security deposit" value="₱2,000" />
                <Field
                  className="col-span-2"
                  label="Extra guest fee"
                  value="₱500 per guest after 4"
                />
              </div>
            )}
          </div>
          <div className="border-border flex items-center justify-end gap-2 border-t px-7 py-4">
            <Btn variant="ghost">Back</Btn>
            <Btn variant="primary">Save & continue</Btn>
          </div>
        </div>
      </div>

      <Cursor
        path={[
          { at: 70, x: 760, y: 470 },
          { at: 118, x: 1060, y: 622, click: true },
          { at: 170, x: 1010, y: 560 },
        ]}
      />
    </FilmScene>
  );
}

/* ---------------- Portfolio (org dashboard) ---------------- */

const LISTINGS = [
  { name: 'Monaco 2604', meta: 'Condo · Azure North', revenue: 184650, occ: 80, icon: Home },
  { name: 'Aspen 1710', meta: 'Condo · Azure North', revenue: 141200, occ: 72, icon: Home },
  { name: 'Vista 0912', meta: 'Condo · Vista Shores', revenue: 98400, occ: 64, icon: Home },
  { name: 'Basement B2-14', meta: 'Parking · Azure North', revenue: 9800, occ: 61, icon: Car },
];

export function PortfolioScene() {
  const frame = useCurrentFrame();
  return (
    <FilmScene
      camera={[
        { at: 0, x: 0.5, y: 0.5, zoom: 1 },
        { at: 96, x: 0.62, y: 0.66, zoom: 1.2 },
      ]}
    >
      <FilmShell
        context="org"
        active="Dashboard"
        title="Dashboard"
        subtitle="Azure North Rentals · October 2026"
        actions={
          <>
            <Segmented options={['Week', 'Month', 'Year']} active="Month" />
            <Btn variant="primary" icon={Plus}>
              Add listing
            </Btn>
          </>
        }
      >
        <div className="grid grid-cols-4 gap-4">
          <Kpi
            title="Revenue"
            value={peso(countTo(frame, 434050, 8))}
            icon={DollarSign}
            change="+12.4%"
            style={reveal(frame, 4)}
          />
          <Kpi
            title="Bookings"
            value={String(countTo(frame, 46, 10))}
            icon={BookOpen}
            change="+8"
            style={reveal(frame, 7)}
          />
          <Kpi
            title="Occupancy"
            value={`${countTo(frame, 71, 12)}%`}
            icon={BarChart3}
            change="+5 pts"
            style={reveal(frame, 10)}
          />
          <Kpi title="Listings" value="4" icon={Building2} style={reveal(frame, 13)} />
        </div>

        <div className="mt-4 grid grid-cols-[1.25fr_1fr] gap-4">
          <Card style={reveal(frame, 16)}>
            <CardHeader icon={Building2} title="Listings" description="This month" />
            <div className="divide-border divide-y">
              {LISTINGS.map((listing, index) => (
                <div
                  key={listing.name}
                  className="flex items-center gap-3 py-3"
                  style={reveal(frame, 24 + index * 6)}
                >
                  <span className="bg-muted flex size-9 items-center justify-center rounded-lg">
                    <listing.icon className="text-muted-foreground size-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground text-sm font-semibold">{listing.name}</p>
                    <p className="text-muted-foreground text-xs">{listing.meta}</p>
                  </div>
                  <div className="w-[110px]">
                    <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                      <div
                        className="bg-primary h-full rounded-full"
                        style={{
                          width: `${listing.occ * ease(frame, 30 + index * 6, 70 + index * 6)}%`,
                        }}
                      />
                    </div>
                    <p className="text-muted-foreground mt-1 text-[11px]">
                      {listing.occ}% occupied
                    </p>
                  </div>
                  <p className="text-foreground w-[96px] text-right text-sm font-semibold tabular-nums">
                    {peso(listing.revenue)}
                  </p>
                </div>
              ))}
            </div>
          </Card>
          <Card style={reveal(frame, 20)}>
            <CardHeader icon={BarChart3} title="Revenue" description="All listings" />
            <AreaChart
              frame={frame}
              points={[32, 38, 35, 46, 52, 49, 61, 58, 70, 76, 74, 88]}
              height={232}
              width={420}
              startFrame={22}
              endFrame={80}
            />
          </Card>
        </div>
      </FilmShell>
    </FilmScene>
  );
}

/* ---------------- Property dashboard ---------------- */

const ATTENTION = [
  { label: 'Pending review', count: 2, tone: 'bg-rose-500' },
  { label: 'Awaiting documents', count: 1, tone: 'bg-amber-500' },
  { label: 'Check-in today', count: 1, tone: 'bg-sky-500' },
  { label: 'Security deposit refund', count: 1, tone: 'bg-amber-500' },
];

export function CommandCenterScene() {
  const frame = useCurrentFrame();
  return (
    <FilmScene
      camera={[
        { at: 0, x: 0.5, y: 0.5, zoom: 1 },
        { at: 100, x: 0.8, y: 0.62, zoom: 1.24 },
      ]}
    >
      <FilmShell
        context="property"
        active="Dashboard"
        title="Dashboard"
        subtitle="Monaco 2604 · October 2026"
        actions={
          <>
            <Segmented options={['Week', 'Month', 'Year']} active="Month" />
            <Btn icon={ExternalLink}>View Property</Btn>
          </>
        }
      >
        <div className="grid grid-cols-4 gap-4">
          <Kpi
            title="Revenue"
            value={peso(countTo(frame, 184650, 6))}
            icon={DollarSign}
            change="+12.4%"
            style={reveal(frame, 2)}
          />
          <Kpi
            title="Bookings"
            value={String(countTo(frame, 18, 8))}
            icon={BookOpen}
            change="+3"
            style={reveal(frame, 5)}
          />
          <Kpi
            title="Occupancy"
            value={`${countTo(frame, 74, 10)}%`}
            icon={BarChart3}
            change="+6 pts"
            style={reveal(frame, 8)}
          />
          <Kpi
            title="Avg nightly rate"
            value="₱3,480"
            icon={Tags}
            change="+4.1%"
            style={reveal(frame, 11)}
          />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <Card style={reveal(frame, 14)}>
            <CardHeader icon={CalendarDays} title="Calendar" description="October 2026" />
            <MonthGrid
              frame={frame}
              booked={[11, 12, 13, 14, 15, 16, 18, 19, 21, 22]}
              guests={{ 11: 'Leo U.', 14: 'Kyle S.', 18: 'Ria G.', 19: 'Joy T.', 21: 'Ana L.' }}
              blocked={[28]}
              cellHeight={46}
            />
          </Card>
          <Card style={reveal(frame, 18)}>
            <CardHeader
              icon={AlertTriangle}
              title="Needs attention"
              description="Bookings & reviews"
              action={<Btn className="h-8 px-3 text-[13px]">View</Btn>}
            />
            <div className="divide-border divide-y">
              {ATTENTION.map((item, index) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 py-3.5"
                  style={reveal(frame, 40 + index * 10)}
                >
                  <span className={cn('size-2.5 rounded-full', item.tone)} />
                  <span className="text-foreground flex-1 text-sm font-medium">{item.label}</span>
                  <span className="text-foreground text-sm font-semibold tabular-nums">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2" style={reveal(frame, 92)}>
              <Chip tone="rose">1 urgent</Chip>
              <Chip tone="primary" icon={ShieldCheck}>
                Receipts checked by AI
              </Chip>
            </div>
          </Card>
        </div>
      </FilmShell>
      <Cursor
        path={[
          { at: 104, x: 1060, y: 560 },
          { at: 140, x: 930, y: 412 },
          { at: 170, x: 1176, y: 302, click: true },
        ]}
      />
    </FilmScene>
  );
}
