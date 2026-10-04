import type { CSSProperties, ReactNode } from 'react';

import {
  ArrowUpRight,
  BellRing,
  CalendarPlus,
  MessageCircle,
  Repeat,
  Sparkles,
  Wrench,
} from 'lucide-react';

import { ease } from '../motion';
import { Diamond } from '../primitives';
import { c } from '../theme';
import {
  Avatar,
  Body,
  Card,
  CheckDot,
  HomeBar,
  IconTile,
  Label,
  Pill,
  Row,
  Screen,
  tab,
  TitleBar,
  Toggle,
  useAnim,
  type ScreenAnim,
} from './kit';

/* ------------------------------------------------------------------ *
 * Team: choose what each person can see and do
 * ------------------------------------------------------------------ */

const perms: { k: string; s: string; on: boolean }[] = [
  { k: 'Bookings', s: 'View stays and guest names', on: true },
  { k: 'Check-in details', s: 'Door codes and arrival times', on: true },
  { k: 'Maintenance', s: 'See and complete tasks', on: true },
  { k: 'Guest inbox', s: 'Read and reply to guests', on: false },
  { k: 'Finance', s: 'Income, expenses, reports', on: false },
  { k: 'Settings', s: 'Property and billing', on: false },
];

export function TeamScreen(a: ScreenAnim) {
  const { at, on } = useAnim(a);
  return (
    <Screen>
      <TitleBar back="Team" title="Ana Reyes" right={<Pill tone="soft">Cleaner</Pill>} />
      <Body top={146}>
        <Card pad={14} style={at(0, 12)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar initials="AR" size={44} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Invite accepted</div>
              <div style={{ fontSize: 12.5, color: c.muted, marginTop: 2 }}>
                Unit 2604 and Unit 1810
              </div>
            </div>
            <CheckDot done size={24} />
          </div>
        </Card>
        <div style={{ fontSize: 15, fontWeight: 700, margin: '8px 4px 0' }}>What Ana can do</div>
        <Card pad={14} style={{ paddingTop: 2, paddingBottom: 2 }}>
          {perms.map((r, i) => (
            <Row
              key={r.k}
              first={i === 0}
              title={r.k}
              sub={r.s}
              right={<Toggle on={r.on && on(16 + i * 12)} />}
            />
          ))}
        </Card>
        <div style={{ ...at(70, 10) }}>
          <Pill tone="muted" style={{ alignSelf: 'flex-start' }}>
            Finance and settings stay private
          </Pill>
        </div>
      </Body>
      <HomeBar />
    </Screen>
  );
}

/* ------------------------------------------------------------------ *
 * Maintenance: recurring tasks and a done list
 * ------------------------------------------------------------------ */

export function MaintenanceScreen(a: ScreenAnim) {
  const { at, on, frame } = useAnim(a);
  const s0 = a.startAt ?? 0;
  const firstDone = on(40);
  const slide = ease(frame, s0 + 48, s0 + 70);
  return (
    <Screen>
      <TitleBar
        title="Maintenance"
        right={<Pill tone={firstDone ? 'soft' : 'sun'}>{firstDone ? '1 due' : '2 due'}</Pill>}
      />
      <Body top={116}>
        <Label style={{ margin: '0 4px' }}>Today</Label>
        <div style={{ height: (1 - slide) * 86, opacity: 1 - slide, overflow: 'hidden' }}>
          <Task
            done={firstDone}
            title="Aircon cleaning"
            sub="Unit 2604 · every 3 months"
            who="AR"
            tag={
              <Pill tone="muted" icon={Repeat}>
                Recurring
              </Pill>
            }
          />
        </div>
        <Task
          title="Turnover clean"
          sub="Unit 2604 · after Maria S. checks out"
          who="AR"
          tag={<Pill tone="sun">2 PM</Pill>}
          style={at(6, 12)}
        />
        <Label style={{ margin: '10px 4px 0' }}>Next 30 days</Label>
        {[
          ['Replace water filter', 'Unit 1810 · every 6 months', 'Oct 28'],
          ['Pest control', 'Both units · every quarter', 'Nov 3'],
        ].map(([t, s, d], i) => (
          <Task
            key={t}
            title={t}
            sub={s}
            who="JL"
            tag={<Pill tone="muted">{d}</Pill>}
            style={at(12 + i * 6, 12)}
          />
        ))}
        <Label style={{ margin: '10px 4px 0' }}>Done</Label>
        <Card pad={14} style={{ paddingTop: 2, paddingBottom: 2 }}>
          {slide > 0.5 ? (
            <Row
              first
              title="Aircon cleaning"
              sub="Done today by Ana"
              right={<CheckDot done size={22} />}
              style={{ opacity: (slide - 0.5) * 2 }}
            />
          ) : null}
          <Row
            first={slide <= 0.5}
            title="Smoke detector check"
            sub="Oct 2 · Unit 1810"
            right={<CheckDot done size={22} />}
          />
        </Card>
      </Body>
      <HomeBar />
    </Screen>
  );
}

function Task({
  title,
  sub,
  who,
  tag,
  done = false,
  style,
}: {
  title: string;
  sub: string;
  who: string;
  tag: ReactNode;
  done?: boolean;
  style?: CSSProperties;
}) {
  return (
    <Card pad={14} style={style}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <CheckDot done={done} size={26} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.015em' }}>{title}</div>
          <div style={{ fontSize: 12.5, color: c.muted, marginTop: 2 }}>{sub}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          {tag}
        </div>
        <Avatar initials={who} size={30} />
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * Telegram alerts: the team hears it first
 * ------------------------------------------------------------------ */

const alerts = [
  {
    icon: CalendarPlus,
    head: 'New booking',
    body: 'Maria S. · Unit 2604 · Oct 18 to 20 · ₱8,400 paid',
    time: '2:14 AM',
  },
  {
    icon: MessageCircle,
    head: 'Guest message',
    body: '"Is there parking for an SUV?" Reply drafted in the inbox.',
    time: '11:48 PM',
  },
  {
    icon: Wrench,
    head: 'Maintenance due',
    body: 'Aircon cleaning today · assigned to Ana',
    time: '7:00 AM',
  },
  {
    icon: BellRing,
    head: 'Check-out today',
    body: 'Unit 1810 · turnover at 12 PM',
    time: '7:01 AM',
  },
];

export function AlertsScreen(a: ScreenAnim) {
  const { at } = useAnim(a);
  return (
    <Screen bg={c.night} dark>
      <div
        style={{
          position: 'absolute',
          top: 54,
          left: 0,
          right: 0,
          padding: '8px 18px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          borderBottom: `1px solid ${c.graphiteLine}`,
        }}
      >
        <Avatar initials="OPS" bg={c.brand} fg={c.white} size={42} />
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em' }}>
            Unit 2604 ops
          </div>
          <div style={{ fontSize: 12.5, color: c.nightSub }}>Telegram group · 4 members</div>
        </div>
      </div>
      <Body top={136} gap={10}>
        {alerts.map((m, i) => (
          <div
            key={m.head}
            style={{
              alignSelf: 'flex-start',
              width: 318,
              padding: '12px 14px',
              borderRadius: '18px 18px 18px 6px',
              background: c.nightSurface,
              ...at(6 + i * 20, 16),
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Diamond size={10} color={c.mint} />
              <span style={{ fontSize: 12.5, fontWeight: 700, color: c.mint }}>Kame Homes</span>
              <span style={{ marginLeft: 'auto', fontSize: 11.5, color: c.nightSub, ...tab }}>
                {m.time}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <IconTile icon={m.icon} bg={c.graphite} fg={c.mint} size={30} />
              <span style={{ fontSize: 15, fontWeight: 700 }}>{m.head}</span>
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.38, color: 'hsl(150 8% 84%)', marginTop: 6 }}>
              {m.body}
            </div>
          </div>
        ))}
      </Body>
      <HomeBar dark />
    </Screen>
  );
}

/* ------------------------------------------------------------------ *
 * AI mode: ask in plain words, answers from live data
 * ------------------------------------------------------------------ */

const answerBars = [62, 70, 58, 74, 81, 100];

export function AiModeScreen(a: ScreenAnim) {
  const { at, frame, p } = useAnim(a);
  const s0 = a.startAt ?? 0;
  const think = p(20, 34);
  return (
    <Screen>
      <TitleBar
        title="Ask Kame"
        right={
          <Pill tone="soft" icon={Sparkles}>
            AI mode
          </Pill>
        }
      />
      <Body top={120} gap={12}>
        <Bubble style={at(0, 14)}>How did October do compared to September?</Bubble>
        <Card style={{ opacity: think, transform: `translateY(${(1 - think) * 16}px)` }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              fontWeight: 700,
              color: c.brandDeep,
            }}
          >
            <Sparkles size={14} /> From your Finance and Bookings
          </div>
          <div style={{ fontSize: 15.5, lineHeight: 1.42, marginTop: 8, letterSpacing: '-0.01em' }}>
            October net profit is <b style={tab}>₱126,480</b>, up 18% from September. You had 23
            booked nights across 2 units.
          </div>
          <div
            style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 70, marginTop: 14 }}
          >
            {answerBars.map((b, i) => {
              const g = ease(frame, s0 + 36 + i * 3, s0 + 56 + i * 3);
              return (
                <span
                  key={i}
                  style={{
                    flex: 1,
                    height: `${b * g}%`,
                    borderRadius: 6,
                    background: i === answerBars.length - 1 ? c.brand : c.tintPlane,
                  }}
                />
              );
            })}
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 6,
              fontSize: 11,
              fontWeight: 600,
              color: c.muted,
            }}
          >
            {['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'].map((m) => (
              <span key={m} style={{ flex: 1, textAlign: 'center' }}>
                {m}
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14, ...at(62, 8) }}>
            <Pill tone="dark" icon={ArrowUpRight}>
              Open Finance
            </Pill>
            <Pill tone="muted">Export report</Pill>
          </div>
        </Card>
        <Bubble style={at(80, 14)}>Who checks in this week?</Bubble>
        <Card pad={14} style={{ paddingTop: 2, paddingBottom: 2, ...at(96, 14) }}>
          <Row
            first
            lead={<Avatar initials="MS" size={32} />}
            title="Maria S."
            sub="Sun, Oct 18 · Unit 2604"
            right={<Pill tone="soft">Ready</Pill>}
          />
          <Row
            lead={<Avatar initials="AT" size={32} />}
            title="A. Tan"
            sub="Fri, Oct 23 · Unit 2604"
            right={<Pill tone="sun">Docs due</Pill>}
          />
        </Card>
      </Body>
      <HomeBar />
    </Screen>
  );
}

function Bubble({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        alignSelf: 'flex-end',
        maxWidth: 290,
        padding: '11px 15px',
        borderRadius: '20px 20px 6px 20px',
        background: c.ink,
        color: c.white,
        fontSize: 15.5,
        lineHeight: 1.36,
        letterSpacing: '-0.01em',
        fontWeight: 500,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
