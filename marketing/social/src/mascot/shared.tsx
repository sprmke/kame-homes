import type { CSSProperties, ReactNode } from 'react';

import { AppIcon } from '../device';
import { ease, reveal, SETTLED } from '../motion';
import { Box, Diamond, useFrameCtx } from '../primitives';
import { c, type Tone } from '../theme';
import { Kame, type KameLook, type Pose } from './Kame';

/** Contact shadow and light bounce per plane, so Kame sits on every tone the same way. */
export function kameLook(t: Tone): KameLook {
  if (t.bg === c.sand) return { shadow: c.sandShade, shadowOpacity: 0.32, bounce: '#f2b878' };
  if (t.dark) return { shadow: '#000000', shadowOpacity: 0.45, bounce: '#3a4a44', exposure: 1.02 };
  return { shadow: 'hsl(150 10% 55%)', shadowOpacity: 0.22, bounce: '#e8efe9' };
}

/**
 * Kame placed in design px. `x, y` is the top-left of the fit box (w × h). Enters once:
 * rises from below and fades in over `dur` frames after `delay`, then holds.
 */
export function KameAt({
  x,
  y,
  w,
  h,
  pose,
  frame = SETTLED,
  delay = 0,
  dur = 26,
  framing,
  style,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  pose: Pose;
  frame?: number;
  delay?: number;
  dur?: number;
  framing?: 'full' | 'bust';
  style?: CSSProperties;
}) {
  const { t } = useFrameCtx();
  const p = ease(frame, delay, delay + dur);
  const enter: CSSProperties =
    p >= 1
      ? {}
      : { opacity: Math.min(1, p * 1.8), transform: `translate3d(0, ${(1 - p) * 90}px, 0)` };
  return (
    <Box x={x} y={y} w={w} h={h} style={{ ...enter, ...style }}>
      <Kame w={w} h={h} pose={pose} look={kameLook(t)} framing={framing} />
    </Box>
  );
}

/** A notification card at poster scale (the lock screen `Push`, sized for a canvas). */
export function NoteCard({
  title,
  body,
  time,
  w,
  scale = 1,
  dark = false,
  style,
}: {
  title: string;
  body: string;
  time: string;
  w: number;
  scale?: number;
  dark?: boolean;
  style?: CSSProperties;
}) {
  const s = scale;
  return (
    <div
      style={{
        width: w,
        display: 'flex',
        gap: 18 * s,
        padding: `${22 * s}px ${24 * s}px`,
        borderRadius: 30 * s,
        background: dark ? c.nightSurface : c.white,
        color: dark ? c.white : c.ink,
        boxShadow: dark
          ? `0 ${18 * s}px ${40 * s}px -${18 * s}px hsl(160 30% 2% / 0.7)`
          : `0 ${18 * s}px ${40 * s}px -${20 * s}px hsl(150 20% 30% / 0.28)`,
        ...style,
      }}
    >
      <div
        style={{
          transform: `scale(${(58 * s) / 38})`,
          transformOrigin: '0 0',
          width: 58 * s,
          height: 58 * s,
        }}
      >
        <AppIcon size={38} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12 * s,
            fontSize: 27 * s,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            whiteSpace: 'nowrap',
          }}
        >
          <span>{title}</span>
          <span style={{ fontWeight: 500, color: dark ? c.nightSub : c.muted, fontSize: 22 * s }}>
            {time}
          </span>
        </div>
        <div
          style={{
            fontSize: 23 * s,
            lineHeight: 1.32,
            marginTop: 5 * s,
            letterSpacing: '-0.01em',
            color: dark ? c.nightSub : c.inkSoft,
          }}
        >
          {body}
        </div>
      </div>
    </div>
  );
}

/** Chat bubble. `from="guest"` sits left in white; `from="kame"` sits right in brand. */
export function Bubble({
  from,
  children,
  w,
  scale = 1,
  style,
}: {
  from: 'guest' | 'kame';
  children: ReactNode;
  w?: number;
  scale?: number;
  style?: CSSProperties;
}) {
  const s = scale;
  const kame = from === 'kame';
  return (
    <div
      style={{
        maxWidth: w,
        display: 'inline-block',
        padding: `${20 * s}px ${26 * s}px`,
        borderRadius: 34 * s,
        borderBottomLeftRadius: kame ? 34 * s : 10 * s,
        borderBottomRightRadius: kame ? 10 * s : 34 * s,
        background: kame ? c.brand : c.white,
        color: kame ? c.white : c.ink,
        fontSize: 30 * s,
        fontWeight: 600,
        lineHeight: 1.3,
        letterSpacing: '-0.02em',
        boxShadow: `0 ${16 * s}px ${36 * s}px -${20 * s}px hsl(150 20% 25% / 0.3)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Small label naming who speaks above a bubble. */
export function Speaker({
  children,
  kame,
  scale = 1,
}: {
  children: ReactNode;
  kame?: boolean;
  scale?: number;
}) {
  const { t } = useFrameCtx();
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: kame ? 'flex-end' : 'flex-start',
        gap: 10 * scale,
        fontSize: 22 * scale,
        fontWeight: 600,
        color: t.sub,
        marginBottom: 10 * scale,
      }}
    >
      {kame ? <Diamond size={11 * scale} color={t.mark} /> : null}
      {children}
    </div>
  );
}

/** Reveal helper for stacked items: item i appears `gap` frames after the previous one. */
export const stagger = (frame: number, start: number, i: number, gap = 12, dist = 24) =>
  reveal(frame, start + i * gap, dist);
