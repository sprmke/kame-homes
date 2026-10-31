import type { CSSProperties, ReactNode } from 'react';

import { ArrowLeftRight, Check, Sparkles } from 'lucide-react';

import { pop, SETTLED } from './motion';
import { Diamond } from './primitives';
import { c } from './theme';

/**
 * Apple-style bento: one hero tile plus five single-idea tiles, each a flat color field.
 * Layout is chosen per format; tile content is flex/percent based so any size works.
 */

type Layout = 'wide' | 'tall' | 'square';

const areas: Record<Layout, { cols: string; rows: string; areas: string }> = {
  wide: { cols: '1.25fr 1.25fr 1fr 1fr 1fr', rows: '1fr 1fr', areas: '"a a b c c" "a a d e f"' },
  square: { cols: '1fr 1fr 1fr', rows: '1fr 1fr 1fr', areas: '"a a b" "a a c" "d e f"' },
  tall: { cols: '1fr 1fr', rows: '1.25fr 1fr 1fr 0.8fr', areas: '"a a" "b c" "d e" "f f"' },
};

export function Bento({
  w,
  h,
  layout,
  s = 1,
  gap = 18,
  frame = SETTLED,
  startAt = 0,
}: {
  w: number;
  h: number;
  layout: Layout;
  /** Type scale multiplier. */
  s?: number;
  gap?: number;
  frame?: number;
  startAt?: number;
}) {
  const g = areas[layout];
  const at = (i: number) => pop(frame, startAt + i * 7, 22);
  return (
    <div
      style={{
        width: w,
        height: h,
        display: 'grid',
        gridTemplateColumns: g.cols,
        gridTemplateRows: g.rows,
        gridTemplateAreas: g.areas,
        gap,
      }}
    >
      <Tile
        area="a"
        bg={c.night}
        fg={c.white}
        s={s}
        style={at(0)}
        title="One path for every booking"
        big
      >
        <HeroRail s={s} horizontal={layout === 'tall'} compact={layout === 'square'} />
      </Tile>
      <Tile area="b" bg={c.white} fg={c.ink} s={s} style={at(1)} title="Net profit, October">
        <div
          style={{
            fontSize: 42 * s,
            fontWeight: 700,
            letterSpacing: '-0.05em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          ₱126,480
        </div>
        <Bars s={s} />
      </Tile>
      <Tile area="c" bg={c.tintPlane} fg={c.ink} s={s} style={at(2)} title="Two-way Airbnb sync">
        <span
          style={{
            width: 84 * s,
            height: 84 * s,
            borderRadius: 99,
            background: c.night,
            color: c.mint,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <ArrowLeftRight size={40 * s} strokeWidth={2.4} />
        </span>
      </Tile>
      <Tile area="d" bg={c.white} fg={c.ink} s={s} style={at(3)} title="AI receipt check">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 * s }}>
          {['Amount', 'Reference', 'Date'].map((k) => (
            <div
              key={k}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10 * s,
                fontSize: 22 * s,
                fontWeight: 600,
                color: c.inkSoft,
              }}
            >
              <span
                style={{
                  width: 28 * s,
                  height: 28 * s,
                  borderRadius: 99,
                  background: c.brand,
                  color: c.white,
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <Check size={17 * s} strokeWidth={3.2} />
              </span>
              {k}
            </div>
          ))}
        </div>
      </Tile>
      <Tile area="e" bg={c.brand} fg={c.white} s={s} style={at(4)} title="Smart Pricing">
        <MiniCalendar s={s} />
      </Tile>
      <Tile area="f" bg={c.graphite} fg={c.white} s={s} style={at(5)} title="Every message, one inbox">
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: 8 * s, alignItems: 'flex-start' }}
        >
          <span
            style={{
              padding: `${9 * s}px ${14 * s}px`,
              borderRadius: `${16 * s}px ${16 * s}px ${16 * s}px ${4 * s}px`,
              background: c.nightSurface,
              fontSize: 19 * s,
              fontWeight: 500,
            }}
          >
            Early check-in possible?
          </span>
          <span
            style={{
              alignSelf: 'flex-end',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6 * s,
              padding: `${9 * s}px ${14 * s}px`,
              borderRadius: `${16 * s}px ${16 * s}px ${4 * s}px ${16 * s}px`,
              background: c.mint,
              color: c.night,
              fontSize: 19 * s,
              fontWeight: 600,
            }}
          >
            <Sparkles size={15 * s} /> Ready by 12 PM
          </span>
        </div>
      </Tile>
    </div>
  );
}

function Tile({
  area,
  bg,
  fg,
  s,
  title,
  big = false,
  children,
  style,
}: {
  area: string;
  bg: string;
  fg: string;
  s: number;
  title: string;
  big?: boolean;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const border = bg === c.white ? `1px solid ${c.line}` : undefined;
  return (
    <div
      style={{
        gridArea: area,
        background: bg,
        color: fg,
        border,
        borderRadius: 34 * s,
        padding: 30 * s,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        overflow: 'hidden',
        minWidth: 0,
        minHeight: 0,
        ...style,
      }}
    >
      <div>{children}</div>
      <div
        style={{
          fontSize: (big ? 52 : 26) * s,
          fontWeight: 700,
          letterSpacing: big ? '-0.045em' : '-0.025em',
          lineHeight: 1.04,
          maxWidth: big ? '12ch' : undefined,
        }}
      >
        {title}
      </div>
    </div>
  );
}

const RAIL = ['Booked', 'Documents', 'Check-in', 'Check-out', 'Deposit', 'Completed'];

/** Stage rail for the hero tile: vertical list on roomy tiles, a labelled strip on flat ones. */
function HeroRail({ s, horizontal, compact = false }: { s: number; horizontal: boolean; compact?: boolean }) {
  if (horizontal) return <MiniPath s={s} />;
  const n = 26 * s;
  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: (compact ? 7 : 16) * s }}>
      <div style={{ position: 'absolute', left: n / 2 - 3 * s, top: n / 2, bottom: n / 2, width: 6 * s, background: c.graphiteLine, borderRadius: 6 }} />
      <div style={{ position: 'absolute', left: n / 2 - 3 * s, top: n / 2, height: `${(2 / 5) * 100}%`, width: 6 * s, background: c.mint, borderRadius: 6 }} />
      {RAIL.map((label, i) => (
        <div key={label} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 18 * s }}>
          <Diamond
            size={n}
            color={i < 2 ? c.mint : i === 2 ? c.night : c.night}
            style={{ border: i < 2 ? undefined : `${4 * s}px solid ${i === 2 ? c.mint : c.graphiteLine}`, boxSizing: 'border-box' }}
          />
          <span style={{ fontSize: 24 * s, fontWeight: 600, color: i <= 2 ? c.white : c.nightSub }}>{label}</span>
          {i === 2 ? (
            <span style={{ fontSize: 17 * s, fontWeight: 700, padding: `${5 * s}px ${12 * s}px`, borderRadius: 99, background: c.mint, color: c.night }}>Today</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function MiniPath({ s }: { s: number }) {
  return (
    <div
      style={{
        position: 'relative',
        height: 40 * s,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 6 * s,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '50%',
          height: 7 * s,
          marginTop: -3.5 * s,
          background: c.graphiteLine,
          borderRadius: 9,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          width: '58%',
          top: '50%',
          height: 7 * s,
          marginTop: -3.5 * s,
          background: c.mint,
          borderRadius: 9,
        }}
      />
      {Array.from({ length: 6 }, (_, i) => (
        <Diamond
          key={i}
          size={26 * s}
          color={i < 3 ? c.mint : c.night}
          style={{
            position: 'relative',
            border: i < 3 ? undefined : `${4 * s}px solid ${c.graphiteLine}`,
            boxSizing: 'border-box',
          }}
        />
      ))}
    </div>
  );
}

function Bars({ s }: { s: number }) {
  const v = [40, 55, 48, 66, 60, 74, 70, 88];
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 6 * s,
        height: 64 * s,
        marginTop: 14 * s,
      }}
    >
      {v.map((b, i) => (
        <span
          key={i}
          style={{
            flex: 1,
            height: `${b}%`,
            borderRadius: 5 * s,
            background: i === v.length - 1 ? c.brand : c.tintPlane,
          }}
        />
      ))}
    </div>
  );
}

function MiniCalendar({ s }: { s: number }) {
  const hot = new Set([4, 5, 11, 12, 18, 19, 25, 26]);
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 6 * s,
        maxWidth: 260 * s,
      }}
    >
      {Array.from({ length: 28 }, (_, i) => (
        <span
          key={i}
          style={{
            aspectRatio: '1',
            borderRadius: 6 * s,
            background: hot.has(i) ? c.white : c.brandTrack,
          }}
        />
      ))}
    </div>
  );
}
