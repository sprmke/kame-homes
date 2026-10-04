import { createContext, useContext, type CSSProperties, type ReactNode } from 'react';

import { ArrowRight } from 'lucide-react';
import { AbsoluteFill, continueRender, delayRender, staticFile } from 'remotion';

import { c, FONT, tones, type Format, type FormatKind, type Tone, type ToneName } from './theme';

/* ------------------------------------------------------------------ *
 * Fonts
 * ------------------------------------------------------------------ */

const weights: [string, number][] = [
  ['PlusJakartaSans-Regular.ttf', 400],
  ['PlusJakartaSans-SemiBold.ttf', 600],
  ['PlusJakartaSans-Bold.ttf', 700],
  ['PlusJakartaSans-ExtraBold.ttf', 800],
];

if (typeof window !== 'undefined' && 'FontFace' in window) {
  const handle = delayRender('Loading Plus Jakarta Sans');
  Promise.all(
    weights.map(([file, weight]) =>
      new FontFace('Jakarta', `url(${staticFile(`fonts/${file}`)})`, { weight: String(weight) })
        .load()
        .then((face) => document.fonts.add(face))
    )
  )
    .then(() => continueRender(handle))
    .catch((err) => {
      console.error(err);
      continueRender(handle);
    });
}

/* ------------------------------------------------------------------ *
 * Format frame: one design coordinate space per orientation
 * ------------------------------------------------------------------ */

export interface FrameCtx {
  kind: FormatKind;
  /** Design-space width / height. */
  W: number;
  H: number;
  /** Outer margin. */
  M: number;
  /** Headline size for this format. */
  hs: number;
  t: Tone;
}

const Ctx = createContext<FrameCtx | null>(null);

export function useFrameCtx(): FrameCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useFrameCtx outside <Frame>');
  return v;
}

const margins: Record<FormatKind, number> = {
  vertical: 84,
  portrait: 84,
  square: 76,
  landscape: 128,
};
const headline: Record<FormatKind, number> = {
  vertical: 132,
  portrait: 116,
  square: 104,
  landscape: 128,
};

export function Frame({
  format,
  tone,
  children,
}: {
  format: Format;
  tone: ToneName;
  children: ReactNode;
}) {
  const W = format.designWidth;
  const H = Math.round((format.height * W) / format.width);
  const scale = format.width / W;
  const t = tones[tone];
  const kind = format.kind;
  // Short landscape crops (link ad, email) get a smaller headline to keep air above and below.
  const hs =
    kind === 'landscape'
      ? Math.round(headline.landscape * Math.min(1, H / 1080) ** 0.6)
      : headline[kind];
  return (
    <AbsoluteFill style={{ background: t.bg, overflow: 'hidden' }}>
      <Ctx.Provider value={{ kind, W, H, M: margins[kind], hs, t }}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: W,
            height: H,
            transform: `scale(${scale})`,
            transformOrigin: '0 0',
            color: t.fg,
            fontFamily: FONT,
            WebkitFontSmoothing: 'antialiased',
            overflow: 'hidden',
          }}
        >
          {children}
        </div>
      </Ctx.Provider>
    </AbsoluteFill>
  );
}

/* ------------------------------------------------------------------ *
 * Type
 * ------------------------------------------------------------------ */

export function Headline({
  children,
  size,
  style,
}: {
  children: ReactNode;
  size?: number;
  style?: CSSProperties;
}) {
  const { hs } = useFrameCtx();
  return (
    <h1
      style={{
        margin: 0,
        fontSize: size ?? hs,
        fontWeight: 700,
        lineHeight: 0.98,
        letterSpacing: '-0.045em',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </h1>
  );
}

/** The accent phrase of a headline. */
export function Em({ children }: { children: ReactNode }) {
  const { t } = useFrameCtx();
  return <span style={{ color: t.accent }}>{children}</span>;
}

export function Sub({
  children,
  size = 34,
  style,
}: {
  children: ReactNode;
  size?: number;
  style?: CSSProperties;
}) {
  const { t } = useFrameCtx();
  return (
    <p
      style={{
        margin: 0,
        fontSize: size,
        fontWeight: 500,
        lineHeight: 1.36,
        letterSpacing: '-0.015em',
        color: t.sub,
        textWrap: 'pretty',
        ...style,
      }}
    >
      {children}
    </p>
  );
}

/** Small label above a headline. Sentence case, never tracked caps. */
export function Kicker({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  const { t } = useFrameCtx();
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        fontSize: 28,
        fontWeight: 600,
        letterSpacing: '-0.01em',
        color: t.sub,
        ...style,
      }}
    >
      <Diamond size={14} color={t.mark} />
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Brand marks
 * ------------------------------------------------------------------ */

export function Diamond({
  size = 20,
  color = c.brand,
  style,
}: {
  size?: number;
  color?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      style={{
        width: size,
        height: size,
        flex: 'none',
        display: 'inline-block',
        background: color,
        borderRadius: size * 0.22,
        transform: 'rotate(45deg)',
        ...style,
      }}
    />
  );
}

export function Wordmark({ size = 30, color }: { size?: number; color?: string }) {
  const { t } = useFrameCtx();
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: size * 0.42,
        fontSize: size,
        fontWeight: 700,
        letterSpacing: '-0.035em',
        color: color ?? t.fg,
        whiteSpace: 'nowrap',
      }}
    >
      <Diamond size={size * 0.62} color={t.mark} />
      Kame Homes
    </div>
  );
}

export function Cta({
  children = 'Start free',
  size = 1,
  invert,
}: {
  children?: ReactNode;
  size?: number;
  invert?: boolean;
}) {
  const { t } = useFrameCtx();
  const light = invert ?? t.dark;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 14 * size,
        height: 84 * size,
        padding: `0 ${38 * size}px`,
        borderRadius: 999,
        fontSize: 30 * size,
        fontWeight: 700,
        letterSpacing: '-0.02em',
        background: light ? c.white : c.ink,
        color: light ? c.night : c.white,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
      <ArrowRight size={30 * size} strokeWidth={2.4} />
    </span>
  );
}

export const SITE = 'kamehomes.space';

/* ------------------------------------------------------------------ *
 * Layout
 * ------------------------------------------------------------------ */

export function Box({
  x,
  y,
  w,
  h,
  children,
  style,
}: {
  x: number;
  y: number;
  w?: number;
  h?: number;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, ...style }}>
      {children}
    </div>
  );
}

/** Scale a fixed-size visual uniformly into a box (contain), anchored per `align`. */
export function Fit({
  w,
  h,
  boxW,
  boxH,
  alignX = 'center',
  alignY = 'center',
  max = 1.6,
  children,
}: {
  w: number;
  h: number;
  boxW: number;
  boxH: number;
  alignX?: 'start' | 'center' | 'end';
  alignY?: 'start' | 'center' | 'end';
  max?: number;
  children: ReactNode;
}) {
  const s = Math.min(boxW / w, boxH / h, max);
  const pos = (a: string, box: number, size: number) =>
    a === 'start' ? 0 : a === 'end' ? box - size : (box - size) / 2;
  return (
    <div style={{ position: 'relative', width: boxW, height: boxH }}>
      <div
        style={{
          position: 'absolute',
          left: pos(alignX, boxW, w * s),
          top: pos(alignY, boxH, h * s),
          width: w,
          height: h,
          transform: `scale(${s})`,
          transformOrigin: '0 0',
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** Bottom row: wordmark left, URL (or custom) right. */
export function Footer({ right, y }: { right?: ReactNode; y?: number }) {
  const { W, H, M, t } = useFrameCtx();
  return (
    <Box
      x={M}
      y={y ?? H - M - 30}
      w={W - M * 2}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
    >
      <Wordmark />
      <div
        style={{
          fontSize: 26,
          fontWeight: 600,
          letterSpacing: '-0.01em',
          color: t.sub,
          whiteSpace: 'nowrap',
        }}
      >
        {right ?? SITE}
      </div>
    </Box>
  );
}
