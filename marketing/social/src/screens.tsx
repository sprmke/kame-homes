import type { CSSProperties } from 'react';

import { ChevronLeft, Sparkles } from 'lucide-react';

import { Push, StatusBar } from './device';
import { ease, reveal, SETTLED } from './motion';
import { Diamond } from './primitives';
import { c } from './theme';

const tab: CSSProperties = { fontVariantNumeric: 'tabular-nums' };

/* ------------------------------------------------------------------ *
 * Lock screen with Kame Homes notifications
 * ------------------------------------------------------------------ */

export const overnight = [
  {
    title: 'Receipt verified',
    body: '₱8,400 matches booking KH-2381. Moved to documents.',
    time: '2:14 AM',
  },
  {
    title: 'Pet approval received',
    body: 'Building approved Bruno for Unit 2604, Oct 18 to 20.',
    time: '3:02 AM',
  },
  {
    title: 'Check-in guide sent',
    body: 'Maria S. has her door code and Wi-Fi for Friday, 3 PM.',
    time: '6:30 AM',
  },
  { title: 'Airbnb calendar synced', body: '2 new nights blocked for November.', time: '7:05 AM' },
];

export function LockScreen({
  frame = SETTLED,
  startAt = 0,
  count = 3,
}: {
  frame?: number;
  startAt?: number;
  count?: number;
}) {
  const items = overnight.slice(0, count);
  return (
    <div style={{ position: 'absolute', inset: 0, background: c.brandDeep, overflow: 'hidden' }}>
      {/* flat wallpaper: two oversized brand diamonds, no gradients */}
      <Diamond
        size={520}
        color="hsl(162 72% 31%)"
        style={{ position: 'absolute', left: -170, top: 470, borderRadius: 90 }}
      />
      <Diamond
        size={380}
        color="hsl(162 86% 19%)"
        style={{ position: 'absolute', left: 190, top: 640, borderRadius: 70 }}
      />
      <StatusBar dark time="" />
      <div
        style={{
          position: 'absolute',
          top: 92,
          left: 0,
          right: 0,
          textAlign: 'center',
          color: c.white,
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em', opacity: 0.9 }}>
          Saturday, October 18
        </div>
        <div
          style={{
            fontSize: 104,
            fontWeight: 600,
            letterSpacing: '-0.04em',
            lineHeight: 1.0,
            marginTop: 2,
            ...tab,
          }}
        >
          7:12
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 12,
          right: 12,
          top: 246,
          display: 'flex',
          flexDirection: 'column',
          gap: 9,
        }}
      >
        {items.map((n, i) => (
          <div key={n.title} style={reveal(frame, startAt + i * 22, 30, 20)}>
            <Push {...n} />
          </div>
        ))}
      </div>
      <span
        style={{
          position: 'absolute',
          bottom: 10,
          left: '50%',
          width: 140,
          height: 5,
          marginLeft: -70,
          borderRadius: 3,
          background: 'hsl(0 0% 100% / 0.85)',
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Inbox thread with an AI suggested reply
 * ------------------------------------------------------------------ */

export function InboxScreen({
  frame = SETTLED,
  startAt = 0,
}: {
  frame?: number;
  startAt?: number;
}) {
  const typed = ease(frame, startAt + 40, startAt + 70);
  return (
    <div style={{ position: 'absolute', inset: 0, background: c.white, color: c.ink }}>
      <StatusBar />
      <div
        style={{
          position: 'absolute',
          top: 58,
          left: 0,
          right: 0,
          padding: '0 18px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          borderBottom: `1px solid ${c.line}`,
        }}
      >
        <ChevronLeft size={26} color={c.brand} />
        <span
          style={{
            width: 40,
            height: 40,
            borderRadius: 99,
            background: c.tint,
            color: c.brandDeep,
            display: 'grid',
            placeItems: 'center',
            fontSize: 15,
            fontWeight: 700,
          }}
        >
          MS
        </span>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em' }}>
            Maria Santos
          </div>
          <div style={{ fontSize: 13, color: c.muted, fontWeight: 500 }}>
            Messenger · Unit 2604, Oct 18 to 20
          </div>
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          top: 140,
          left: 16,
          right: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div
          style={{
            alignSelf: 'center',
            fontSize: 12,
            fontWeight: 600,
            color: c.muted,
            margin: '6px 0',
          }}
        >
          Today 11:48 PM
        </div>
        <Bubble side="in" style={reveal(frame, startAt, 16)}>
          Hi! We land at 10 AM on Friday. Any chance of an early check-in?
        </Bubble>
        <Bubble side="in" style={reveal(frame, startAt + 12, 16)}>
          Also, is there parking for an SUV?
        </Bubble>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 14,
          right: 14,
          top: 318,
          ...reveal(frame, startAt + 30, 24),
        }}
      >
        <div
          style={{
            borderRadius: 22,
            background: c.paper,
            border: `1px solid ${c.line}`,
            padding: 14,
          }}
        >
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
            <Sparkles size={14} /> Suggested reply
          </div>
          <div
            style={{
              fontSize: 15.5,
              lineHeight: 1.38,
              marginTop: 8,
              letterSpacing: '-0.01em',
              clipPath: `inset(0 ${(1 - typed) * 100}% 0 0)`,
            }}
          >
            Hi Maria! The unit is ready by 12 PM on Friday, and you can leave bags at the lobby
            before then. Guest parking is on B2, slot 41, and fits an SUV.
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <span
              style={{
                flex: 1,
                height: 42,
                borderRadius: 99,
                background: c.ink,
                color: c.white,
                display: 'grid',
                placeItems: 'center',
                fontSize: 15,
                fontWeight: 700,
              }}
            >
              Send
            </span>
            <span
              style={{
                flex: 1,
                height: 42,
                borderRadius: 99,
                border: `1px solid ${c.line}`,
                background: c.white,
                display: 'grid',
                placeItems: 'center',
                fontSize: 15,
                fontWeight: 600,
              }}
            >
              Edit
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Bubble({
  side,
  children,
  style,
}: {
  side: 'in' | 'out';
  children: string;
  style?: CSSProperties;
}) {
  const inbound = side === 'in';
  return (
    <div
      style={{
        alignSelf: inbound ? 'flex-start' : 'flex-end',
        maxWidth: 290,
        padding: '11px 15px',
        borderRadius: inbound ? '20px 20px 20px 6px' : '20px 20px 6px 20px',
        background: inbound ? 'hsl(150 8% 93%)' : c.brand,
        color: inbound ? c.ink : c.white,
        fontSize: 15.5,
        lineHeight: 1.36,
        letterSpacing: '-0.01em',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Finance
 * ------------------------------------------------------------------ */

const bars = [38, 52, 46, 61, 57, 70, 66, 78, 74, 86, 82, 95];

export function FinanceScreen({
  frame = SETTLED,
  startAt = 0,
}: {
  frame?: number;
  startAt?: number;
}) {
  const rows = [
    { k: 'Booking KH-2381', s: 'Oct 18 to 20 · Direct', v: '+₱8,400', pos: true },
    { k: 'Turnover cleaning', s: 'Oct 20 · Expense', v: '−₱1,200', pos: false },
    { k: 'Booking KH-2379', s: 'Oct 14 to 17 · Airbnb', v: '+₱12,600', pos: true },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, background: c.paper, color: c.ink }}>
      <StatusBar />
      <div style={{ position: 'absolute', top: 64, left: 20, right: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.035em' }}>Finance</div>
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              padding: '7px 12px',
              borderRadius: 99,
              background: c.white,
              border: `1px solid ${c.line}`,
            }}
          >
            October
          </span>
        </div>
        <div
          style={{
            marginTop: 16,
            padding: 18,
            borderRadius: 24,
            background: c.night,
            color: c.white,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, color: c.nightSub }}>Net profit</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4 }}>
            <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-0.045em', ...tab }}>
              ₱126,480
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: c.mint }}>+18% vs Sep</span>
          </div>
          <div
            style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 104, marginTop: 16 }}
          >
            {bars.map((b, i) => {
              const p = ease(frame, startAt + i * 3, startAt + i * 3 + 22);
              return (
                <span
                  key={i}
                  style={{
                    flex: 1,
                    height: `${b * p}%`,
                    borderRadius: 5,
                    background: i === bars.length - 1 ? c.mint : c.mintDim,
                  }}
                />
              );
            })}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
          {[
            ['Income', '₱184,650'],
            ['Expenses', '₱58,170'],
          ].map(([k, v]) => (
            <div
              key={k}
              style={{
                padding: '14px 16px',
                borderRadius: 20,
                background: c.white,
                border: `1px solid ${c.line}`,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: c.muted }}>{k}</div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  letterSpacing: '-0.035em',
                  marginTop: 2,
                  ...tab,
                }}
              >
                {v}
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 18, fontSize: 15, fontWeight: 700 }}>Recent</div>
        <div
          style={{
            marginTop: 6,
            borderRadius: 20,
            background: c.white,
            border: `1px solid ${c.line}`,
          }}
        >
          {rows.map((r, i) => (
            <div
              key={r.k}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '13px 16px',
                borderTop: i ? `1px solid ${c.line}` : undefined,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.015em' }}>
                  {r.k}
                </div>
                <div style={{ fontSize: 12.5, color: c.muted, marginTop: 1 }}>{r.s}</div>
              </div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: r.pos ? c.brandDeep : c.inkSoft,
                  ...tab,
                }}
              >
                {r.v}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

