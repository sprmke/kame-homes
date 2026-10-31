import type { CSSProperties, ReactNode } from 'react';

import { CalendarDays, MapPin, Phone as PhoneIcon, Sparkles, Users } from 'lucide-react';

import { Diamond } from '../primitives';
import { c } from '../theme';
import {
  Body,
  Btn,
  Card,
  HomeBar,
  Label,
  Pill,
  Screen,
  tab,
  useAnim,
  type ScreenAnim,
} from './kit';

/* ------------------------------------------------------------------ *
 * AI receptionist: a guest calls, Kame answers
 * ------------------------------------------------------------------ */

const transcript: { who: 'guest' | 'kame'; text: string }[] = [
  { who: 'guest', text: 'Hi, is there parking for guests?' },
  { who: 'kame', text: 'Yes. Guest parking is on B2, slot 41. Show the guard your booking code.' },
  { who: 'guest', text: 'And what time is check-in?' },
  { who: 'kame', text: 'From 2 PM. Your door code arrives the morning of your stay.' },
];

const wave = [6, 14, 22, 12, 28, 18, 34, 20, 26, 12, 30, 16, 24, 10, 20, 8];

export function ReceptionistScreen(a: ScreenAnim) {
  const { at, frame, on, p } = useAnim(a);
  const start = (a.startAt ?? 0) + 0;
  const secs = 64 + Math.max(0, Math.floor((frame - start) / 30));
  const time =
    frame > 50_000
      ? '01:12'
      : `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  const lineAt = (i: number) => 8 + i * 26;
  return (
    <Screen bg={c.night} dark>
      <div style={{ position: 'absolute', top: 72, left: 0, right: 0, textAlign: 'center' }}>
        <span
          style={{
            width: 76,
            height: 76,
            borderRadius: 26,
            background: c.brand,
            display: 'inline-grid',
            placeItems: 'center',
          }}
        >
          <Diamond size={26} color={c.white} />
        </span>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em', marginTop: 14 }}>
          Kame receptionist
        </div>
        <div style={{ fontSize: 14, color: c.nightSub, marginTop: 4, ...tab }}>
          Guest of Unit 2604 · {time}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 4,
            height: 40,
            marginTop: 14,
          }}
        >
          {wave.map((h, i) => {
            const live = on(0) && frame < 50_000;
            const k = live ? 0.55 + 0.45 * Math.abs(Math.sin((frame + i * 7) / 6)) : 1;
            return (
              <span
                key={i}
                style={{ width: 4, height: h * k, borderRadius: 4, background: c.mint }}
              />
            );
          })}
        </div>
      </div>
      <Body top={296} gap={9}>
        {transcript.map((l, i) => (
          <Line key={i} who={l.who} style={at(lineAt(i), 14)}>
            {l.text}
          </Line>
        ))}
        <div
          style={{
            marginTop: 6,
            padding: '12px 14px',
            borderRadius: 18,
            background: c.nightSurface,
            border: `1px solid ${c.graphiteLine}`,
            fontSize: 13,
            fontWeight: 600,
            color: c.nightSub,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            opacity: p(lineAt(4), lineAt(4) + 16),
          }}
        >
          <Sparkles size={14} color={c.mint} /> Answered from your house guide. Summary saved to the
          inbox.
        </div>
      </Body>
      <div
        style={{
          position: 'absolute',
          bottom: 40,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            width: 64,
            height: 64,
            borderRadius: 99,
            background: c.coral,
            display: 'grid',
            placeItems: 'center',
            color: c.white,
          }}
        >
          <PhoneIcon size={26} style={{ transform: 'rotate(135deg)' }} />
        </span>
      </div>
      <HomeBar dark />
    </Screen>
  );
}

function Line({
  who,
  children,
  style,
}: {
  who: 'guest' | 'kame';
  children: ReactNode;
  style?: CSSProperties;
}) {
  const kame = who === 'kame';
  return (
    <div style={{ alignSelf: kame ? 'flex-end' : 'flex-start', maxWidth: 300, ...style }}>
      <div
        style={{
          fontSize: 11.5,
          fontWeight: 700,
          color: kame ? c.mint : c.nightSub,
          margin: kame ? '0 6px 4px 0' : '0 0 4px 6px',
          textAlign: kame ? 'right' : 'left',
        }}
      >
        {kame ? 'Kame' : 'Guest'}
      </div>
      <div
        style={{
          padding: '10px 14px',
          borderRadius: kame ? '18px 18px 6px 18px' : '18px 18px 18px 6px',
          background: kame ? c.mint : c.nightSurface,
          color: kame ? c.night : c.white,
          fontSize: 15,
          lineHeight: 1.36,
          letterSpacing: '-0.01em',
          fontWeight: kame ? 600 : 500,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Direct booking site
 * ------------------------------------------------------------------ */

/** Flat, geometric "photo" of a balcony view at dusk. No gradients, no stock. */
export function ViewArt({ w = 361, h = 180, r = 20 }: { w?: number; h?: number; r?: number }) {
  const towers = [
    [0, 70, 40],
    [34, 110, 30],
    [58, 52, 46],
    [100, 128, 26],
    [122, 84, 38],
    [158, 60, 30],
    [184, 140, 34],
    [214, 96, 42],
    [252, 66, 28],
    [276, 118, 36],
    [308, 78, 32],
    [336, 100, 40],
  ];
  return (
    <div
      style={{
        position: 'relative',
        width: w,
        height: h,
        borderRadius: r,
        overflow: 'hidden',
        background: 'hsl(28 70% 82%)',
      }}
    >
      <span
        style={{
          position: 'absolute',
          left: w * 0.62,
          top: h * 0.22,
          width: h * 0.34,
          height: h * 0.34,
          borderRadius: 99,
          background: 'hsl(36 96% 66%)',
        }}
      />
      <span
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: h * 0.52,
          bottom: 0,
          background: 'hsl(20 40% 70%)',
        }}
      />
      {towers.map(([x, th, tw], i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            left: (x / 361) * w,
            bottom: h * 0.18,
            width: (tw / 361) * w,
            height: (th / 180) * h * 0.7,
            background: i % 2 ? 'hsl(200 18% 34%)' : 'hsl(205 20% 26%)',
            borderRadius: '3px 3px 0 0',
          }}
        />
      ))}
      {/* balcony rail */}
      <span
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: h * 0.18,
          background: 'hsl(160 12% 12%)',
        }}
      />
      <span
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: h * 0.18,
          height: 4,
          background: 'hsl(160 10% 20%)',
        }}
      />
    </div>
  );
}

export function BookingSiteScreen(a: ScreenAnim) {
  const { at, on, p } = useAnim(a);
  const range = p(30, 52);
  const picked = (d: number) => d >= 18 && d <= 18 + Math.round(range * 2);
  const days = Array.from({ length: 14 }, (_, i) => 12 + i);
  return (
    <Screen bg={c.white}>
      <Body top={58} gap={12}>
        <ViewArt h={190} />
        <div style={{ padding: '0 4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.03em' }}>
              Skyline Suite 2604
            </div>
            <Pill tone="soft">Studio</Pill>
          </div>
          <div
            style={{
              display: 'flex',
              gap: 14,
              marginTop: 6,
              fontSize: 13,
              fontWeight: 600,
              color: c.muted,
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Users size={13} /> 2 guests
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <MapPin size={13} /> Makati
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <CalendarDays size={13} /> 2 night min
            </span>
          </div>
        </div>
        <Card pad={14} style={at(10)}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>October</div>
            <Label>Pick your dates</Label>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: 4,
              marginTop: 10,
            }}
          >
            {days.map((d) => {
              const sel = picked(d) && on(30);
              const booked = d === 14 || d === 15 || d === 23 || d === 24;
              return (
                <span
                  key={d}
                  style={{
                    height: 36,
                    borderRadius: 10,
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 14,
                    fontWeight: 700,
                    background: sel ? c.brand : 'transparent',
                    color: sel ? c.white : booked ? 'hsl(150 6% 76%)' : c.ink,
                    textDecoration: booked ? 'line-through' : undefined,
                    ...tab,
                  }}
                >
                  {d}
                </span>
              );
            })}
          </div>
        </Card>
        <Card pad={14} style={{ paddingTop: 6, paddingBottom: 6, ...at(56) }}>
          {[
            ['₱3,600 × 2 nights', '₱7,200'],
            ['Cleaning fee', '₱1,200'],
          ].map(([k, v]) => (
            <div
              key={k}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 0',
                fontSize: 14,
                color: c.inkSoft,
                ...tab,
              }}
            >
              <span>{k}</span>
              <span style={{ fontWeight: 600 }}>{v}</span>
            </div>
          ))}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '10px 0 6px',
              borderTop: `1px solid ${c.line}`,
              fontSize: 17,
              fontWeight: 700,
              ...tab,
            }}
          >
            <span>Total</span>
            <span>₱8,400</span>
          </div>
        </Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, ...at(70) }}>
          <Btn tone="brand" style={{ height: 52, fontSize: 16.5 }}>
            Book Oct 18 to 20
          </Btn>
        </div>
        <div style={{ textAlign: 'center', ...at(76, 8) }}>
          <Pill tone="muted">Guest form and payment on the next step</Pill>
        </div>
      </Body>
      <HomeBar />
    </Screen>
  );
}
