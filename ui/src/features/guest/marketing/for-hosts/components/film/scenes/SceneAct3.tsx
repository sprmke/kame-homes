import { Bell, Check, CheckCircle2, Download, Home, Repeat, Wrench } from 'lucide-react';
import { useCurrentFrame } from 'remotion';

import {
  BarChart,
  countTo,
  Donut,
  grow,
  KpiCard,
  MiniMonthCalendar,
  PushIn,
  reveal,
  SceneHeading,
  SceneOutro,
  StatusPill,
  SurfaceCard,
  TierBadge,
} from '@/features/guest/marketing/for-hosts/components/film/FilmPrimitives';
import { FilmShell } from '@/features/guest/marketing/for-hosts/components/film/FilmShell';

import { cn } from '@/lib/utils';

/* ---------------- 6. Pricing ---------------- */

export function PricingScene() {
  const frame = useCurrentFrame();
  const overrideOn = frame > 118;
  const blockOn = frame > 168;
  return (
    <FilmShell activeLabel="Pricing">
      <PushIn>
        <SceneHeading
          eyebrow="Nightly pricing"
          title="Tune rates on the calendar"
          frame={frame}
          action={<StatusPill label="August 2026" tone="slate" />}
        />

        <div className="grid grid-cols-[1.5fr_0.62fr] gap-4">
          <div
            className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm"
            style={reveal(frame, 8)}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[12px] font-black text-slate-800 dark:text-slate-100">Monaco 2604</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">Nightly rates &amp; availability</p>
              </div>
              <div className="flex gap-3 text-[9px] font-semibold text-slate-500 dark:text-slate-400">
                <span>
                  <i className="mr-1 inline-block h-2 w-2 rounded-full bg-teal-500" />
                  Selected
                </span>
                <span>
                  <i className="mr-1 inline-block h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600" />
                  Booked
                </span>
              </div>
            </div>
            <MiniMonthCalendar
              frame={frame}
              booked={[4, 5, 6, 18, 19]}
              highlight={overrideOn ? [12, 13, 14] : []}
              blocked={blockOn ? [26, 27] : []}
              cellHeight={62}
            />
          </div>

          <div className="space-y-3" style={reveal(frame, 22)}>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm">
              <p className="text-[11px] font-black text-slate-800 dark:text-slate-100">Rate settings</p>
              <div className="mt-3 space-y-3">
                {[
                  ['Weekday', '₱2,799'],
                  ['Weekend', '₱3,899'],
                  ['Holiday premium', '+18%'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="mb-1 text-[9px] font-semibold text-slate-400 dark:text-slate-500">{label}</p>
                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-[11px] font-bold text-slate-700 dark:text-slate-200">
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div
              className="flex items-center gap-2.5 rounded-2xl bg-teal-600 p-3.5 text-white shadow-lg shadow-teal-600/20"
              style={reveal(frame, blockOn ? 172 : 148, 14)}
            >
              <CheckCircle2 className="h-4 w-4" />
              <div>
                <p className="text-[11px] font-black">
                  {blockOn ? 'Dates blocked' : 'Rates updated'}
                </p>
                <p className="text-[9px] text-teal-100">Calendar is live for guests</p>
              </div>
            </div>
          </div>
        </div>
      </PushIn>
      <SceneOutro text="Weekday, weekend, single-night rates, and blocked dates, in one grid." />
    </FilmShell>
  );
}

/* ---------------- 7. Finance ---------------- */

export function FinanceScene() {
  const frame = useCurrentFrame();
  return (
    <FilmShell activeLabel="Finance">
      <PushIn>
        <SceneHeading
          eyebrow="Finance and reporting"
          title="Know what each stay earns"
          frame={frame}
          action={
            <span
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-[10px] font-bold text-slate-600 dark:text-slate-300"
              style={reveal(frame, 90)}
            >
              <Download className="h-3.5 w-3.5" /> Export report <TierBadge tier="Starter" />
            </span>
          }
        />

        <div className="grid grid-cols-4 gap-3">
          {[
            ['Total income', `₱${countTo(frame, 286400, 6).toLocaleString()}`, '+18.2%', 'emerald'],
            ['Expenses', `₱${countTo(frame, 71280, 12).toLocaleString()}`, '-4.8%', 'rose'],
            ['Net profit', `₱${countTo(frame, 215120, 18).toLocaleString()}`, '+24.1%', 'teal'],
            ['Pending', `₱${countTo(frame, 18500, 24).toLocaleString()}`, '2 stays', 'slate'],
          ].map(([label, value, delta, tone], index) => (
            <KpiCard
              key={label}
              label={label}
              value={value}
              delta={delta}
              dense
              deltaTone={tone as 'emerald' | 'rose' | 'teal' | 'slate'}
              style={reveal(frame, 8 + index * 6)}
            />
          ))}
        </div>

        <div className="mt-3 grid grid-cols-[1.25fr_1fr] gap-4">
          <SurfaceCard
            title="Income vs expenses"
            subtitle="This period"
            className="p-4"
            style={reveal(frame, 30)}
          >
            <BarChart
              data={[68, 82, 62, 105, 94, 126, 114]}
              frame={frame}
              startFrame={44}
              highlightFrom={4}
              height={140}
            />
          </SurfaceCard>
          <SurfaceCard title="Category breakdown" className="p-4" style={reveal(frame, 40)}>
            <div className="flex items-center justify-center">
              <Donut
                frame={frame}
                startFrame={46}
                size={124}
                total="₱358k"
                segments={[
                  { value: 62, color: '#14b8a6' },
                  { value: 22, color: '#5eead4' },
                  { value: 16, color: '#e2e8f0' },
                ]}
              />
            </div>
          </SurfaceCard>
        </div>

        <SurfaceCard title="Recent activity" style={reveal(frame, 70)} className="mt-3 p-4">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {[
              ['Monaco 2604 · Kyle', 'Stay income', '+₱18,500', false],
              ['Electricity', 'Utilities · recurring', '−₱3,820', true],
              ['Parking settlement', 'Operations', '−₱800', false],
            ].map(([name, category, amount, recurring], index) => (
              <div
                key={String(name)}
                className="flex items-center py-2"
                style={reveal(frame, 96 + index * 14, 6)}
              >
                <span
                  className={cn(
                    'mr-3 flex h-7 w-7 items-center justify-center rounded-lg',
                    String(amount).startsWith('+')
                      ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  )}
                >
                  {recurring ? (
                    <Repeat className="h-3.5 w-3.5" />
                  ) : (
                    <Home className="h-3.5 w-3.5" />
                  )}
                </span>
                <div>
                  <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200">{String(name)}</p>
                  <p className="text-[9px] text-slate-400 dark:text-slate-500">{String(category)}</p>
                </div>
                {recurring ? (
                  <span className="ml-3 flex items-center gap-1 rounded-md bg-teal-50 dark:bg-teal-500/15 px-1.5 py-0.5 text-[8px] font-bold text-teal-600 dark:text-teal-300">
                    <Bell className="h-2.5 w-2.5" /> Reminder
                  </span>
                ) : null}
                <span
                  className={cn(
                    'ml-auto text-[11px] font-black',
                    String(amount).startsWith('+') ? 'text-emerald-600 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-200'
                  )}
                >
                  {String(amount)}
                </span>
              </div>
            ))}
          </div>
        </SurfaceCard>
      </PushIn>
      <SceneOutro text="Booking income lands on its own. Add expenses, then export." />
    </FilmShell>
  );
}

/* ---------------- 8. Maintenance ---------------- */

export function MaintenanceScene() {
  const frame = useCurrentFrame();
  const rows: [string, string, string, string, typeof Wrench][] = [
    ['AC filter replacement', 'Preventive', 'Today · 4:30 PM', 'Due', Wrench],
    ['Deep clean balcony', 'Cleaning', 'Tomorrow', 'Scheduled', Home],
    ['Smoke alarm test', 'Safety', 'Aug 3', 'Scheduled', Bell],
    ['Water heater inspection', 'Plumbing', 'Aug 5', 'Scheduled', Wrench],
  ];
  return (
    <FilmShell activeLabel="Maintenance">
      <PushIn>
        <SceneHeading
          eyebrow="Recurring upkeep"
          title="Upkeep becomes a routine"
          frame={frame}
          action={
            <span
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-[10px] font-bold text-slate-600 dark:text-slate-300"
              style={reveal(frame, 90)}
            >
              <Download className="h-3.5 w-3.5" /> Export report <TierBadge tier="Starter" />
            </span>
          }
        />

        <div className="grid grid-cols-4 gap-3">
          {[
            ['Total', `${countTo(frame, 12, 8)}`],
            ['Telegram enabled', `${countTo(frame, 9, 14)}`],
            ['Completed', `${countTo(frame, 8, 20)}`],
            ['Pending', `${countTo(frame, 4, 26)}`],
          ].map(([label, value], index) => (
            <KpiCard key={label} label={label} value={value} style={reveal(frame, 8 + index * 6)} />
          ))}
        </div>

        <div className="mt-3.5 grid grid-cols-[1fr_0.46fr] gap-4">
          <div
            className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm"
            style={reveal(frame, 28)}
          >
            <div className="grid grid-cols-[1.5fr_0.8fr_0.8fr_0.6fr] border-b border-slate-100 dark:border-slate-800 px-4 py-2.5 text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              <span>Task</span>
              <span>Category</span>
              <span>Schedule</span>
              <span>Status</span>
            </div>
            {rows.map(([task, category, schedule, status, Icon], index) => {
              const done = index === 0 && frame > 150;
              return (
                <div
                  key={task}
                  className="grid grid-cols-[1.5fr_0.8fr_0.8fr_0.6fr] items-center border-b border-slate-100 dark:border-slate-800 px-4 py-3"
                  style={reveal(frame, 40 + index * 16, 6)}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-xl',
                        done ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      )}
                    >
                      {done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                    </span>
                    <span
                      className={cn('text-[11px] font-bold', done && 'text-slate-400 dark:text-slate-500 line-through')}
                    >
                      {task}
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">{category}</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">{schedule}</span>
                  <StatusPill
                    label={done ? 'Done' : status}
                    tone={done ? 'emerald' : status === 'Due' ? 'amber' : 'slate'}
                  />
                </div>
              );
            })}
          </div>

          <div className="space-y-3">
            <SurfaceCard title="This month" style={reveal(frame, 44)}>
              <p className="text-[32px] font-black tracking-tight text-slate-900 dark:text-slate-50">
                {countTo(frame, 12, 50)}
              </p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">scheduled tasks</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-teal-500"
                  style={{ width: `${grow(frame, 10, 76, 60, 156)}%` }}
                />
              </div>
              <p className="mt-1.5 text-[9px] font-semibold text-slate-400 dark:text-slate-500">9 completed</p>
            </SurfaceCard>
            <div
              className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm"
              style={reveal(frame, 132)}
            >
              <div className="flex items-center gap-2 text-teal-600 dark:text-teal-300">
                <Bell className="h-3.5 w-3.5" />
                <span className="text-[9px] font-bold uppercase tracking-wider">Reminder sent</span>
              </div>
              <p className="mt-2 text-[12px] font-black text-slate-800 dark:text-slate-100">AC filter due · Unit 4B</p>
              <p className="mt-0.5 text-[9px] text-slate-500 dark:text-slate-400">Maintenance team · Telegram</p>
            </div>
          </div>
        </div>
      </PushIn>
      <SceneOutro text="Recurring upkeep scheduled, tracked, and pushed to your team." />
    </FilmShell>
  );
}
