import type { CSSProperties, ReactNode } from 'react';

import { Check, ChevronLeft, type LucideIcon } from 'lucide-react';

import { StatusBar } from '../device';
import { ease, reveal, SETTLED } from '../motion';
import { c } from '../theme';

/**
 * Screen kit for the feature series. Everything is authored in iPhone points (393 × 852)
 * and mirrors the real mobile dashboard: large title, white cards on paper, pill chips.
 */

export const tab: CSSProperties = { fontVariantNumeric: 'tabular-nums' };

export interface ScreenAnim {
  frame?: number;
  startAt?: number;
}

/** Frame-relative helpers for a screen: `at(n)` is a reveal n frames after the screen starts. */
export function useAnim({ frame = SETTLED, startAt = 0 }: ScreenAnim) {
  return {
    frame,
    at: (d: number, dist = 18, dur = 20) => reveal(frame, startAt + d, dist, dur),
    p: (a: number, b: number) => ease(frame, startAt + a, startAt + b),
    on: (d: number) => frame >= startAt + d,
  };
}

export function Screen({
  children,
  bg = c.paper,
  dark = false,
}: {
  children: ReactNode;
  bg?: string;
  dark?: boolean;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: bg,
        color: dark ? c.white : c.ink,
        overflow: 'hidden',
      }}
    >
      <StatusBar dark={dark} />
      {children}
    </div>
  );
}

/** Large-title header used by most module screens. */
export function TitleBar({
  title,
  right,
  back,
  dark = false,
}: {
  title: string;
  right?: ReactNode;
  back?: string;
  dark?: boolean;
}) {
  return (
    <div style={{ position: 'absolute', top: 58, left: 20, right: 20 }}>
      {back ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            marginLeft: -6,
            fontSize: 15,
            fontWeight: 600,
            color: dark ? c.mint : c.brandDeep,
          }}
        >
          <ChevronLeft size={20} /> {back}
        </div>
      ) : null}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: back ? 8 : 6,
        }}
      >
        <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.035em' }}>{title}</div>
        {right}
      </div>
    </div>
  );
}

/** Body area under the title bar. */
export function Body({
  top = 118,
  children,
  gap = 10,
}: {
  top?: number;
  children: ReactNode;
  gap?: number;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top,
        left: 16,
        right: 16,
        display: 'flex',
        flexDirection: 'column',
        gap,
      }}
    >
      {children}
    </div>
  );
}

export function Card({
  children,
  style,
  dark = false,
  pad = 16,
}: {
  children: ReactNode;
  style?: CSSProperties;
  dark?: boolean;
  pad?: number;
}) {
  return (
    <div
      style={{
        borderRadius: 22,
        background: dark ? c.nightSurface : c.white,
        border: `1px solid ${dark ? c.graphiteLine : c.line}`,
        padding: pad,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Label({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{ fontSize: 13, fontWeight: 600, color: c.muted, letterSpacing: '-0.005em', ...style }}
    >
      {children}
    </div>
  );
}

export type PillTone = 'brand' | 'soft' | 'muted' | 'dark' | 'sun' | 'coral' | 'mint';

const pillTones: Record<PillTone, [string, string]> = {
  brand: [c.brand, c.white],
  soft: [c.tint, c.brandDeep],
  muted: ['hsl(150 6% 93%)', c.inkSoft],
  dark: [c.ink, c.white],
  sun: ['hsl(44 95% 90%)', 'hsl(32 70% 30%)'],
  coral: ['hsl(8 80% 94%)', 'hsl(8 62% 42%)'],
  mint: [c.mint, c.night],
};

export function Pill({
  children,
  tone = 'soft',
  icon: Icon,
  size = 13,
  style,
}: {
  children: ReactNode;
  tone?: PillTone;
  icon?: LucideIcon;
  size?: number;
  style?: CSSProperties;
}) {
  const [bg, fg] = pillTones[tone];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        height: size * 2,
        padding: `0 ${size * 0.8}px`,
        borderRadius: 99,
        background: bg,
        color: fg,
        fontSize: size,
        fontWeight: 700,
        letterSpacing: '-0.01em',
        whiteSpace: 'nowrap',
        flex: 'none',
        ...style,
      }}
    >
      {Icon ? <Icon size={size + 1} strokeWidth={2.4} /> : null}
      {children}
    </span>
  );
}

/** Round check that fills in when `done`. */
export function CheckDot({
  done,
  size = 24,
  dark = false,
}: {
  done: boolean;
  size?: number;
  dark?: boolean;
}) {
  return (
    <span
      style={{
        width: size,
        height: size,
        flex: 'none',
        borderRadius: 99,
        display: 'grid',
        placeItems: 'center',
        background: done ? (dark ? c.mint : c.brand) : 'transparent',
        border: done ? 'none' : `2px solid ${dark ? c.graphiteLine : c.line}`,
        boxSizing: 'border-box',
        color: dark ? c.night : c.white,
      }}
    >
      {done ? <Check size={size * 0.62} strokeWidth={3.4} /> : null}
    </span>
  );
}

export function Btn({
  children,
  tone = 'dark',
  style,
}: {
  children: ReactNode;
  tone?: 'dark' | 'brand' | 'ghost' | 'mint';
  style?: CSSProperties;
}) {
  const map = {
    dark: { background: c.ink, color: c.white },
    brand: { background: c.brand, color: c.white },
    mint: { background: c.mint, color: c.night },
    ghost: { background: c.white, color: c.ink, border: `1px solid ${c.line}` },
  } as const;
  return (
    <span
      style={{
        flex: 1,
        height: 46,
        borderRadius: 99,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        fontSize: 15.5,
        fontWeight: 700,
        letterSpacing: '-0.015em',
        boxSizing: 'border-box',
        ...map[tone],
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/** Two-column list row: title + subtitle left, anything right. */
export function Row({
  title,
  sub,
  right,
  lead,
  first = false,
  dark = false,
  style,
}: {
  title: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
  lead?: ReactNode;
  first?: boolean;
  dark?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 0',
        borderTop: first ? undefined : `1px solid ${dark ? c.graphiteLine : c.line}`,
        ...style,
      }}
    >
      {lead}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.015em' }}>{title}</div>
        {sub ? (
          <div style={{ fontSize: 12.5, color: dark ? c.nightSub : c.muted, marginTop: 2 }}>
            {sub}
          </div>
        ) : null}
      </div>
      {right}
    </div>
  );
}

/** Square icon tile, used as a row lead. */
export function IconTile({
  icon: Icon,
  bg = c.tint,
  fg = c.brandDeep,
  size = 38,
}: {
  icon: LucideIcon;
  bg?: string;
  fg?: string;
  size?: number;
}) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        background: bg,
        color: fg,
        display: 'grid',
        placeItems: 'center',
        flex: 'none',
      }}
    >
      <Icon size={size * 0.5} strokeWidth={2.2} />
    </span>
  );
}

export function Avatar({
  initials,
  bg = c.tint,
  fg = c.brandDeep,
  size = 38,
}: {
  initials: string;
  bg?: string;
  fg?: string;
  size?: number;
}) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: 99,
        background: bg,
        color: fg,
        display: 'grid',
        placeItems: 'center',
        fontSize: size * 0.38,
        fontWeight: 700,
        flex: 'none',
      }}
    >
      {initials}
    </span>
  );
}

/** iOS-style switch. */
export function Toggle({ on, dark = false }: { on: boolean; dark?: boolean }) {
  return (
    <span
      style={{
        width: 46,
        height: 28,
        borderRadius: 99,
        background: on ? c.brand : dark ? c.graphiteLine : 'hsl(150 6% 86%)',
        position: 'relative',
        flex: 'none',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: on ? 21 : 3,
          width: 22,
          height: 22,
          borderRadius: 99,
          background: c.white,
          boxShadow: '0 1px 3px hsl(160 20% 10% / 0.25)',
        }}
      />
    </span>
  );
}

/** Home indicator bar. */
export function HomeBar({ dark = false }: { dark?: boolean }) {
  return (
    <span
      style={{
        position: 'absolute',
        bottom: 10,
        left: '50%',
        width: 140,
        height: 5,
        marginLeft: -70,
        borderRadius: 3,
        background: dark ? 'hsl(0 0% 100% / 0.85)' : c.ink,
      }}
    />
  );
}

/** Count a number up between frames a→b, formatted with grouping. */
export function countUp(value: number, p: number, prefix = '') {
  return `${prefix}${Math.round(value * p).toLocaleString('en-US')}`;
}
