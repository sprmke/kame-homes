import { Building2, Car, Plus } from 'lucide-react';
import { useCurrentFrame } from 'remotion';

import {
  AreaChart,
  countTo,
  Cursor,
  Donut,
  KpiCard,
  MiniMonthCalendar,
  PushIn,
  reveal,
  SceneOutro,
  SurfaceCard,
} from '@/features/guest/marketing/for-hosts/components/film/FilmPrimitives';
import { FilmShell } from '@/features/guest/marketing/for-hosts/components/film/FilmShell';

import { cn } from '@/lib/utils';

/* ---------------- 1. Portfolio (org dashboard) ---------------- */

export function PortfolioScene() {
  const frame = useCurrentFrame();
  const listings = [
    {
      name: 'Monaco 2604',
      meta: 'Azure North · Condo',
      revenue: '₱184,650',
      occ: '80%',
      kind: Building2,
    },
    {
      name: 'Aspen 1710',
      meta: 'Azure North · Condo',
      revenue: '₱141,200',
      occ: '72%',
      kind: Building2,
    },
    {
      name: 'Basement B2-14',
      meta: 'Azure North · Parking',
      revenue: '₱9,800',
      occ: '61%',
      kind: Car,
    },
  ];
  return (
    <FilmShell
      context="org"
      activeLabel="Dashboard"
      workspace="Azure North Rentals"
      workspaceKicker="Organization"
    >
      <PushIn>
        <div className="mb-4 flex items-end justify-between" style={reveal(frame)}>
          <div>
            <p className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.2em] text-teal-600 dark:text-teal-300">
              Organization workspace
            </p>
            <h2 className="text-[25px] font-extrabold tracking-tight">
              Every listing, one workspace
            </h2>
          </div>
          <span
            className="flex items-center gap-1.5 rounded-full bg-teal-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm"
            style={reveal(frame, 100)}
          >
            <Plus className="h-3.5 w-3.5" /> Add listing
          </span>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {[
            ['Total revenue', `₱${countTo(frame, 335650, 6).toLocaleString()}`, '+14.2%'],
            ['Total bookings', `${countTo(frame, 41, 12)}`, '+6'],
            ['Occupancy', `${countTo(frame, 74, 18)}%`, '+3.1%'],
            ['Listings', `${countTo(frame, 3, 24)}`, '2 condos · 1 parking'],
          ].map(([label, value, delta], index) => (
            <KpiCard
              key={label}
              label={label}
              value={value}
              delta={delta}
              deltaTone={index === 3 ? 'slate' : 'emerald'}
              style={reveal(frame, 8 + index * 7)}
            />
          ))}
        </div>

        <div className="mt-4 grid grid-cols-[1.5fr_1fr] gap-4">
          <SurfaceCard
            title="Revenue overview"
            subtitle="Revenue & bookings over time"
            style={reveal(frame, 34)}
          >
            <AreaChart
              points={[42, 55, 48, 63, 58, 74, 70, 88, 82, 96, 92, 108]}
              frame={frame}
              startFrame={44}
              endFrame={128}
              height={168}
            />
          </SurfaceCard>
          <SurfaceCard title="Booking status" subtitle="This month" style={reveal(frame, 50)}>
            <div className="flex items-center justify-center pt-2">
              <Donut
                frame={frame}
                startFrame={64}
                total="41"
                segments={[
                  { value: 22, color: '#14b8a6' },
                  { value: 11, color: '#5eead4' },
                  { value: 8, color: '#e2e8f0' },
                ]}
              />
            </div>
          </SurfaceCard>
        </div>

        <SurfaceCard title="Listings performance" style={reveal(frame, 74)} className="mt-4">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {listings.map((listing, index) => (
              <div
                key={listing.name}
                className="flex items-center gap-3 py-2.5"
                style={reveal(frame, 88 + index * 16, 8)}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-500/15 text-teal-600 dark:text-teal-300">
                  <listing.kind className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{listing.name}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">{listing.meta}</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-xs font-black text-slate-800 dark:text-slate-100">{listing.revenue}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">{listing.occ} occupied</p>
                </div>
              </div>
            ))}
          </div>
        </SurfaceCard>
      </PushIn>
      <Cursor from={[640, 470]} to={[928, 96]} moveStart={116} moveEnd={140} clickAt={142} />
      <SceneOutro text="One organization view across every property and parking." />
    </FilmShell>
  );
}

/* ---------------- 2. Command center (property dashboard) ---------------- */

export function CommandCenterScene() {
  const frame = useCurrentFrame();
  const stats = [
    {
      label: 'Net profit',
      value: `₱${countTo(frame, 184650, 8).toLocaleString()}`,
      delta: '+12.4%',
    },
    { label: 'Occupied nights', value: `${countTo(frame, 24, 16)}`, delta: '80%' },
    { label: 'Active bookings', value: `${countTo(frame, 18, 24)}`, delta: '+3' },
    {
      label: 'Avg. nightly rate',
      value: `₱${countTo(frame, 3840, 32).toLocaleString()}`,
      delta: '+6.1%',
    },
  ];
  return (
    <FilmShell activeLabel="Dashboard">
      <PushIn>
        <div className="mb-2.5 flex items-end justify-between" style={reveal(frame)}>
          <div>
            <p className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.2em] text-teal-600 dark:text-teal-300">
              Property command center
            </p>
            <h2 className="text-[22px] font-extrabold tracking-tight">See the whole operation</h2>
          </div>
          <span className="rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400">
            This month
          </span>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {stats.map((stat, index) => (
            <KpiCard
              key={stat.label}
              label={stat.label}
              value={stat.value}
              delta={stat.delta}
              dense
              deltaTone={index === 1 ? 'slate' : 'emerald'}
              style={reveal(frame, 8 + index * 7)}
            />
          ))}
        </div>

        <div className="mt-2.5 grid grid-cols-2 gap-3">
          <SurfaceCard
            title="Calendar"
            subtitle="Bookings & availability"
            className="p-4"
            style={reveal(frame, 36)}
          >
            <MiniMonthCalendar
              frame={frame}
              booked={[8, 9, 10, 21, 22]}
              weeks={4}
              cellHeight={40}
              showPrices={false}
            />
          </SurfaceCard>
          <SurfaceCard
            title="Needs attention"
            subtitle="Bookings & reviews"
            className="p-4"
            style={reveal(frame, 44)}
          >
            <div className="space-y-2">
              {[
                ['Check-in today', 'Kyle Soriano · 2:00 PM', 'rose'],
                ['Awaiting documents', 'Ana Reyes', 'amber'],
                ['SD refund due', 'Mia Tan', 'sky'],
              ].map(([label, sub, tone], index) => (
                <div
                  key={label}
                  className="flex items-center gap-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 p-2.5"
                  style={reveal(frame, 52 + index * 7, 6)}
                >
                  <span
                    className={cn(
                      'h-2 w-2 shrink-0 rounded-full',
                      tone === 'rose'
                        ? 'bg-rose-500'
                        : tone === 'amber'
                          ? 'bg-amber-500'
                          : 'bg-sky-500'
                    )}
                  />
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200">{label}</p>
                    <p className="truncate text-[10px] text-slate-400 dark:text-slate-500">{sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </SurfaceCard>
        </div>

        <SurfaceCard
          title="Cash flow"
          subtitle="Last 30 days · net +₱42,800"
          className="mt-3 p-4"
          style={reveal(frame, 56)}
        >
          <AreaChart
            points={[18, 24, 20, 31, 27, 38, 34, 44, 40, 52]}
            frame={frame}
            startFrame={66}
            endFrame={148}
            height={96}
          />
        </SurfaceCard>
      </PushIn>
      <SceneOutro text="Today's stays, cash flow, and tasks, without digging." />
    </FilmShell>
  );
}
