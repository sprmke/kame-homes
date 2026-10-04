import {
  CalendarCheck,
  FileCheck2,
  Mail,
  ReceiptText,
  RefreshCw,
  ScanLine,
  Sparkles,
} from 'lucide-react';

import { Diamond } from '../primitives';
import { c } from '../theme';
import {
  Body,
  Btn,
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
  useAnim,
  type ScreenAnim,
} from './kit';

/* ------------------------------------------------------------------ *
 * Bookings: a stay moves forward on its own
 * ------------------------------------------------------------------ */

const activity = [
  { icon: FileCheck2, k: 'Guest form received', s: 'ID and 2 guests · 2:01 AM' },
  { icon: ReceiptText, k: 'Receipt verified', s: '₱8,400 matches · 2:14 AM' },
  { icon: CalendarCheck, k: 'GAF approved', s: 'Building replied · 9:12 AM' },
  { icon: Mail, k: 'Check-in guide sent', s: 'Door code and Wi-Fi · Sat 6:30 PM' },
];

export function BookingFlowScreen(a: ScreenAnim) {
  const { at, on } = useAnim(a);
  const stepAt = (i: number) => 14 + i * 26;
  const done = activity.filter((_, i) => on(stepAt(i) + 8)).length;
  const stage = done >= 4 ? 2 : done >= 2 ? 1 : 0;
  const status = ['Pending review', 'Pending documents', 'Ready for check-in'][stage];
  return (
    <Screen>
      <TitleBar back="Bookings" title="Maria Santos" />
      <Body top={140}>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Label>KH-2381 · Unit 2604</Label>
            <Pill tone={stage === 2 ? 'brand' : 'soft'}>{status}</Pill>
          </div>
          <div style={{ display: 'flex', gap: 18, marginTop: 14 }}>
            {[
              ['Stay', 'Oct 18 to 20'],
              ['Guests', '2'],
              ['Paid', '₱8,400'],
            ].map(([k, v]) => (
              <div key={k}>
                <Label style={{ fontSize: 12 }}>{k}</Label>
                <div
                  style={{
                    fontSize: 17,
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    marginTop: 2,
                    ...tab,
                  }}
                >
                  {v}
                </div>
              </div>
            ))}
          </div>
          <StageBar stage={stage} />
        </Card>
        <div style={{ fontSize: 15, fontWeight: 700, margin: '8px 4px 0' }}>Activity</div>
        <Card pad={14} style={{ paddingTop: 4, paddingBottom: 4, ...at(stepAt(0) - 4, 14) }}>
          {activity.map((r, i) => (
            <div key={r.k} style={at(stepAt(i), 14)}>
              <Row
                first={i === 0}
                lead={<IconTile icon={r.icon} size={36} />}
                title={r.k}
                sub={r.s}
                right={<CheckDot done={on(stepAt(i) + 8)} size={22} />}
              />
            </div>
          ))}
        </Card>
        <div style={{ display: 'flex', gap: 8, marginTop: 4, ...at(stepAt(3) + 20) }}>
          <Btn tone="ghost">Message guest</Btn>
          <Btn>Open booking</Btn>
        </div>
      </Body>
      <HomeBar />
    </Screen>
  );
}

function StageBar({ stage }: { stage: number }) {
  return (
    <div
      style={{
        position: 'relative',
        height: 22,
        marginTop: 16,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <span
        style={{
          position: 'absolute',
          left: 4,
          right: 4,
          top: 9,
          height: 4,
          borderRadius: 4,
          background: c.line,
        }}
      />
      <span
        style={{
          position: 'absolute',
          left: 4,
          width: `${(stage / 5) * 100}%`,
          top: 9,
          height: 4,
          borderRadius: 4,
          background: c.brand,
        }}
      />
      {Array.from({ length: 6 }, (_, i) => (
        <Diamond
          key={i}
          size={14}
          color={i <= stage ? c.brand : c.white}
          style={{
            position: 'relative',
            border: i <= stage ? undefined : `3px solid ${c.line}`,
            boxSizing: 'border-box',
          }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * AI receipt check
 * ------------------------------------------------------------------ */

const checks = [
  { k: 'Amount matches', s: '₱8,400.00 · booking total' },
  { k: 'Reference found', s: 'No. 4019 2283 7716' },
  { k: 'Date in window', s: 'Oct 12, 2:13 PM' },
];

export function ReceiptCheckScreen(a: ScreenAnim) {
  const { at, on, p } = useAnim(a);
  const scan = p(8, 44);
  const scanning = scan > 0 && scan < 1;
  const verified = on(98);
  return (
    <Screen>
      <TitleBar back="KH-2381" title="Payment receipt" />
      <Body top={140}>
        <div
          style={{
            position: 'relative',
            borderRadius: 22,
            background: c.white,
            border: `1px solid ${c.line}`,
            padding: '18px 20px',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <IconTile icon={ReceiptText} size={34} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Transfer successful</div>
              <div style={{ fontSize: 12, color: c.muted }}>Bank transfer · uploaded by guest</div>
            </div>
          </div>
          <div
            style={{
              fontSize: 34,
              fontWeight: 700,
              letterSpacing: '-0.045em',
              margin: '16px 0 10px',
              ...tab,
            }}
          >
            ₱8,400.00
          </div>
          {[
            ['Reference no.', '4019 2283 7716'],
            ['Date', 'Oct 12, 2026 2:13 PM'],
            ['Sent to', 'Kame Homes · ****4471'],
          ].map(([k, v]) => (
            <div
              key={k}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '7px 0',
                borderTop: `1px dashed ${c.line}`,
                fontSize: 13.5,
              }}
            >
              <span style={{ color: c.muted, fontWeight: 500 }}>{k}</span>
              <span style={{ fontWeight: 700, ...tab }}>{v}</span>
            </div>
          ))}
          {scanning ? (
            <span
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: `${scan * 100}%`,
                height: 3,
                background: c.brand,
              }}
            />
          ) : null}
          {scanning ? (
            <span
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                height: `${scan * 100}%`,
                background: 'hsl(162 80% 30% / 0.06)',
              }}
            />
          ) : null}
        </div>
        <Card pad={14} style={{ paddingTop: 10, paddingBottom: 4, ...at(40) }}>
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
            {verified ? <Sparkles size={14} /> : <ScanLine size={14} />}
            {verified ? 'AI check complete' : 'Reading receipt'}
          </div>
          {checks.map((r, i) => (
            <div key={r.k} style={at(50 + i * 14, 10)}>
              <Row
                first={i === 0}
                title={r.k}
                sub={r.s}
                right={<CheckDot done={on(58 + i * 14)} size={22} />}
              />
            </div>
          ))}
        </Card>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px',
            borderRadius: 22,
            background: c.brand,
            color: c.white,
            ...at(98),
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Verified</div>
            <div style={{ fontSize: 12.5, color: c.onBrandSub }}>Booking moved to Documents</div>
          </div>
          <CheckDot done size={30} />
        </div>
      </Body>
      <HomeBar />
    </Screen>
  );
}

/* ------------------------------------------------------------------ *
 * Channel sync: one calendar for Airbnb and direct
 * ------------------------------------------------------------------ */

type Stay = {
  from: number;
  to: number;
  who: string;
  src: 'direct' | 'airbnb' | 'blocked';
  at?: number;
};

const stays: Stay[] = [
  { from: 2, to: 4, who: 'J. Cruz', src: 'airbnb' },
  { from: 8, to: 10, who: 'Lim family', src: 'direct' },
  { from: 13, to: 14, who: 'Owner stay', src: 'blocked' },
  { from: 18, to: 20, who: 'Maria S.', src: 'direct' },
  { from: 23, to: 25, who: 'A. Tan', src: 'airbnb', at: 40 },
  { from: 29, to: 31, who: 'R. Gomez', src: 'direct' },
];

const srcColor = {
  direct: { bg: c.brand, fg: c.white },
  airbnb: { bg: c.ink, fg: c.white },
  blocked: { bg: 'hsl(150 6% 88%)', fg: c.inkSoft },
};

/** October 2026 starts on a Thursday. */
const FIRST_DOW = 4;
const CELL_W = 361 / 7;
const CELL_H = 50;

export function SyncCalendarScreen(a: ScreenAnim) {
  const { at, p, on } = useAnim(a);
  const synced = on(40);
  const cellPos = (d: number) => {
    const idx = FIRST_DOW + d - 1;
    return { col: idx % 7, row: Math.floor(idx / 7) };
  };
  // split a stay into week segments
  const segments = (s: Stay) => {
    const out: { row: number; c0: number; c1: number; first: boolean }[] = [];
    let d = s.from;
    while (d <= s.to) {
      const { row, col } = cellPos(d);
      const end = Math.min(s.to, d + (6 - col));
      out.push({ row, c0: col, c1: cellPos(end).col, first: d === s.from });
      d = end + 1;
    }
    return out;
  };
  return (
    <Screen>
      <TitleBar
        title="Calendar"
        right={
          <Pill tone={synced ? 'soft' : 'muted'} icon={RefreshCw}>
            {synced ? 'Synced now' : 'Syncing'}
          </Pill>
        }
      />
      <Body top={116}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            padding: '0 4px',
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>
            October 2026
          </div>
          <div
            style={{ display: 'flex', gap: 10, fontSize: 12, fontWeight: 600, color: c.inkSoft }}
          >
            {(['direct', 'airbnb'] as const).map((k) => (
              <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span
                  style={{ width: 9, height: 9, borderRadius: 3, background: srcColor[k].bg }}
                />
                {k === 'direct' ? 'Direct' : 'Airbnb'}
              </span>
            ))}
          </div>
        </div>
        <div style={{ position: 'relative', height: CELL_H * 5 + 24, margin: '2px -4px 0' }}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <span
              key={i}
              style={{
                position: 'absolute',
                left: i * CELL_W,
                width: CELL_W,
                top: 0,
                textAlign: 'center',
                fontSize: 11.5,
                fontWeight: 700,
                color: c.muted,
              }}
            >
              {d}
            </span>
          ))}
          {Array.from({ length: 31 }, (_, i) => {
            const { row, col } = cellPos(i + 1);
            return (
              <span
                key={i}
                style={{
                  position: 'absolute',
                  left: col * CELL_W + 6,
                  top: 24 + row * CELL_H + 4,
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: c.inkSoft,
                  ...tab,
                }}
              >
                {i + 1}
              </span>
            );
          })}
          {stays.flatMap((s) => {
            const grow = s.at === undefined ? 1 : p(s.at, s.at + 22);
            if (grow <= 0) return [];
            return segments(s).map((g, j) => (
              <div
                key={`${s.from}-${j}`}
                style={{
                  position: 'absolute',
                  left: g.c0 * CELL_W + 3,
                  top: 24 + g.row * CELL_H + 22,
                  width: ((g.c1 - g.c0 + 1) * CELL_W - 6) * grow,
                  height: 22,
                  borderRadius: 7,
                  background: srcColor[s.src].bg,
                  color: srcColor[s.src].fg,
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '0 7px',
                  display: 'flex',
                  alignItems: 'center',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                }}
              >
                {g.first ? s.who : ''}
              </div>
            ));
          })}
        </div>
        <Card pad={14} style={at(60)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <IconTile icon={RefreshCw} bg={c.ink} fg={c.white} size={38} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>New Airbnb booking</div>
              <div style={{ fontSize: 12.5, color: c.muted, marginTop: 2 }}>
                A. Tan · Oct 23 to 25
              </div>
            </div>
            <Pill tone="soft">Imported</Pill>
          </div>
          <div
            style={{
              marginTop: 12,
              padding: '10px 12px',
              borderRadius: 14,
              background: c.paper,
              fontSize: 13,
              fontWeight: 600,
              color: c.inkSoft,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              ...at(76, 8),
            }}
          >
            <CheckDot done size={18} /> Dates closed on your booking site
          </div>
        </Card>
      </Body>
      <HomeBar />
    </Screen>
  );
}

/* ------------------------------------------------------------------ *
 * Smart Pricing: a suggested rate for every night
 * ------------------------------------------------------------------ */

const week = [
  { d: 'Mon', n: 19, r: 3200 },
  { d: 'Tue', n: 20, r: 3200 },
  { d: 'Wed', n: 21, r: 3200 },
  { d: 'Thu', n: 22, r: 3400 },
  { d: 'Fri', n: 23, r: 3600, s: 4200 },
  { d: 'Sat', n: 24, r: 3600, s: 4200 },
  { d: 'Sun', n: 25, r: 3400 },
];

export function PricingScreen(a: ScreenAnim) {
  const { at, on } = useAnim(a);
  const applied = on(96);
  const k = (v: number) => `₱${(v / 1000).toFixed(1)}k`;
  return (
    <Screen>
      <TitleBar
        title="Pricing"
        right={
          <Pill tone="soft" icon={Sparkles}>
            Smart Pricing
          </Pill>
        }
      />
      <Body top={116}>
        <Card pad={14}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Oct 19 to 25</div>
            <Label>Unit 2604 · per night</Label>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: 5,
              marginTop: 12,
            }}
          >
            {week.map((w, i) => {
              const up = applied && w.s;
              return (
                <div
                  key={w.d}
                  style={{
                    borderRadius: 12,
                    padding: '8px 0 9px',
                    textAlign: 'center',
                    background: up ? c.brand : c.paper,
                    color: up ? c.white : c.ink,
                    ...at(6 + i * 3, 10),
                  }}
                >
                  <div style={{ fontSize: 10.5, fontWeight: 700, opacity: 0.7 }}>{w.d}</div>
                  <div style={{ fontSize: 17, fontWeight: 700, marginTop: 2, ...tab }}>{w.n}</div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, marginTop: 3, ...tab }}>
                    {k(up ? (w.s as number) : w.r)}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
        <Card style={at(36)}>
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
            <Sparkles size={14} /> Suggested for Fri and Sat
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 10 }}>
            <span
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: c.muted,
                textDecoration: 'line-through',
                ...tab,
              }}
            >
              ₱3,600
            </span>
            <span style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.045em', ...tab }}>
              ₱4,200
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: c.brandDeep }}>per night</span>
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.4, color: c.inkSoft, marginTop: 8 }}>
            Your last four October weekends sold out early.
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <Btn tone="ghost">Skip</Btn>
            <Btn tone={applied ? 'brand' : 'dark'}>{applied ? 'Applied' : 'Apply rate'}</Btn>
          </div>
        </Card>
        <Card pad={14} style={{ paddingTop: 4, paddingBottom: 4, ...at(60) }}>
          <Row first title="Weekend rate" sub="Fri and Sat" right={<Value v="+15%" />} />
          <Row title="Minimum stay" sub="Weekends" right={<Value v="2 nights" />} />
        </Card>
      </Body>
      <HomeBar />
    </Screen>
  );
}

function Value({ v }: { v: string }) {
  return <span style={{ fontSize: 15, fontWeight: 700, ...tab }}>{v}</span>;
}
