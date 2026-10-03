import {
  ArrowUp,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  Check,
  DollarSign,
  Inbox,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  Tags,
  UserPlus,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { useCurrentFrame } from 'remotion';

import {
  Btn,
  Card,
  CARD,
  CardHeader,
  Chip,
  Cursor,
  ease,
  Field,
  FilmScene,
  PhoneFrame,
  popIn,
  reveal,
  Segmented,
  Toggle,
  typewriter,
} from '@/features/guest/marketing/for-hosts/components/film/FilmPrimitives';
import { FilmShell } from '@/features/guest/marketing/for-hosts/components/film/FilmShell';

import { cn } from '@/lib/utils';

/* ---------------- Team & roles ---------------- */

const MEMBERS = [
  { initials: 'MR', name: 'Mika Reyes', email: 'mika@azurenorth.ph', role: 'Owner' },
  { initials: 'JC', name: 'Jon Cruz', email: 'jon@azurenorth.ph', role: 'Full Access' },
  { initials: 'BL', name: 'Bea Lopez', email: 'bea@azurenorth.ph', role: 'Read Only' },
];

const ROLES = [
  { name: 'Full Access', hint: 'Everything, including billing' },
  { name: 'Operations', hint: 'Bookings, inbox, and maintenance' },
  { name: 'Read Only', hint: 'View pages, change nothing' },
  { name: 'Custom', hint: 'Pick each permission' },
];

export function TeamScene() {
  const frame = useCurrentFrame();
  const dialog = frame >= 26 && frame < 142;
  const invited = frame >= 146;

  return (
    <FilmScene
      camera={[
        { at: 0, x: 0.5, y: 0.5, zoom: 1 },
        { at: 56, x: 0.5, y: 0.5, zoom: 1.1 },
        { at: 160, x: 0.48, y: 0.36, zoom: 1.12 },
      ]}
    >
      <FilmShell
        context="property"
        active="Team"
        title="Team"
        subtitle="People who can manage Monaco 2604"
        actions={
          <Btn variant="primary" icon={UserPlus}>
            Invite member
          </Btn>
        }
      >
        <Card className="p-0">
          {[
            ...MEMBERS,
            ...(invited
              ? [
                  {
                    initials: 'JT',
                    name: 'Joy Tan',
                    email: 'joy@azurenorth.ph',
                    role: 'Operations',
                  },
                ]
              : []),
          ].map((member, index) => (
            <div
              key={member.email}
              className="border-border/70 flex items-center gap-3 border-b px-5 py-4 last:border-b-0"
              style={
                index === 3
                  ? { ...reveal(frame, 146, 12), backgroundColor: 'hsl(var(--primary) / 0.06)' }
                  : reveal(frame, 2 + index * 4)
              }
            >
              <span className="bg-muted text-foreground flex size-9 items-center justify-center rounded-full text-xs font-semibold">
                {member.initials}
              </span>
              <div className="flex-1">
                <p className="text-foreground text-sm font-semibold">{member.name}</p>
                <p className="text-muted-foreground text-xs">{member.email}</p>
              </div>
              <Chip
                tone={
                  member.role === 'Owner'
                    ? 'primary'
                    : member.role === 'Operations'
                      ? 'sky'
                      : 'muted'
                }
              >
                {member.role}
              </Chip>
              {index === 3 ? <Chip tone="amber">Invited</Chip> : null}
            </div>
          ))}
        </Card>
      </FilmShell>

      {dialog ? (
        <>
          <div
            className="absolute inset-0 bg-slate-950/40"
            style={{ opacity: ease(frame, 26, 36) * (1 - ease(frame, 132, 142)) }}
          />
          <div
            className="border-border bg-card absolute left-[380px] top-[70px] w-[520px] rounded-2xl border p-6 shadow-2xl"
            style={{
              ...popIn(frame, 28),
              opacity: ease(frame, 28, 40) * (1 - ease(frame, 130, 142)),
            }}
          >
            <p className="text-foreground text-lg font-bold">Invite member</p>
            <Field
              className="mt-4"
              label="Email"
              value={typewriter('joy@azurenorth.ph', frame, 40, 70)}
              caret={frame < 72}
            />
            <p className="text-foreground mb-2 mt-4 text-[13px] font-medium">Role</p>
            <div className="space-y-2">
              {ROLES.map((role) => {
                const selected = role.name === 'Operations' && frame >= 88;
                return (
                  <div
                    key={role.name}
                    className={cn(
                      'flex items-center gap-3 rounded-xl border p-3',
                      selected ? 'border-primary bg-primary/5' : 'border-border'
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-5 items-center justify-center rounded-full border-2',
                        selected ? 'border-primary' : 'border-border'
                      )}
                    >
                      {selected ? <span className="bg-primary size-2.5 rounded-full" /> : null}
                    </span>
                    <div>
                      <p className="text-foreground text-sm font-semibold">{role.name}</p>
                      <p className="text-muted-foreground text-xs">{role.hint}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Btn>Cancel</Btn>
              <Btn variant="primary" icon={Send}>
                Send invite
              </Btn>
            </div>
          </div>
        </>
      ) : null}

      <Cursor
        path={[
          { at: 12, x: 1000, y: 200 },
          { at: 24, x: 1180, y: 46, click: true },
          { at: 86, x: 560, y: 298, click: true },
          { at: 124, x: 830, y: 572, click: true },
          { at: 170, x: 900, y: 360 },
        ]}
      />
    </FilmScene>
  );
}

/* ---------------- Telegram notifications ---------------- */

const MODULES = [
  { icon: BookOpen, name: 'Operations', group: 'Front desk' },
  { icon: Inbox, name: 'Chat', group: 'Front desk' },
  { icon: Wrench, name: 'Maintenance', group: 'Ops team' },
  { icon: DollarSign, name: 'Finance', group: 'Owners' },
  { icon: Megaphone, name: 'Marketing', group: 'Marketing' },
];

const ALERTS = [
  { at: 34, title: 'New booking', body: 'Ana Lim · Oct 21 – 23 · 2 guests' },
  { at: 74, title: 'New message', body: 'Instagram · “Is parking available?”' },
  { at: 114, title: 'Maintenance due tomorrow', body: 'Aircon cleaning · Monaco 2604' },
];

export function NotificationsScene() {
  const frame = useCurrentFrame();
  return (
    <FilmScene
      camera={[
        { at: 0, x: 0.5, y: 0.5, zoom: 1 },
        { at: 60, x: 0.74, y: 0.5, zoom: 1.12 },
      ]}
    >
      <FilmShell
        context="property"
        active="Notifications"
        title="Notifications"
        subtitle="Telegram alerts for Monaco 2604"
      >
        <div className="w-[560px]">
          <Card className="p-0">
            {MODULES.map((module, index) => (
              <div
                key={module.name}
                className="border-border/70 flex items-center gap-3 border-b px-5 py-4 last:border-b-0"
                style={reveal(frame, 2 + index * 4)}
              >
                <span className="bg-muted flex size-9 items-center justify-center rounded-lg">
                  <module.icon className="text-muted-foreground size-[18px]" />
                </span>
                <p className="text-foreground flex-1 text-sm font-semibold">{module.name}</p>
                <span className="border-border text-foreground rounded-lg border px-3 py-1.5 text-[13px]">
                  {module.group}
                </span>
                <Toggle on />
              </div>
            ))}
          </Card>
        </div>
      </FilmShell>
      <div className="absolute right-[90px] top-[90px]">
        <PhoneFrame className="h-[540px] w-[290px]" style={reveal(frame, 6, 16)}>
          <div className="bg-muted/60 flex h-full flex-col">
            <div className="bg-background border-border flex items-center gap-2.5 border-b px-4 pb-3 pt-10">
              <span className="flex size-9 items-center justify-center rounded-full bg-sky-500 text-white">
                <Send className="size-4" />
              </span>
              <div>
                <p className="text-foreground text-sm font-semibold">Front desk</p>
                <p className="text-muted-foreground text-[11px]">Telegram group · 4 members</p>
              </div>
            </div>
            <div className="flex flex-1 flex-col justify-end gap-2.5 p-3">
              {ALERTS.map((alert) => (
                <div
                  key={alert.title}
                  className="bg-background max-w-[230px] rounded-2xl rounded-bl-md p-3 shadow-sm"
                  style={reveal(frame, alert.at, 12)}
                >
                  <p className="text-foreground flex items-center gap-1.5 text-[13px] font-semibold">
                    <Bell className="text-primary size-3.5" /> {alert.title}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-xs">{alert.body}</p>
                </div>
              ))}
            </div>
          </div>
        </PhoneFrame>
      </div>
    </FilmScene>
  );
}

/* ---------------- AI mode ---------------- */

const RAIL = [LayoutDashboard, BookOpen, DollarSign, Tags, BarChart3, Users, Megaphone, Inbox];

export function AiModeScene() {
  const frame = useCurrentFrame();
  const question = 'Which bookings still need documents?';
  const asked = frame >= 62;
  const canvas = frame >= 112;

  return (
    <FilmScene
      camera={[
        { at: 0, x: 0.5, y: 0.5, zoom: 1 },
        { at: 70, x: 0.36, y: 0.6, zoom: 1.1 },
        { at: 150, x: 0.66, y: 0.5, zoom: 1.08 },
      ]}
    >
      <div className="bg-background flex h-full w-full">
        <aside className="border-sidebar-border bg-sidebar flex w-[64px] shrink-0 flex-col items-center gap-2 border-r py-4">
          <span className="bg-primary text-primary-foreground mb-2 flex size-9 items-center justify-center rounded-lg">
            <Building2 className="size-[18px]" />
          </span>
          {RAIL.map((Icon, index) => (
            <span
              key={index}
              className={cn(
                'flex size-10 items-center justify-center rounded-xl',
                index === 1 && canvas ? 'bg-primary text-primary-foreground' : 'text-sidebar-muted'
              )}
            >
              <Icon className="size-[18px]" />
            </span>
          ))}
        </aside>

        <div className="border-border flex w-[460px] shrink-0 flex-col border-r">
          <div className="border-border flex items-center justify-between border-b px-5 py-3.5">
            <p className="text-foreground flex items-center gap-2 text-base font-semibold">
              <Sparkles className="text-primary size-4" /> Assistant
            </p>
            <Segmented options={['Advanced', 'AI']} active="AI" />
          </div>
          <div className="flex flex-1 flex-col justify-end gap-3 p-5">
            <div className={cn(CARD, 'p-4')} style={reveal(frame, 4)}>
              <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                Today
              </p>
              <p className="text-foreground mt-1 text-sm">
                2 check-ins, 1 check-out, and ₱18,400 in new bookings this week.
              </p>
            </div>
            {asked ? (
              <div
                className="bg-primary text-primary-foreground ml-auto max-w-[340px] rounded-2xl rounded-br-md px-4 py-2.5 text-sm"
                style={reveal(frame, 62, 10)}
              >
                {question}
              </div>
            ) : null}
            {frame >= 80 ? (
              <div
                className="bg-muted text-foreground max-w-[380px] rounded-2xl rounded-bl-md px-4 py-3 text-sm"
                style={reveal(frame, 80, 12)}
              >
                Two bookings are waiting on documents: Joy Tan (Oct 19) and Ana Lim (Oct 21). I
                opened them for you.
                <span
                  className="bg-background text-primary mt-2.5 flex w-fit items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                  style={reveal(frame, 100)}
                >
                  <BookOpen className="size-3.5" /> Bookings · Pending Documents
                </span>
              </div>
            ) : null}
          </div>
          <div className="border-border border-t p-4">
            <div className="border-input flex items-center gap-2 rounded-2xl border px-4 py-3">
              <MessageSquare className="text-muted-foreground size-4" />
              <span className="text-foreground flex-1 text-sm">
                {asked ? (
                  <span className="text-muted-foreground">Ask anything…</span>
                ) : (
                  typewriter(question, frame, 14, 54)
                )}
              </span>
              <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-full">
                <ArrowUp className="size-4" />
              </span>
            </div>
          </div>
        </div>

        <div className="bg-muted/40 relative flex-1 p-5">
          {canvas ? (
            <div className={cn(CARD, 'h-full overflow-hidden')} style={popIn(frame, 112, 16)}>
              <div className="border-border flex items-center justify-between border-b px-5 py-3.5">
                <p className="text-foreground text-base font-semibold">Bookings</p>
                <span className="text-muted-foreground">
                  <X className="size-4" />
                </span>
              </div>
              <div className="p-5">
                <Chip tone="sky">Pending Documents · 2</Chip>
                {[
                  ['Joy Tan', 'Oct 19 – 20 · Valid ID missing'],
                  ['Ana Lim', 'Oct 21 – 23 · Parking form missing'],
                ].map(([name, meta], index) => (
                  <div
                    key={name}
                    className="border-border mt-3 flex items-center gap-3 rounded-xl border p-3.5"
                    style={reveal(frame, 124 + index * 8)}
                  >
                    <span className="bg-muted text-foreground flex size-9 items-center justify-center rounded-full text-xs font-semibold">
                      {name
                        .split(' ')
                        .map((part) => part[0])
                        .join('')}
                    </span>
                    <div className="flex-1">
                      <p className="text-foreground text-sm font-semibold">{name}</p>
                      <p className="text-muted-foreground text-xs">{meta}</p>
                    </div>
                    <Btn className="h-8 px-3 text-[13px]">Remind</Btn>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="border-border flex h-full items-center justify-center rounded-xl border border-dashed">
              <p className="text-muted-foreground text-sm">Pages open here</p>
            </div>
          )}
        </div>
      </div>
      <Cursor
        path={[
          { at: 54, x: 480, y: 640 },
          { at: 60, x: 492, y: 652, click: true },
          { at: 150, x: 900, y: 300 },
        ]}
      />
    </FilmScene>
  );
}

/* ---------------- Plans & billing ---------------- */

/** Per `docs/architecture/plans-feature-matrix.md`. No prices: those are live from the catalog. */
const TIERS = [
  { name: 'Free', hint: 'Get started', features: ['Bookings & calendar', 'Public pages'] },
  {
    name: 'Starter',
    hint: 'Automate the basics',
    features: ['Automated bookings', 'Finance reports', 'Telegram alerts'],
  },
  { name: 'Pro', hint: 'Most popular', features: ['Airbnb sync', 'Smart Pricing', 'AI photos'] },
  { name: 'Business', hint: 'Full AI suite', features: ['AI video', 'AI receptionist', 'AI mode'] },
];

export function PlansBillingScene() {
  const frame = useCurrentFrame();
  return (
    <FilmScene
      camera={[
        { at: 0, x: 0.5, y: 0.5, zoom: 1 },
        { at: 80, x: 0.56, y: 0.5, zoom: 1.1 },
      ]}
    >
      <FilmShell
        context="org"
        active="Plans & Billing"
        title="Plans & Billing"
        subtitle="One bill for every property in Azure North Rentals"
        actions={
          <Chip tone="emerald" icon={ShieldCheck}>
            Verified host
          </Chip>
        }
      >
        <div className="grid grid-cols-4 gap-4">
          {TIERS.map((tier, index) => {
            const featured = tier.name === 'Pro';
            return (
              <div
                key={tier.name}
                className={cn(
                  CARD,
                  'flex flex-col p-5',
                  featured && 'border-primary ring-primary/30 ring-2'
                )}
                style={reveal(frame, 6 + index * 6)}
              >
                <div className="flex items-center justify-between">
                  <p className="text-foreground text-lg font-bold">{tier.name}</p>
                  {featured ? <Chip tone="primary">Current</Chip> : null}
                </div>
                <p className="text-muted-foreground text-[13px]">{tier.hint}</p>
                <p className="text-muted-foreground mt-3 text-xs font-semibold uppercase tracking-wide">
                  Per property
                </p>
                <div className="mt-3 space-y-2">
                  {tier.features.map((feature) => (
                    <p key={feature} className="text-foreground flex items-center gap-2 text-sm">
                      <Check className="text-primary size-4" /> {feature}
                    </p>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <Card className="mt-4 flex items-center gap-6" style={reveal(frame, 44)}>
          <CardHeader
            icon={Building2}
            title="3 properties on Pro"
            description="Volume discount applied as you add listings"
          />
          <div className="ml-auto flex items-center gap-3">
            <Chip tone="emerald">Volume discount</Chip>
            <Btn variant="primary" icon={Plus}>
              Add property
            </Btn>
          </div>
        </Card>
      </FilmShell>
    </FilmScene>
  );
}
