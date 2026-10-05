import { ArrowRight, Check, Instagram, Megaphone, Send, Sparkles, Video } from 'lucide-react';

import { cn } from '@/lib/utils';

import { AreaLine, KpiTile, Pill } from './ShowcasePrimitives';

/**
 * The six feature-group demo panels for the sticky showcase. Each is a static, token-based
 * recreation of the matching dashboard screen — structure sells "real product", not a palette.
 * The id → panel map lives in `showcaseDemoRegistry.ts` so this file exports only components.
 */

function DemoHead({ crumb, action }: { crumb: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <p className="text-foreground text-sm font-bold tracking-tight">{crumb}</p>
      {action}
    </div>
  );
}

function GhostButton({ children }: { children: React.ReactNode }) {
  return (
    <span className="border-border text-muted-foreground inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold">
      {children}
    </span>
  );
}

/* ---------------------------------------------------------------- *
 * Bookings — drag board + workflow
 * ---------------------------------------------------------------- */

export function BookingsDemo() {
  const columns = [
    {
      name: 'New',
      count: 3,
      cards: [
        { guest: 'Maria Santos', meta: 'Nov 12–15', tone: 'neutral' as const, tag: 'Review' },
        { guest: 'Kyle Ramos', meta: 'Nov 14–16', tone: 'neutral' as const, tag: 'Review' },
      ],
    },
    {
      name: 'Documents',
      count: 2,
      cards: [
        { guest: 'Ana Cruz', meta: 'GAF + pet', tone: 'amber' as const, tag: 'Needs you' },
        { guest: 'J. Villanueva', meta: 'GAF sent', tone: 'teal' as const, tag: 'Clearing' },
      ],
    },
    {
      name: 'Ready',
      count: 4,
      cards: [
        { guest: 'Grace Tan', meta: 'Guide sent', tone: 'green' as const, tag: 'Check in' },
        { guest: 'P. Reyes', meta: 'Nov 10', tone: 'green' as const, tag: 'Check in' },
      ],
    },
  ];

  return (
    <div className="flex h-full flex-col">
      <DemoHead crumb="Bookings board" action={<GhostButton>+ New booking</GhostButton>} />
      <div className="grid flex-1 grid-cols-3 gap-2">
        {columns.map((column) => (
          <div key={column.name} className="bg-muted/40 flex flex-col gap-2 rounded-xl p-2">
            <p className="text-muted-foreground flex items-center justify-between px-1 text-[11px] font-bold">
              {column.name}
              <span className="text-muted-foreground/70">{column.count}</span>
            </p>
            {column.cards.map((card) => (
              <div key={card.guest} className="border-border bg-card rounded-lg border p-2">
                <p className="text-foreground truncate text-[11px] font-semibold">{card.guest}</p>
                <p className="text-muted-foreground mt-0.5 truncate text-[10px]">{card.meta}</p>
                <Pill tone={card.tone} className="mt-1.5 text-[10px]">
                  {card.tone === 'amber' ? (
                    <span className="bg-warning h-1.5 w-1.5 rounded-full" aria-hidden />
                  ) : null}
                  {card.tag}
                </Pill>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="border-border bg-card mt-3 flex items-center gap-2 rounded-lg border p-2.5">
        <span className="bg-success/10 text-success flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
          <Check className="h-3.5 w-3.5" aria-hidden />
        </span>
        <p className="text-muted-foreground text-[11px]">
          <span className="text-foreground font-semibold">GAF approval filed</span> to booking
          #2048. No action needed.
        </p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- *
 * Calendar & pricing
 * ---------------------------------------------------------------- */

export function CalendarDemo() {
  const booked = [4, 5, 6, 17, 18];
  const blocked = [22, 23];
  const selected = 11;

  return (
    <div className="flex h-full flex-col">
      <DemoHead crumb="Calendar · October" action={<Pill tone="teal">Weekend ₱4,299</Pill>} />
      <div className="grid grid-cols-7 gap-1">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
          <div
            key={index}
            className="text-muted-foreground/70 pb-1 text-center text-[9px] font-bold uppercase"
          >
            {day}
          </div>
        ))}
        {Array.from({ length: 28 }, (_, index) => {
          const date = index + 1;
          const isBooked = booked.includes(date);
          const isBlocked = blocked.includes(date);
          const isSelected = date === selected;
          return (
            <div
              key={date}
              className={cn(
                'relative h-12 overflow-hidden rounded-md border p-1',
                isBlocked
                  ? 'border-border bg-muted'
                  : isBooked
                    ? 'border-primary/20 bg-primary/5'
                    : isSelected
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-card'
              )}
            >
              <span className="text-muted-foreground text-[9px] font-bold">{date}</span>
              {isBooked ? (
                <span className="bg-primary absolute inset-x-1 bottom-1 rounded px-1 text-[8px] font-bold text-white">
                  Booked
                </span>
              ) : isBlocked ? (
                <span className="text-muted-foreground/70 absolute inset-x-1 bottom-1 text-[8px] font-bold">
                  Blocked
                </span>
              ) : (
                <span
                  className={cn(
                    'absolute inset-x-1 bottom-1 text-[9px] font-bold',
                    isSelected ? 'text-primary' : 'text-muted-foreground'
                  )}
                >
                  {date % 6 === 0 ? '₱4,299' : '₱2,799'}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="border-border bg-card mt-3 flex items-center justify-between gap-2 rounded-lg border p-2.5">
        <p className="text-muted-foreground text-[11px]">
          <span className="text-foreground font-semibold">Airbnb synced</span> 2 min ago · in and
          out
        </p>
        <span className="bg-primary inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-white">
          Save rate
        </span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- *
 * Guest inbox & AI
 * ---------------------------------------------------------------- */

export function InboxDemo() {
  return (
    <div className="flex h-full flex-col">
      <DemoHead
        crumb="Inbox · Maria S."
        action={
          <span className="inline-flex items-center gap-1.5">
            <Pill tone="neutral">
              <Instagram className="h-3 w-3" aria-hidden /> Instagram
            </Pill>
            <Pill tone="green">Auto-reply on</Pill>
          </span>
        }
      />
      <div className="flex flex-1 flex-col gap-2">
        <div className="bg-muted text-foreground max-w-[80%] rounded-2xl rounded-tl-sm px-3 py-2 text-[11px]">
          Hi! Is the condo free for Nov 12–15?
        </div>
        <div className="bg-muted text-foreground max-w-[80%] rounded-2xl rounded-tl-sm px-3 py-2 text-[11px]">
          And is parking included?
        </div>
        <div className="border-primary/30 bg-primary/5 mt-1 rounded-xl border p-2.5">
          <p className="text-primary flex items-center gap-1.5 text-[10px] font-bold">
            <Sparkles className="h-3 w-3" aria-hidden /> AI suggested reply
          </p>
          <p className="text-foreground mt-1.5 text-[11px] leading-relaxed">
            Yes — Nov 12–15 is open. Parking is included for one vehicle, and I can send the booking
            link now if you would like to hold it.
          </p>
          <div className="mt-2 flex gap-1.5">
            <span className="bg-primary inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold text-white">
              <Send className="h-3 w-3" aria-hidden /> Send
            </span>
            <span className="border-border text-muted-foreground rounded-md border px-2.5 py-1 text-[11px] font-semibold">
              Edit
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- *
 * Money — finance + maintenance
 * ---------------------------------------------------------------- */

export function MoneyDemo() {
  return (
    <div className="flex h-full flex-col">
      <DemoHead crumb="Finance · Sunset Villa" action={<GhostButton>Export PDF</GhostButton>} />
      <div className="grid grid-cols-3 gap-2">
        <KpiTile label="Revenue" value="₱182,400" />
        <KpiTile label="Expenses" value="₱46,120" />
        <KpiTile label="Net profit" value="₱136,280" delta="+12%" />
      </div>
      <div className="border-border bg-card mt-3 flex-1 rounded-xl border p-3">
        <p className="text-muted-foreground text-[11px] font-semibold">Net profit · 6 months</p>
        <AreaLine points={[38, 44, 40, 58, 62, 78]} className="mt-2 h-16" />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="bg-success/10 text-success flex h-5 w-5 items-center justify-center rounded-full">
          <Check className="h-3 w-3" aria-hidden />
        </span>
        <p className="text-muted-foreground text-[11px]">
          Booking income posts here automatically as each stay closes
        </p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- *
 * Marketing & public pages
 * ---------------------------------------------------------------- */

export function MarketingDemo() {
  const posts = [
    'Sunset promo',
    'Long-stay deal',
    'Guest review',
    'New listing',
    'Holiday rates',
    'Walk-through reel',
  ];
  return (
    <div className="flex h-full flex-col">
      <DemoHead
        crumb="Content Studio"
        action={
          <span className="inline-flex gap-1">
            <Pill tone="neutral">Calendar</Pill>
            <Pill tone="teal">Design</Pill>
            <Pill tone="neutral">
              <Video className="h-3 w-3" aria-hidden /> Video
            </Pill>
          </span>
        }
      />
      <div className="grid flex-1 grid-cols-3 gap-2">
        {posts.map((post, index) => (
          <div
            key={post}
            className="border-border bg-card flex flex-col overflow-hidden rounded-lg border"
          >
            <div
              className={cn(
                'flex-1',
                index % 3 === 0 ? 'bg-primary/15' : index % 3 === 1 ? 'bg-primary/25' : 'bg-muted'
              )}
            />
            <p className="text-muted-foreground truncate px-1.5 py-1 text-[9px] font-semibold">
              {post}
            </p>
          </div>
        ))}
      </div>
      <div className="border-border bg-card mt-3 flex items-center justify-between gap-2 rounded-lg border p-2.5">
        <p className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
          <Sparkles className="text-primary h-3 w-3" aria-hidden /> Styled with AI
        </p>
        <span className="bg-primary inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-white">
          <Megaphone className="h-3 w-3" aria-hidden /> Publish
        </span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- *
 * Team & control
 * ---------------------------------------------------------------- */

export function TeamDemo() {
  const members = [
    { name: 'You', email: 'owner@sunsetvilla.ph', role: 'Full access', tone: 'teal' as const },
    { name: 'Lea M.', email: 'lea@ops.ph', role: 'Operations', tone: 'neutral' as const },
    { name: 'Rob C.', email: 'rob@ops.ph', role: 'Read only', tone: 'neutral' as const },
    { name: 'Cleaning', email: 'team@clean.ph', role: 'Custom role', tone: 'amber' as const },
  ];
  return (
    <div className="flex h-full flex-col">
      <DemoHead crumb="Team & roles" action={<GhostButton>Invite</GhostButton>} />
      <div className="flex flex-col gap-1.5">
        {members.map((member) => (
          <div
            key={member.name}
            className="border-border bg-card flex items-center gap-2.5 rounded-lg border p-2"
          >
            <span className="bg-primary/10 text-primary flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold">
              {member.name.charAt(0)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-foreground truncate text-[11px] font-semibold">{member.name}</p>
              <p className="text-muted-foreground truncate text-[10px]">{member.email}</p>
            </div>
            <Pill tone={member.tone} className="text-[10px]">
              {member.role}
            </Pill>
          </div>
        ))}
      </div>
      <div className="border-border bg-card mt-3 rounded-lg border p-2.5">
        <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wide">
          Telegram alerts
        </p>
        <div className="mt-1.5 space-y-1 text-[11px]">
          <p className="text-muted-foreground flex items-center gap-1.5">
            Finance <ArrowRight className="h-3 w-3" aria-hidden />
            <span className="text-foreground font-semibold">Owners group</span>
          </p>
          <p className="text-muted-foreground flex items-center gap-1.5">
            Maintenance <ArrowRight className="h-3 w-3" aria-hidden />
            <span className="text-foreground font-semibold">Ops group</span>
          </p>
        </div>
      </div>
    </div>
  );
}
