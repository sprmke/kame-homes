import { createContext, useContext, useId, type CSSProperties, type ReactNode } from 'react';

import { Check } from 'lucide-react';
import { Easing, interpolate, spring, useCurrentFrame } from 'remotion';

import { cn } from '@/lib/utils';

import type { LucideIcon } from 'lucide-react';

/**
 * The assembler wraps every scene with its own chapter length so scenes can pace their
 * outro / end-of-scene hold without prop drilling (`useVideoConfig` only returns the whole
 * composition length inside a `TransitionSeries.Sequence`).
 */
export const SceneDurationContext = createContext(240);
export const useSceneDuration = () => useContext(SceneDurationContext);

/* ------------------------------------------------------------------ *
 * Motion helpers
 *
 * Everything here is a monotonic ease-out — no springs with overshoot,
 * no discrete stepping, no CSS keyframe animations (which the Remotion
 * player cannot drive frame-accurately). That keeps every element calm
 * and smooth instead of bouncing / shimmering / flickering.
 * ------------------------------------------------------------------ */

/** Smooth ease-out, settles exactly on target with zero overshoot. */
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);

/**
 * Fade + a small one-time rise over a fixed window, then dead still. Monotonic ease-out,
 * no spring, settles exactly on 0 — nothing to oscillate around.
 */
export function reveal(frame: number, delay = 0, distance = 8, duration = 16): CSSProperties {
  const p = interpolate(frame, [delay, delay + duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_OUT,
  });
  if (p >= 1) return { opacity: 1 };
  return {
    opacity: p,
    transform: `translate3d(0, ${(1 - p) * distance}px, 0)`,
    willChange: 'opacity, transform',
  };
}

/**
 * Count a number up from 0 to `value` between `delay` and `delay + duration`.
 * Large values are quantised so the trailing digits stop churning every frame.
 */
export function countTo(
  frame: number,
  value: number,
  delay = 0,
  duration = 52,
  step?: number
): number {
  const raw = interpolate(frame, [delay, delay + duration], [0, value], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const q = step ?? (Math.abs(value) >= 10000 ? 50 : Math.abs(value) >= 1000 ? 10 : 1);
  const snapped = Math.round(raw / q) * q;
  // Always land exactly on the target once the window closes.
  return frame >= delay + duration ? value : snapped;
}

/** Frame-driven caret blink (0 / 1) — replaces CSS `animate-pulse`. */
export function blink(frame: number, period = 16): number {
  return frame % period < period / 2 ? 1 : 0;
}

/** Linear-ish grow between two frames, clamped, cubic-eased. */
export function grow(frame: number, from: number, to: number, a: number, b: number): number {
  return interpolate(frame, [a, b], [from, to], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
}

/** Progress of a step machine driven by frame, clamped to `steps - 1`. */
export function stepAt(frame: number, a: number, b: number, steps: number): number {
  return Math.min(
    steps - 1,
    Math.max(
      0,
      Math.floor(
        interpolate(frame, [a, b], [0, steps], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      )
    )
  );
}

/** Substring typewriter. */
export function typewriter(text: string, frame: number, startFrame: number, endFrame: number) {
  const progress = interpolate(frame, [startFrame, endFrame], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return text.slice(0, Math.floor(text.length * progress));
}

/**
 * Scene wrapper. Deliberately does NOT scale/translate the content subtree every frame —
 * a per-frame sub-pixel transform on a container full of text is exactly what makes text
 * "vibrate". It only fades the scene in once; all other motion comes from element `reveal`s
 * and the between-scene transitions.
 */
export function PushIn({ children, className }: { children: ReactNode; className?: string }) {
  const frame = useCurrentFrame();
  const intro = interpolate(frame, [0, 14], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_OUT,
  });
  return (
    <div className={cn('h-full w-full', className)} style={{ opacity: intro }}>
      {children}
    </div>
  );
}

/** Animated pointer that glides between two points and pulses on click. */
export function Cursor({
  from,
  to,
  moveStart,
  moveEnd,
  clickAt,
}: {
  from: [number, number];
  to: [number, number];
  moveStart: number;
  moveEnd: number;
  clickAt?: number;
}) {
  const frame = useCurrentFrame();
  const p = spring({
    frame: frame - moveStart,
    fps: 30,
    durationInFrames: Math.max(1, moveEnd - moveStart),
    config: { damping: 200 },
  });
  const x = interpolate(p, [0, 1], [from[0], to[0]]);
  const y = interpolate(p, [0, 1], [from[1], to[1]]);
  const pulse =
    clickAt != null
      ? interpolate(frame, [clickAt - 4, clickAt, clickAt + 10], [0, 1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      : 0;
  return (
    <div
      className="pointer-events-none absolute left-0 top-0 z-50"
      style={{ transform: `translate(${x}px, ${y}px)` }}
    >
      <div
        className="absolute -left-1 -top-1 rounded-full bg-teal-400/40"
        style={{ width: 28, height: 28, opacity: pulse, transform: `scale(${0.4 + pulse})` }}
      />
      <svg width="22" height="22" viewBox="0 0 24 24" className="drop-shadow-md">
        <path
          d="M4 2l7 18 2.5-7.5L21 10 4 2z"
          className="fill-[#0f172a] stroke-white dark:fill-white dark:stroke-slate-950"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Shared surface components (mirror the real admin design system)
 * ------------------------------------------------------------------ */

/** Standard scene heading: teal eyebrow + bold title, with an optional right-side action. */
export function SceneHeading({
  eyebrow,
  title,
  frame,
  action,
}: {
  eyebrow: string;
  title: string;
  frame: number;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4" style={reveal(frame)}>
      <div>
        <p className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.2em] text-teal-600 dark:text-teal-400">
          {eyebrow}
        </p>
        <h2 className="text-[25px] font-extrabold tracking-tight text-slate-950 dark:text-slate-50">
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

/**
 * End-of-scene "post": a takeaway pill that fades in over the last ~2.5s while the finished
 * scene holds. Gives every feature a calm beat before the cut and punctuates the tour.
 * Reads the chapter length from context so it works for any duration.
 */
export function SceneOutro({ text }: { text: string }) {
  const frame = useCurrentFrame();
  const duration = useSceneDuration();
  const start = Math.max(0, duration - 74);
  const p = interpolate(frame, [start, start + 16], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_OUT,
  });
  if (p <= 0) return null;
  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-5 z-30 flex justify-center"
      style={{ opacity: p, transform: `translate3d(0, ${(1 - p) * 8}px, 0)` }}
    >
      <div className="flex items-center gap-2 rounded-full border border-teal-200 bg-white/95 px-4 py-2 text-[11px] font-bold text-slate-700 shadow-lg backdrop-blur-sm dark:border-teal-500/30 dark:bg-slate-900/95 dark:text-slate-200">
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-teal-600 text-white">
          <Check className="h-2.5 w-2.5" />
        </span>
        {text}
      </div>
    </div>
  );
}

export function KpiCard({
  label,
  value,
  delta,
  deltaTone = 'emerald',
  dense = false,
  style,
}: {
  label: string;
  value: string;
  delta?: string;
  deltaTone?: 'emerald' | 'rose' | 'slate' | 'teal';
  dense?: boolean;
  style?: CSSProperties;
}) {
  const tone = {
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    rose: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
    slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    teal: 'bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300',
  }[deltaTone];
  return (
    <div
      className={cn(
        'rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900',
        dense ? 'p-3' : 'p-4'
      )}
      style={style}
    >
      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{label}</p>
      <div className={cn('flex items-end justify-between gap-2', dense ? 'mt-1' : 'mt-2')}>
        <p
          className={cn(
            'font-black tracking-tight text-slate-950 dark:text-slate-50',
            dense ? 'text-[19px]' : 'text-[22px]'
          )}
        >
          {value}
        </p>
        {delta ? (
          <span className={cn('rounded-full px-2 py-1 text-[10px] font-bold', tone)}>{delta}</span>
        ) : null}
      </div>
    </div>
  );
}

export function SurfaceCard({
  title,
  subtitle,
  icon: Icon,
  action,
  children,
  className,
  style,
}: {
  title?: string;
  subtitle?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900',
        className
      )}
      style={style}
    >
      {title ? (
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {Icon ? (
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600 dark:bg-teal-500/15 dark:text-teal-300">
                <Icon className="h-[17px] w-[17px]" />
              </span>
            ) : null}
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</p>
              {subtitle ? (
                <p className="text-[11px] text-slate-400 dark:text-slate-500">{subtitle}</p>
              ) : null}
            </div>
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </div>
  );
}

export function TierBadge({ tier }: { tier: 'Starter' | 'Pro' | 'Business' | 'Managed' }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      {tier}
    </span>
  );
}

export function StatusPill({
  label,
  tone = 'slate',
}: {
  label: string;
  tone?: 'slate' | 'amber' | 'emerald' | 'teal' | 'rose' | 'sky';
}) {
  const tones = {
    slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    teal: 'bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300',
    rose: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
    sky: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  }[tone];
  return (
    <span className={cn('w-fit rounded-full px-2 py-1 text-[9px] font-bold', tones)}>{label}</span>
  );
}

/** Animated vertical bar chart. */
export function BarChart({
  data,
  frame,
  startFrame = 8,
  highlightFrom,
  height = 200,
  accent = 'bg-teal-500',
  muted = 'bg-teal-200 dark:bg-teal-500/25',
}: {
  data: number[];
  frame: number;
  startFrame?: number;
  highlightFrom?: number;
  height?: number;
  accent?: string;
  muted?: string;
}) {
  const max = Math.max(...data, 1);
  return (
    <div
      className="flex items-end gap-2 border-b border-l border-slate-100 px-2 dark:border-slate-800"
      style={{ height }}
    >
      {data.map((value, index) => {
        const h = interpolate(
          frame,
          [startFrame + index * 3, startFrame + 34 + index * 3],
          [0, (value / max) * (height - 12)],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) }
        );
        const hot = highlightFrom != null && index >= highlightFrom;
        return (
          <div key={index} className="flex flex-1 items-end">
            <div
              className={cn('w-full rounded-t-md', hot ? accent : muted)}
              style={{ height: Math.max(2, h) }}
            />
          </div>
        );
      })}
    </div>
  );
}

/** Animated area / line chart on a viewBox grid. */
export function AreaChart({
  points,
  frame,
  startFrame = 10,
  endFrame = 60,
  width = 420,
  height = 170,
}: {
  points: number[];
  frame: number;
  startFrame?: number;
  endFrame?: number;
  width?: number;
  height?: number;
}) {
  const rawId = useId().replace(/[:]/g, '');
  const fillId = `film-area-fill-${rawId}`;
  const clipId = `film-area-clip-${rawId}`;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const stepX = width / (points.length - 1);
  const coords = points.map((value, index) => {
    const x = index * stepX;
    const y = height - ((value - min) / (max - min || 1)) * (height - 10) - 4;
    return [x, y] as const;
  });
  // Full path is static; a single clip rect wipes it in — no point-by-point stepping.
  const linePath = coords.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;
  const p = interpolate(frame, [startFrame, endFrame], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      style={{ height }}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#14b8a6" stopOpacity="0" />
        </linearGradient>
        <clipPath id={clipId}>
          <rect x="0" y="0" width={Math.max(0.001, width * p)} height={height} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <path d={areaPath} fill={`url(#${fillId})`} />
        <path
          d={linePath}
          fill="none"
          stroke="#14b8a6"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

/** Animated donut with a centered total. */
export function Donut({
  segments,
  frame,
  startFrame = 10,
  total,
  size = 132,
}: {
  segments: { value: number; color: string }[];
  frame: number;
  startFrame?: number;
  total: string;
  size?: number;
}) {
  const sum = segments.reduce((acc, segment) => acc + segment.value, 0) || 1;
  const radius = size / 2 - 12;
  const circumference = 2 * Math.PI * radius;
  const sweep = interpolate(frame, [startFrame, startFrame + 46], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  let offset = 0;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {segments.map((segment, index) => {
          const fraction = (segment.value / sum) * sweep;
          const dash = fraction * circumference;
          const el = (
            <circle
              key={index}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={14}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          );
          offset += dash;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[15px] font-black text-slate-900 dark:text-slate-50">{total}</span>
        <span className="text-[8px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Total
        </span>
      </div>
    </div>
  );
}

/** 7-column month calendar with booked pills, blocked days, highlight range, and prices. */
export function MiniMonthCalendar({
  frame,
  booked = [],
  blocked = [],
  highlight = [],
  cellHeight = 58,
  weeks = 5,
  showPrices = true,
  priceFor,
}: {
  frame: number;
  booked?: number[];
  blocked?: number[];
  highlight?: number[];
  cellHeight?: number;
  weeks?: number;
  showPrices?: boolean;
  priceFor?: (day: number) => string;
}) {
  const price =
    priceFor ?? ((day: number) => (day % 6 === 0 ? '₱4,299' : day % 5 === 0 ? '₱3,899' : '₱2,799'));
  return (
    <div className="grid grid-cols-7 gap-1">
      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
        <div
          key={day}
          className="pb-1 text-center text-[8px] font-bold uppercase text-slate-400 dark:text-slate-500"
        >
          {day}
        </div>
      ))}
      {Array.from({ length: weeks * 7 }, (_, index) => {
        const date = index + 1;
        const isBooked = booked.includes(date);
        // A booked "stay" that started on the previous day (continuation) — pill has no label.
        const isBookedRun = isBooked && booked.includes(date - 1);
        const isBlocked = blocked.includes(date);
        const isHot = highlight.includes(date);
        // Calm row-by-row sweep (not a per-cell sparkle): every cell in a row shares one curve.
        const rowDelay = Math.floor(index / 7) * 4;
        const appear = interpolate(frame, [6 + rowDelay, 24 + rowDelay], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: EASE_OUT,
        });
        return (
          <div
            key={date}
            className={cn(
              'relative overflow-hidden rounded-lg border',
              isBlocked
                ? 'border-slate-200 bg-[repeating-linear-gradient(45deg,#f1f5f9,#f1f5f9_4px,#e2e8f0_4px,#e2e8f0_8px)] dark:border-slate-700 dark:bg-[repeating-linear-gradient(45deg,#1e293b,#1e293b_4px,#334155_4px,#334155_8px)]'
                : isBooked
                  ? 'border-teal-100 bg-teal-50/40 dark:border-teal-500/30 dark:bg-teal-500/10'
                  : isHot
                    ? 'border-teal-400 bg-teal-50 shadow-sm dark:bg-teal-500/15'
                    : 'border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900'
            )}
            style={{ height: cellHeight, opacity: appear }}
          >
            <span className="absolute left-1.5 top-1 text-[8px] font-bold text-slate-500 dark:text-slate-400">
              {date}
            </span>
            {isBooked ? (
              <span
                className={cn(
                  'absolute inset-x-1 bottom-1 flex h-4 items-center rounded bg-teal-500 px-1.5 text-[7px] font-bold text-white',
                  isBookedRun ? 'rounded-l-none' : ''
                )}
              >
                <span className="truncate">{isBookedRun ? '' : 'Kyle S.'}</span>
              </span>
            ) : isBlocked ? (
              <span className="absolute inset-x-1 bottom-1 rounded bg-white/70 px-1 text-center text-[7px] font-bold text-slate-400 dark:bg-slate-900/70 dark:text-slate-500">
                Blocked
              </span>
            ) : showPrices ? (
              <span
                className={cn(
                  'absolute inset-x-1 bottom-1 text-[9px] font-black',
                  isHot ? 'text-teal-700 dark:text-teal-300' : 'text-slate-600 dark:text-slate-300'
                )}
              >
                {price(date)}
              </span>
            ) : isHot ? (
              <span className="absolute inset-x-1 bottom-1 rounded bg-teal-500/15 px-1 text-center text-[7px] font-bold text-teal-700 dark:text-teal-300">
                Rate set
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** Phone device mockup. */
export function PhoneFrame({
  children,
  label,
  style,
}: {
  children: ReactNode;
  label?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className="h-[470px] w-[248px] rounded-[38px] border-[6px] border-slate-200 bg-slate-100 p-3 shadow-2xl ring-1 ring-slate-300/60 dark:border-slate-700 dark:bg-slate-800 dark:ring-slate-700/60"
      style={style}
    >
      <div className="mx-auto mb-4 h-3.5 w-16 rounded-full bg-slate-300 dark:bg-slate-600" />
      {label ? (
        <p className="px-2 text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {label}
        </p>
      ) : null}
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  );
}

export function Toast({
  title,
  body,
  icon: Icon,
  style,
}: {
  title: string;
  body: string;
  icon: LucideIcon;
  style?: CSSProperties;
}) {
  return (
    <div
      className="flex w-[280px] items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xl dark:border-slate-700 dark:bg-slate-900"
      style={style}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600 dark:bg-teal-500/15 dark:text-teal-300">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-black text-slate-800 dark:text-slate-100">{title}</p>
        <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
          {body}
        </p>
      </div>
    </div>
  );
}
