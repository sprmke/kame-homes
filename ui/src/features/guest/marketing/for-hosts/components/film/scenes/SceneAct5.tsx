import {
  BarChart3,
  BellRing,
  Bot,
  Check,
  CircleDollarSign,
  ClipboardCheck,
  FileText,
  HelpCircle,
  Megaphone,
  MessageSquare,
  Newspaper,
  Paperclip,
  Plus,
  Search,
  Send,
  Shield,
  Sparkles,
  Ticket,
  Users,
  Wrench,
} from 'lucide-react';
import { useCurrentFrame } from 'remotion';

import {
  blink,
  countTo,
  Cursor,
  grow,
  PhoneFrame,
  PushIn,
  reveal,
  SceneHeading,
  SceneOutro,
  stepAt,
  StatusPill,
  SurfaceCard,
  TierBadge,
  typewriter,
} from '@/features/guest/marketing/for-hosts/components/film/FilmPrimitives';
import { FilmShell } from '@/features/guest/marketing/for-hosts/components/film/FilmShell';

import { cn } from '@/lib/utils';

/* ---------------- 15. Team & roles ---------------- */

export function TeamScene() {
  const frame = useCurrentFrame();
  const members = [
    ['MM', 'Michael Manlulu', 'Owner', 'Full access'],
    ['JC', 'Jamie Cruz', 'Operations', 'Bookings · maintenance · inbox'],
    ['RL', 'Rae Lim', 'Read only', 'View modules'],
  ];
  const roleRow = stepAt(frame, 110, 210, 4);
  return (
    <FilmShell activeLabel="Team">
      <PushIn>
        <SceneHeading
          eyebrow="Team and roles"
          title="Bring people in with the right access"
          frame={frame}
          action={
            <span
              className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-2.5 py-1.5 text-[10px] font-bold text-white"
              style={reveal(frame, 90)}
            >
              <Plus className="h-3.5 w-3.5" /> Invite member
            </span>
          }
        />

        <div className="grid grid-cols-4 gap-3">
          {[
            ['Members', `${countTo(frame, 3, 8)}`],
            ['Pending invites', `${countTo(frame, 1, 12)}`],
            ['Roles', `${countTo(frame, 4, 16)}`],
            ['Seats used', '3 / 5'],
          ].map(([label, value], index) => (
            <div
              key={label}
              className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
              style={reveal(frame, 8 + index * 6)}
            >
              <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                {label}
              </p>
              <p className="mt-1 text-[19px] font-black text-slate-900 dark:text-slate-50">
                {value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-3.5 grid grid-cols-[1.2fr_1fr] gap-4">
          <SurfaceCard title="Members" style={reveal(frame, 26)}>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {members.map(([initials, name, role, detail], index) => (
                <div
                  key={name}
                  className="flex items-center gap-3 py-2.5"
                  style={reveal(frame, 42 + index * 16, 6)}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {initials}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                      {name}
                    </p>
                    <p className="truncate text-[9px] text-slate-400 dark:text-slate-500">
                      {detail}
                    </p>
                  </div>
                  <StatusPill
                    label={role}
                    tone={role === 'Owner' ? 'teal' : role === 'Operations' ? 'sky' : 'slate'}
                  />
                </div>
              ))}
              <div className="flex items-center gap-3 py-2.5" style={reveal(frame, 90, 6)}>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-50 text-[10px] font-bold text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
                  DR
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                    dana@… · invited
                  </p>
                  <p className="text-[9px] text-slate-400 dark:text-slate-500">
                    Link valid for 7 days
                  </p>
                </div>
                <StatusPill label="Pending" tone="amber" />
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard
            title="Roles & permissions"
            action={
              <span className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <Plus className="h-3 w-3" /> New role <TierBadge tier="Starter" />
              </span>
            }
            style={reveal(frame, 40)}
          >
            <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="grid grid-cols-[1.4fr_0.6fr_0.6fr_0.6fr] bg-slate-50 px-3 py-2 text-[8px] font-bold uppercase tracking-wide text-slate-400 dark:bg-slate-800/50 dark:text-slate-500">
                <span>Capability</span>
                <span className="text-center">Full</span>
                <span className="text-center">Ops</span>
                <span className="text-center">Read</span>
              </div>
              {[
                ['Bookings', true, true, true],
                ['Finance', true, false, false],
                ['Team & settings', true, false, false],
                ['Inbox replies', true, true, false],
              ].map(([label, full, ops, read], index) => (
                <div
                  key={String(label)}
                  className={cn(
                    'grid grid-cols-[1.4fr_0.6fr_0.6fr_0.6fr] items-center px-3 py-2 text-[9px]',
                    index === roleRow ? 'bg-teal-50/60' : 'bg-white dark:bg-slate-900'
                  )}
                  style={reveal(frame, 100 + index * 14, 5)}
                >
                  <span className="font-bold text-slate-600 dark:text-slate-300">
                    {String(label)}
                  </span>
                  {[full, ops, read].map((on, cellIndex) => (
                    <span key={cellIndex} className="flex justify-center">
                      {on ? (
                        <Check className="h-3.5 w-3.5 text-teal-600 dark:text-teal-300" />
                      ) : (
                        <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                      )}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </SurfaceCard>
        </div>
      </PushIn>
      <SceneOutro text="Full Access, Operations, Read Only, or a custom role you define." />
    </FilmShell>
  );
}

/* ---------------- 16. Telegram notifications ---------------- */

export function NotificationsScene() {
  const frame = useCurrentFrame();
  const modules: [string, typeof Megaphone, string][] = [
    ['Chat', MessageSquare, 'Inbound guest messages'],
    ['Marketing', Megaphone, 'Content reminders'],
    ['Staff', Users, 'Shift & guest updates'],
    ['Operations', ClipboardCheck, 'Booking workflow alerts'],
    ['Finance', CircleDollarSign, 'Payment reminders'],
    ['Maintenance', Wrench, 'Property upkeep'],
  ];
  const connectedThrough = stepAt(frame, 34, 190, modules.length + 1);
  return (
    <FilmShell activeLabel="Notifications">
      <PushIn>
        <SceneHeading
          eyebrow="Telegram notifications"
          title="Right reminder, right team"
          frame={frame}
          action={<StatusPill label="Shared bot token · saved" tone="emerald" />}
        />

        <div className="grid grid-cols-[1.1fr_0.75fr] gap-5">
          <div className="space-y-2.5">
            {modules.map(([label, Icon, detail], index) => {
              const on = index < connectedThrough;
              return (
                <div
                  key={label}
                  className="flex items-center gap-3.5 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900"
                  style={reveal(frame, 8 + index * 13, 10)}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-600 dark:bg-teal-500/15 dark:text-teal-300">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-black text-slate-800 dark:text-slate-100">
                      {label}
                    </p>
                    <p className="text-[9px] text-slate-500 dark:text-slate-400">
                      {on ? `Connected · ${detail}` : 'Scan for chats →'}
                    </p>
                  </div>
                  <div
                    className={cn(
                      'ml-auto flex h-5 w-9 items-center rounded-full px-0.5',
                      on ? 'bg-teal-500' : 'bg-slate-200 dark:bg-slate-700'
                    )}
                  >
                    <span
                      className={cn('h-4 w-4 rounded-full bg-white shadow', on ? 'ml-auto' : '')}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="relative flex items-start justify-center">
            <PhoneFrame style={reveal(frame, 24)}>
              <div className="-mx-1 mb-1 flex items-center gap-2 rounded-xl bg-white px-2.5 py-2 shadow-sm dark:bg-slate-900">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-600 text-white">
                  <BellRing className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-black text-slate-800 dark:text-slate-100">
                    Azure North Ops
                  </p>
                  <p className="text-[8px] text-slate-400 dark:text-slate-500">Kame alerts bot</p>
                </div>
              </div>
              {[
                {
                  tag: 'OPERATIONS',
                  title: 'Booking moved forward',
                  detail: 'Kyle Soriano is now Ready for check-in. Send the door code.',
                  icon: ClipboardCheck,
                  delay: 66,
                },
                {
                  tag: 'FINANCE',
                  title: 'Payment reminder',
                  detail: 'Ana Reyes · ₱4,200 balance due tomorrow.',
                  icon: CircleDollarSign,
                  delay: 112,
                },
                {
                  tag: 'MAINTENANCE',
                  title: 'AC filter due',
                  detail: 'Unit 4B preventive service · today 4:30 PM.',
                  icon: Wrench,
                  delay: 158,
                },
                {
                  tag: 'MARKETING',
                  title: 'Post scheduled',
                  detail: '"Weekend escape" goes live on Instagram at 6 PM.',
                  icon: Megaphone,
                  delay: 200,
                },
              ].map(({ tag, title, detail, icon: Icon, delay }) => (
                <div
                  key={title}
                  className="rounded-2xl border border-slate-200 bg-white p-2.5 text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                  style={reveal(frame, delay, 20)}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-teal-50 text-teal-600 dark:bg-teal-500/15 dark:text-teal-300">
                      <Icon className="h-2.5 w-2.5" />
                    </span>
                    <span className="rounded bg-slate-100 px-1 text-[6px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      {tag}
                    </span>
                    <span className="ml-auto text-[7px] font-semibold text-slate-400 dark:text-slate-500">
                      now
                    </span>
                  </div>
                  <p className="mt-1 text-[9px] font-black text-slate-800 dark:text-slate-100">
                    {title}
                  </p>
                  <p className="mt-0.5 text-[8px] leading-relaxed text-slate-500 dark:text-slate-400">
                    {detail}
                  </p>
                </div>
              ))}
            </PhoneFrame>
            <div
              className="absolute -right-1 top-6 flex items-center gap-1 rounded-full bg-teal-600 px-2.5 py-1.5 text-[9px] font-black text-white shadow-lg"
              style={reveal(frame, 224, 18)}
            >
              <Check className="h-3 w-3" /> Delivered instantly
            </div>
          </div>
        </div>
      </PushIn>
      <SceneOutro text="Chat, marketing, staff, ops, finance, maintenance: each to its own group." />
    </FilmShell>
  );
}

/* ---------------- 17. Plans & billing + verification ---------------- */

export function PlansBillingScene() {
  const frame = useCurrentFrame();
  const tiers = [
    ['Free', '₱0', false],
    ['Starter', '₱399', false],
    ['Pro', '₱799', true],
    ['Business', '₱1,439', false],
    ['Managed', '₱3,999', false],
  ] as const;
  const reviewOn = frame > 150;
  return (
    <FilmShell
      context="org"
      activeLabel="Plans & Billing"
      workspace="Azure North Rentals"
      workspaceKicker="Organization"
    >
      <PushIn>
        <SceneHeading
          eyebrow="Plans and billing"
          title="Priced per property, billed once"
          frame={frame}
          action={<StatusPill label="3 properties covered" tone="teal" />}
        />

        <div className="grid grid-cols-5 gap-2.5" style={reveal(frame, 10)}>
          {tiers.map(([name, price, current], index) => (
            <div
              key={name}
              className={cn(
                'rounded-2xl border p-3.5 shadow-sm',
                current
                  ? 'border-teal-500 bg-teal-50 dark:border-teal-400 dark:bg-teal-500/15'
                  : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
              )}
              style={reveal(frame, 14 + index * 6)}
            >
              <p className="text-[11px] font-black text-slate-800 dark:text-slate-100">{name}</p>
              <p className="mt-1 text-[16px] font-black text-slate-900 dark:text-slate-50">
                {price}
                <span className="text-[8px] font-semibold text-slate-400 dark:text-slate-500">
                  {' '}
                  /prop/mo
                </span>
              </p>
              <span
                className={cn(
                  'mt-2 inline-block rounded-md px-1.5 py-0.5 text-[8px] font-bold',
                  current
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                )}
              >
                {current ? 'Current' : 'Choose'}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-[1.2fr_1fr] gap-4">
          <SurfaceCard title="Compare plans" subtitle="Grouped by module" style={reveal(frame, 40)}>
            <div className="space-y-1.5">
              {[
                ['Automated booking emails', 'Starter+'],
                ['Marketing Content Studio', 'Pro+'],
                ['Airbnb calendar sync', 'Pro+'],
                ['Publish in Meta platforms', 'Business+'],
                ['AI dashboard assistant', 'Business+'],
              ].map(([label, tier], index) => (
                <div
                  key={label}
                  className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5 dark:bg-slate-800/50"
                  style={reveal(frame, 62 + index * 12, 5)}
                >
                  <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                    {label}
                  </span>
                  <span className="text-[9px] font-bold text-teal-600 dark:text-teal-300">
                    {tier}
                  </span>
                </div>
              ))}
            </div>
          </SurfaceCard>

          <div className="space-y-3">
            <div
              className={cn(
                'rounded-2xl border p-4 shadow-sm',
                reviewOn
                  ? 'border-teal-400 bg-white dark:border-teal-500/50 dark:bg-slate-900'
                  : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
              )}
              style={reveal(frame, 104)}
            >
              <p className="text-[11px] font-black text-slate-800 dark:text-slate-100">
                Review · Free → Pro
              </p>
              <div className="mt-2 space-y-1 text-[9px] text-slate-500 dark:text-slate-400">
                <div className="flex justify-between">
                  <span>Pro · 3 properties</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200">₱2,397</span>
                </div>
                <div className="flex justify-between">
                  <span>Volume discount</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-300">−₱180</span>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-1 dark:border-slate-800">
                  <span className="font-bold text-slate-700 dark:text-slate-200">
                    Due today (prorated)
                  </span>
                  <span className="font-black text-slate-900 dark:text-slate-50">₱1,472</span>
                </div>
              </div>
              <div
                className={cn(
                  'mt-3 flex h-8 items-center justify-center rounded-lg text-[10px] font-black',
                  reviewOn
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                )}
              >
                Continue to payment
              </div>
            </div>

            <div
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
              style={reveal(frame, 182)}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-600 dark:bg-teal-500/15 dark:text-teal-300">
                <Shield className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[11px] font-black text-slate-800 dark:text-slate-100">
                  Verified listing
                </p>
                <p className="text-[9px] text-slate-500 dark:text-slate-400">
                  Ownership & contract approved
                </p>
              </div>
              <Check className="ml-auto h-4 w-4 text-emerald-500" />
            </div>
          </div>
        </div>
      </PushIn>
      <Cursor from={[720, 470]} to={[980, 150]} moveStart={124} moveEnd={148} clickAt={150} />
      <SceneOutro text="One bill covers every property, with volume discounts as you grow." />
    </FilmShell>
  );
}

/* ---------------- 18. AI dashboard assistant ---------------- */

export function AiAssistantScene() {
  const frame = useCurrentFrame();
  const answer =
    'Net profit this month is ₱215,120, up 24% on last month, from 18 stays across your 3 listings. Monaco 2604 leads at ₱94k.';
  const typed = typewriter(answer, frame, 60, 188);
  const barVals = [46, 58, 51, 72, 66, 84];
  const abilities = [
    ['Attach a booking or property for context', Paperclip, 30],
    ['Draft a guest reply or a report', FileText, 46],
    ['Jump you straight to the page', Send, 62],
  ] as const;

  return (
    <FilmShell activeLabel="Help & Support">
      <PushIn>
        <SceneHeading
          eyebrow="AI dashboard assistant"
          title="Ask your dashboard anything"
          frame={frame}
          action={<StatusPill label="Business plan" tone="amber" />}
        />

        <div className="grid grid-cols-[1.35fr_1fr] gap-4">
          <div
            className="flex h-[460px] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
            style={reveal(frame, 8)}
          >
            <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-600 text-white">
                <Bot className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[12px] font-black text-slate-800 dark:text-slate-100">
                  Dashboard assistant
                </p>
                <p className="text-[9px] text-slate-400 dark:text-slate-500">
                  Answers from your live data
                </p>
              </div>
              <span className="ml-auto flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[8px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <Paperclip className="h-2.5 w-2.5" /> Monaco 2604
              </span>
            </div>

            <div className="flex-1 space-y-3 p-4">
              <div
                className="ml-auto max-w-[74%] rounded-2xl rounded-br-md bg-teal-600 p-3 text-[11px] text-white shadow-sm"
                style={reveal(frame, 18)}
              >
                How’s profit this month, and which listing is doing best?
              </div>
              <div className="max-w-[92%]" style={reveal(frame, 46)}>
                <div className="rounded-2xl rounded-bl-md border border-slate-200 bg-slate-50 p-3.5 text-[11px] leading-relaxed text-slate-700 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-200">
                  {typed}
                  {frame < 190 ? (
                    <span
                      className="ml-0.5 inline-block h-3 w-0.5 bg-teal-600"
                      style={{ opacity: blink(frame) }}
                    />
                  ) : null}
                  <div className="mt-3 flex h-16 items-end gap-1.5" style={reveal(frame, 194, 6)}>
                    {barVals.map((v, i) => (
                      <div key={i} className="flex flex-1 items-end">
                        <div
                          className={cn(
                            'w-full rounded-t',
                            i === barVals.length - 1 ? 'bg-teal-500' : 'bg-teal-200'
                          )}
                          style={{ height: `${grow(frame, 0, v, 198 + i * 4, 238 + i * 4)}%` }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-2 flex gap-1.5" style={reveal(frame, 250, 8)}>
                  {['Open Finance', 'Compare listings', 'Export report'].map((chip) => (
                    <span
                      key={chip}
                      className="rounded-full border border-teal-200 bg-teal-50 px-2 py-1 text-[8px] font-bold text-teal-700 dark:border-teal-500/30 dark:bg-teal-500/15 dark:text-teal-300"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="m-4 flex h-10 items-center rounded-xl border border-slate-200 bg-white px-3 text-[10px] text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500">
              Ask about bookings, revenue, guests, tasks…
              <span className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg bg-teal-600 text-white">
                <Send className="h-3.5 w-3.5" />
              </span>
            </div>
          </div>

          <div className="space-y-2.5">
            <SurfaceCard title="It can also" icon={Sparkles} style={reveal(frame, 20)}>
              <div className="space-y-2">
                {abilities.map(([label, Icon, delay]) => (
                  <div
                    key={label}
                    className="flex items-center gap-2.5 rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/50"
                    style={reveal(frame, delay, 6)}
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-teal-600 shadow-sm dark:bg-slate-900 dark:text-teal-300">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </SurfaceCard>
            <div
              className="rounded-2xl bg-teal-600 p-4 text-white shadow-lg shadow-teal-600/20"
              style={reveal(frame, 210)}
            >
              <div className="flex items-center gap-2 text-teal-100">
                <BarChart3 className="h-4 w-4" />
                <span className="text-[9px] font-bold uppercase tracking-wide">Grounded</span>
              </div>
              <p className="mt-2 text-[11px] font-black leading-snug">
                Every answer comes from your own bookings, finance, and guest data — never a guess.
              </p>
            </div>
          </div>
        </div>
      </PushIn>
      <Cursor from={[560, 470]} to={[1040, 116]} moveStart={244} moveEnd={266} clickAt={268} />
      <SceneOutro text="Grounded in your data, and it can act on the answer for you." />
    </FilmShell>
  );
}

/* ---------------- 19. Help & Support ---------------- */

export function HelpSupportScene() {
  const frame = useCurrentFrame();
  const cards = [
    ['FAQs', HelpCircle, 'Short answers'],
    ['Guides', FileText, 'Every page'],
    ['Announcements', Newspaper, 'Product updates'],
    ['Tickets', Ticket, 'Message our team'],
    ['Ask AI', Sparkles, 'From your data'],
  ] as const;
  const activeCard = stepAt(frame, 28, 190, cards.length);

  return (
    <FilmShell activeLabel="Help & Support">
      <PushIn>
        <SceneHeading
          eyebrow="Help & Support"
          title="Answers, guides, updates, and a line to our team"
          frame={frame}
          action={<StatusPill label="Every team member" tone="slate" />}
        />

        <div className="grid grid-cols-5 gap-2.5" style={reveal(frame, 8)}>
          {cards.map(([label, Icon, sub], index) => (
            <div
              key={label}
              className={cn(
                'rounded-2xl border p-3 shadow-sm',
                index === activeCard
                  ? 'border-teal-500 bg-teal-50 dark:border-teal-400 dark:bg-teal-500/15'
                  : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
              )}
              style={reveal(frame, 12 + index * 6)}
            >
              <span
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg',
                  index === activeCard
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <p className="mt-2 text-[11px] font-black text-slate-800 dark:text-slate-100">
                {label}
              </p>
              <p className="text-[8px] text-slate-400 dark:text-slate-500">{sub}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-[1.15fr_1fr] gap-4">
          <SurfaceCard
            title="Guides"
            subtitle="A walkthrough for every page"
            style={reveal(frame, 40)}
          >
            <div className="flex h-8 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-[10px] text-slate-400 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-500">
              <Search className="h-3.5 w-3.5" /> Search 40+ guides
            </div>
            <div className="mt-2.5 space-y-1.5">
              {(
                [
                  ['Run the booking workflow', BellRing],
                  ['Connect Telegram alerts', Megaphone],
                  ['Set nightly rates & blocks', ClipboardCheck],
                ] as const
              ).map(([doc, Icon], index) => (
                <div
                  key={doc}
                  className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-2 text-[10px] font-semibold text-slate-600 dark:bg-slate-800/50 dark:text-slate-300"
                  style={reveal(frame, 66 + index * 12, 5)}
                >
                  <Icon className="h-3 w-3 text-teal-500 dark:text-teal-400" /> {doc}
                </div>
              ))}
            </div>
          </SurfaceCard>

          <SurfaceCard
            title="Tickets"
            subtitle="Tracked from your dashboard"
            style={reveal(frame, 50)}
          >
            <div className="space-y-2">
              {[
                ['Calendar not syncing to Airbnb', 'In progress', 'amber'],
                ['Add a bulk check-out action', 'Idea · open', 'sky'],
                ['Invoice for August', 'Resolved', 'emerald'],
              ].map(([subject, status, tone], index) => (
                <div
                  key={subject}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
                  style={reveal(frame, 80 + index * 14, 5)}
                >
                  <Ticket className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                  <p className="min-w-0 flex-1 truncate text-[10px] font-bold text-slate-700 dark:text-slate-200">
                    {subject}
                  </p>
                  <StatusPill label={status} tone={tone as 'amber' | 'sky' | 'emerald'} />
                </div>
              ))}
              <div
                className="flex h-8 items-center justify-center gap-1.5 rounded-lg bg-teal-600 text-[10px] font-black text-white"
                style={reveal(frame, 150)}
              >
                <Plus className="h-3.5 w-3.5" /> New ticket
              </div>
            </div>
          </SurfaceCard>
        </div>
      </PushIn>
      <SceneOutro text="Answers, guides, product updates, and a tracked line to our team." />
    </FilmShell>
  );
}
