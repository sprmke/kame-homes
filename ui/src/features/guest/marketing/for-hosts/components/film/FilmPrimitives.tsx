import { createContext, useContext, useId, type CSSProperties, type ReactNode } from 'react';

import { Easing, interpolate, useCurrentFrame } from 'remotion';

import { cn } from '@/lib/utils';

import type { LucideIcon } from 'lucide-react';

/**
 * The assembler wraps every scene with its own chapter length so scenes can pace their
 * outro without prop drilling (`useVideoConfig` only returns the whole composition length
 * inside a `TransitionSeries.Sequence`).
 */
export const SceneDurationContext = createContext(210);
export const useSceneDuration = () => useContext(SceneDurationContext);

/** Native composition size. Scenes lay out at real app scale inside this window. */
export const FILM_WIDTH = 1280;
export const FILM_HEIGHT = 720;

/* ------------------------------------------------------------------ *
 * Motion helpers
 *
 * Everything is a monotonic ease-out: no springs with overshoot, no
 * discrete stepping, no CSS keyframe animations (the Remotion player
 * cannot drive those frame-accurately). Elements settle and hold still.
 * ------------------------------------------------------------------ */

export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);

/** Eased 0 → 1 progress between two frames. */
export function ease(frame: number, a: number, b: number, easing = EASE_OUT): number {
  return interpolate(frame, [a, Math.max(a + 1, b)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing,
  });
}

/** Fade + small one-time rise, then dead still. */
export function reveal(frame: number, delay = 0, distance = 10, duration = 18): CSSProperties {
  const p = ease(frame, delay, delay + duration);
  if (p >= 1) return { opacity: 1 };
  return {
    opacity: p,
    transform: `translate3d(0, ${(1 - p) * distance}px, 0)`,
    willChange: 'opacity, transform',
  };
}

/** Fade + gentle scale-in (dialogs, popovers, generated results). */
export function popIn(frame: number, delay = 0, duration = 16): CSSProperties {
  const p = ease(frame, delay, delay + duration);
  if (p >= 1) return { opacity: 1 };
  return {
    opacity: p,
    transform: `scale(${0.96 + p * 0.04})`,
    willChange: 'opacity, transform',
  };
}

/** Count a number up to `value`. Large values are quantised so trailing digits do not churn. */
export function countTo(frame: number, value: number, delay = 0, duration = 40): number {
  const raw = interpolate(frame, [delay, delay + duration], [0, value], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const q = Math.abs(value) >= 10000 ? 50 : Math.abs(value) >= 1000 ? 10 : 1;
  return frame >= delay + duration ? value : Math.round(raw / q) * q;
}

export function peso(value: number): string {
  return `₱${value.toLocaleString('en-PH')}`;
}

/** Frame-driven caret blink (0 / 1). */
export function blink(frame: number, period = 16): number {
  return frame % period < period / 2 ? 1 : 0;
}

/** Substring typewriter. */
export function typewriter(text: string, frame: number, startFrame: number, endFrame: number) {
  const p = interpolate(frame, [startFrame, endFrame], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return text.slice(0, Math.floor(text.length * p));
}

/* ------------------------------------------------------------------ *
 * Stage + camera
 * ------------------------------------------------------------------ */

export interface CameraKey {
  /** Frame at which the camera arrives at this key. */
  at: number;
  /** Focus point in window coordinates, 0–1. */
  x: number;
  y: number;
  /** 1 = the whole window floating on the stage; >1 = pushed in. */
  zoom: number;
}

/** Window scale at `zoom: 1`: leaves a calm margin of stage around the app. */
const BASE_SCALE = 0.9;
const WIDE: CameraKey = { at: 0, x: 0.5, y: 0.5, zoom: 1 };
/** Slow, symmetric ease (sine in-out): no sudden start, long glide, soft landing. */
const CAMERA_EASE = Easing.bezier(0.37, 0, 0.63, 1);

interface CameraPose {
  scale: number;
  tx: number;
  ty: number;
}

/**
 * Resolve one key to a final window pose. Done per key (not per frame), so the clamp that keeps
 * the stage from showing past the window edge can never kink a move halfway through.
 */
function poseFor(key: CameraKey): CameraPose {
  const scale = BASE_SCALE * key.zoom;
  const cx = FILM_WIDTH / 2;
  const cy = FILM_HEIGHT / 2;
  const fx = key.x * FILM_WIDTH;
  const fy = key.y * FILM_HEIGHT;
  // Pushed in, the focus point glides toward frame center (slightly above, clear of the caption).
  const pushed = Math.min(1, Math.max(0, (key.zoom - 1) / 0.25));
  const restX = cx + BASE_SCALE * (fx - cx);
  const restY = cy + BASE_SCALE * (fy - cy);
  const targetX = restX + (cx - restX) * pushed;
  const targetY = restY + (FILM_HEIGHT * 0.42 - restY) * pushed;
  const limitX = Math.abs(cx * (scale - 1));
  const limitY = Math.abs(cy * (scale - 1));
  const clamp = (value: number, limit: number) => Math.min(limit, Math.max(-limit, value));
  return {
    scale,
    tx: clamp(targetX - cx - scale * (fx - cx), limitX),
    ty: clamp(targetY - cy - scale * (fy - cy), limitY),
  };
}

/** Interpolated pose at `frame`, plus whether the camera is mid-move. */
function cameraAt(frame: number, keys: CameraKey[]) {
  const all = keys.length && keys[0].at === 0 ? keys : [WIDE, ...keys];
  let pose = poseFor(all[0]);
  let moving = false;
  for (let i = 1; i < all.length; i += 1) {
    const prev = all[i - 1];
    const next = all[i];
    if (frame <= prev.at) break;
    // Each move spans the whole gap between keys, so steps stay tiny and the glide stays calm.
    const p = ease(frame, prev.at, next.at, CAMERA_EASE);
    const from = poseFor(prev);
    const to = poseFor(next);
    pose = {
      scale: from.scale + (to.scale - from.scale) * p,
      tx: from.tx + (to.tx - from.tx) * p,
      ty: from.ty + (to.ty - from.ty) * p,
    };
    moving = p > 0 && p < 1;
  }
  return { ...pose, moving };
}

/**
 * One scene: soft stage, the app window at native 1280×720, and an eased camera that pushes
 * toward the part of the screen the narration is about, then holds still.
 *
 * Smoothness: the player only advances at 30fps, so a slow push would visibly step. While the
 * camera moves, the window is promoted to its own GPU layer (`will-change`) with a one-frame
 * linear transition, so the compositor fills in the in-between display frames and text is not
 * re-rasterised at a new scale every frame. Once the camera settles the hint is dropped and the
 * text re-renders crisp.
 */
export function FilmScene({
  camera = [],
  children,
}: {
  camera?: CameraKey[];
  children: ReactNode;
}) {
  const frame = useCurrentFrame();
  const { scale, tx, ty, moving } = cameraAt(frame, camera);

  return (
    <div
      className="bg-muted absolute inset-0 overflow-hidden"
      style={{
        // Static gradients instead of `blur-3xl` blobs: same glow, no filter cost under a moving layer.
        backgroundImage:
          'radial-gradient(520px circle at 0% 0%, hsl(var(--primary) / 0.12), transparent 70%), radial-gradient(560px circle at 100% 100%, hsl(var(--primary) / 0.07), transparent 70%)',
      }}
    >
      <div
        className="border-border bg-background absolute left-0 top-0 overflow-hidden rounded-[18px] border shadow-[0_30px_80px_-20px_rgb(15_23_42_/_0.35)]"
        style={{
          width: FILM_WIDTH,
          height: FILM_HEIGHT,
          transform: `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`,
          transformOrigin: '50% 50%',
          willChange: moving ? 'transform' : undefined,
          transition: moving ? 'transform 34ms linear' : undefined,
          backfaceVisibility: 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Overlays: caption, title card, cursor, highlight
 * ------------------------------------------------------------------ */

/** Lower-third caption. Carries the story when the tour plays muted. */
export function SceneCaption({
  eyebrow,
  text,
  icon: Icon,
}: {
  eyebrow: string;
  text: string;
  icon: LucideIcon;
}) {
  const frame = useCurrentFrame();
  const duration = useSceneDuration();
  const enter = ease(frame, 12, 34);
  const exit = ease(frame, duration - 26, duration - 10);
  const opacity = enter * (1 - exit);
  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center"
      style={{ opacity }}
    >
      <div
        className="border-border/70 bg-background flex items-center gap-3.5 rounded-2xl border py-3 pl-3 pr-6 shadow-[0_18px_50px_-18px_rgb(15_23_42_/_0.45)]"
        style={{ transform: `translate3d(0, ${(1 - enter) * 14}px, 0)` }}
      >
        <span className="bg-primary text-primary-foreground flex size-11 items-center justify-center rounded-xl">
          <Icon className="size-[22px]" strokeWidth={2.25} />
        </span>
        <div>
          <p className="text-primary text-[12px] font-bold uppercase tracking-[0.16em]">
            {eyebrow}
          </p>
          <p className="text-foreground text-[27px] font-bold leading-tight tracking-tight">
            {text}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Animated pointer. Glides through waypoints; a ring pulses on each click. */
export function Cursor({
  path,
}: {
  path: { at: number; x: number; y: number; click?: boolean }[];
}) {
  const frame = useCurrentFrame();
  if (!path.length) return null;
  let x = path[0].x;
  let y = path[0].y;
  for (let i = 1; i < path.length; i += 1) {
    const prev = path[i - 1];
    const next = path[i];
    const start = Math.max(prev.at, next.at - 22);
    if (frame < start) break;
    const p = ease(frame, start, next.at, EASE_IN_OUT);
    x = prev.x + (next.x - prev.x) * p;
    y = prev.y + (next.y - prev.y) * p;
  }
  const visible = ease(frame, path[0].at - 8, path[0].at);
  const click = path.find((point) => point.click && frame >= point.at && frame < point.at + 14);
  const pulse = click ? 1 - (frame - click.at) / 14 : 0;
  return (
    <div
      className="pointer-events-none absolute left-0 top-0 z-50"
      style={{
        transform: `translate3d(${x}px, ${y}px, 0)`,
        opacity: visible,
        // Small GPU layer + one-frame glide so the pointer moves at display rate, not 30fps.
        willChange: 'transform',
        transition: 'transform 34ms linear',
      }}
    >
      <div
        className="bg-primary/35 absolute -left-3.5 -top-3.5 size-8 rounded-full"
        style={{ opacity: pulse, transform: `scale(${1.6 - pulse * 0.8})` }}
      />
      <svg width="24" height="24" viewBox="0 0 24 24" className="drop-shadow-md">
        <path
          d="M4 2l7 18 2.5-7.5L21 10 4 2z"
          className="fill-slate-900 stroke-white dark:fill-white dark:stroke-slate-900"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

/** Soft primary ring that draws attention to one element. */
export function Spotlight({
  x,
  y,
  w,
  h,
  from,
  radius = 14,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  from: number;
  radius?: number;
}) {
  const frame = useCurrentFrame();
  const p = ease(frame, from, from + 14);
  return (
    <div
      className="ring-primary/70 pointer-events-none absolute z-40 ring-[3px] ring-offset-2 ring-offset-transparent"
      style={{
        left: x - 6,
        top: y - 6,
        width: w + 12,
        height: h + 12,
        borderRadius: radius,
        opacity: p,
        transform: `scale(${1.04 - p * 0.04})`,
      }}
    />
  );
}

/* ------------------------------------------------------------------ *
 * Surfaces — app design tokens, no breakpoint variants (the player is
 * scaled, so viewport media queries would restyle the film on phones).
 * ------------------------------------------------------------------ */

export const CARD = 'rounded-xl border border-border bg-card text-card-foreground shadow-card';

export function Card({
  children,
  className,
  style,
}: {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={cn(CARD, 'p-5', className)} style={style}>
      {children}
    </div>
  );
}

/** Mirrors `AdminSurfaceCardHeader` at desktop size. */
export function CardHeader({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3.5 flex items-start justify-between gap-3">
      <div className="flex items-start gap-2.5">
        {Icon ? (
          <span className="border-border/45 bg-muted/50 inline-flex size-10 shrink-0 items-center justify-center rounded-xl border">
            <Icon className="text-muted-foreground size-5" />
          </span>
        ) : null}
        <div className="flex min-h-10 flex-col justify-center">
          <p className="text-foreground text-base font-semibold leading-none tracking-tight">
            {title}
          </p>
          {description ? (
            <p className="text-muted-foreground mt-1.5 text-[13px]">{description}</p>
          ) : null}
        </div>
      </div>
      {action}
    </div>
  );
}

/** Mirrors `StatCard`: muted icon well, label, value, period delta. */
export function Kpi({
  title,
  value,
  icon: Icon,
  change,
  style,
}: {
  title: string;
  value: string;
  icon: LucideIcon;
  change?: string;
  style?: CSSProperties;
}) {
  const negative = change?.startsWith('-');
  return (
    <div className={cn(CARD, 'p-5')} style={style}>
      <div className="flex items-start justify-between">
        <p className="text-muted-foreground text-[13px] font-medium">{title}</p>
        <span className="bg-muted flex size-9 items-center justify-center rounded-lg">
          <Icon className="text-muted-foreground size-[18px]" />
        </span>
      </div>
      <p className="text-foreground -mt-1 text-[26px] font-bold tabular-nums tracking-tight">
        {value}
      </p>
      {change ? (
        <p className="mt-1.5 text-[12px]">
          <span
            className={cn(
              'font-semibold',
              negative
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-emerald-600 dark:text-emerald-400'
            )}
          >
            {change}
          </span>
          <span className="text-muted-foreground"> vs last period</span>
        </p>
      ) : null}
    </div>
  );
}

const CHIP_TONES = {
  primary: 'bg-primary/10 text-primary',
  amber: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  sky: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  emerald: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  violet: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  rose: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  muted: 'bg-muted text-muted-foreground',
} as const;

export type ChipTone = keyof typeof CHIP_TONES;

export function Chip({
  tone = 'muted',
  children,
  className,
  icon: Icon,
}: {
  tone?: ChipTone;
  children: ReactNode;
  className?: string;
  icon?: LucideIcon;
}) {
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-semibold',
        CHIP_TONES[tone],
        className
      )}
    >
      {Icon ? <Icon className="size-3.5" /> : null}
      {children}
    </span>
  );
}

/** Mirrors the shadcn button sizes used in page headers. */
export function Btn({
  children,
  icon: Icon,
  variant = 'outline',
  className,
  style,
}: {
  children?: ReactNode;
  icon?: LucideIcon;
  variant?: 'primary' | 'outline' | 'ghost';
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-semibold',
        variant === 'primary' && 'bg-primary text-primary-foreground shadow-sm',
        variant === 'outline' && 'border-border bg-background text-foreground border shadow-sm',
        variant === 'ghost' && 'text-muted-foreground',
        className
      )}
      style={style}
    >
      {Icon ? <Icon className="size-4" /> : null}
      {children}
    </span>
  );
}

/** Segmented control (tabs / toggles). */
export function Segmented({
  options,
  active,
  className,
  fill,
}: {
  options: string[];
  active: string;
  className?: string;
  /** Stretch to the container width with equal segments. */
  fill?: boolean;
}) {
  return (
    <div className={cn('bg-muted inline-flex rounded-lg p-1', fill && 'flex w-full', className)}>
      {options.map((option) => (
        <span
          key={option}
          className={cn(
            'rounded-md px-3 py-1.5 text-[13px] font-semibold',
            fill && 'flex-1 text-center',
            option === active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
          )}
        >
          {option}
        </span>
      ))}
    </div>
  );
}

export function TierPill({ tier }: { tier: string }) {
  return (
    <span className="border-primary/25 bg-primary/10 text-primary rounded-full border px-2 py-0.5 text-[11px] font-bold">
      {tier}
    </span>
  );
}

/** Settings-style field: label + input box. */
export function Field({
  label,
  value,
  className,
  multiline,
  caret,
}: {
  label: string;
  value: ReactNode;
  className?: string;
  multiline?: boolean;
  caret?: boolean;
}) {
  const frame = useCurrentFrame();
  return (
    <div className={className}>
      <p className="text-foreground mb-1.5 text-[13px] font-medium">{label}</p>
      <div
        className={cn(
          'border-input bg-background text-foreground rounded-lg border px-3 text-sm',
          multiline ? 'min-h-[76px] py-2.5 leading-relaxed' : 'flex h-10 items-center'
        )}
      >
        <span>{value}</span>
        {caret ? (
          <span
            className="bg-primary ml-0.5 inline-block h-4 w-0.5 align-middle"
            style={{ opacity: blink(frame) }}
          />
        ) : null}
      </div>
    </div>
  );
}

export function Toggle({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 rounded-full transition-none',
        on ? 'bg-primary' : 'bg-muted-foreground/30'
      )}
    >
      <span
        className="absolute top-0.5 size-5 rounded-full bg-white shadow-sm"
        style={{ left: on ? 22 : 2 }}
      />
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Charts + calendar
 * ------------------------------------------------------------------ */

export function AreaChart({
  points,
  frame,
  startFrame = 10,
  endFrame = 54,
  width = 520,
  height = 180,
}: {
  points: number[];
  frame: number;
  startFrame?: number;
  endFrame?: number;
  width?: number;
  height?: number;
}) {
  const rawId = useId().replace(/[:]/g, '');
  const fillId = `film-area-${rawId}`;
  const clipId = `film-clip-${rawId}`;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const stepX = width / (points.length - 1);
  const coords = points.map((value, index) => {
    const x = index * stepX;
    const y = height - ((value - min) / (max - min || 1)) * (height - 12) - 4;
    return [x, y] as const;
  });
  // Smooth monotone-ish curve via midpoint quadratic segments.
  let linePath = `M${coords[0][0]},${coords[0][1]}`;
  for (let i = 1; i < coords.length; i += 1) {
    const [px, py] = coords[i - 1];
    const [x, y] = coords[i];
    const mx = (px + x) / 2;
    linePath += ` C${mx},${py} ${mx},${y} ${x},${y}`;
  }
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;
  const p = ease(frame, startFrame, endFrame, EASE_IN_OUT);
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      style={{ height }}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.22" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </linearGradient>
        <clipPath id={clipId}>
          <rect x="0" y="0" width={Math.max(0.001, width * p)} height={height} />
        </clipPath>
      </defs>
      {[0.25, 0.5, 0.75].map((line) => (
        <line
          key={line}
          x1="0"
          x2={width}
          y1={height * line}
          y2={height * line}
          stroke="hsl(var(--border))"
          strokeDasharray="4 4"
        />
      ))}
      <g clipPath={`url(#${clipId})`}>
        <path d={areaPath} fill={`url(#${fillId})`} />
        <path
          d={linePath}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

export function BarChart({
  data,
  frame,
  startFrame = 8,
  height = 160,
  labels,
}: {
  data: number[];
  frame: number;
  startFrame?: number;
  height?: number;
  labels?: string[];
}) {
  const max = Math.max(...data, 1);
  return (
    <div>
      <div className="flex items-end gap-2.5" style={{ height }}>
        {data.map((value, index) => {
          const p = ease(frame, startFrame + index * 3, startFrame + 30 + index * 3);
          return (
            <div key={index} className="flex flex-1 items-end">
              <div
                className="bg-primary/80 w-full rounded-t-md"
                style={{ height: Math.max(2, (value / max) * (height - 8) * p) }}
              />
            </div>
          );
        })}
      </div>
      {labels ? (
        <div className="mt-2 flex gap-2.5">
          {labels.map((label) => (
            <span key={label} className="text-muted-foreground flex-1 text-center text-[11px]">
              {label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function Donut({
  segments,
  frame,
  startFrame = 10,
  center,
  caption,
  size = 150,
}: {
  segments: { value: number; color: string }[];
  frame: number;
  startFrame?: number;
  center: string;
  caption?: string;
  size?: number;
}) {
  const sum = segments.reduce((acc, segment) => acc + segment.value, 0) || 1;
  const radius = size / 2 - 12;
  const circumference = 2 * Math.PI * radius;
  const sweep = ease(frame, startFrame, startFrame + 40);
  let offset = 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={16}
        />
        {segments.map((segment, index) => {
          const dash = (segment.value / sum) * sweep * circumference;
          const el = (
            <circle
              key={index}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={16}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
            />
          );
          offset += dash;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-foreground text-xl font-bold tabular-nums">{center}</span>
        {caption ? <span className="text-muted-foreground text-[11px]">{caption}</span> : null}
      </div>
    </div>
  );
}

/** October 2026 starts on a Thursday (Mon-first grid column 3). */
const MONTH_OFFSET = 3;
const MONTH_DAYS = 31;

/** Mon-first weekday index (0 = Mon … 6 = Sun) for a date in the film's month. */
export function filmWeekday(date: number): number {
  return (MONTH_OFFSET + date - 1) % 7;
}

/** Default nightly rate: Fri/Sat nights cost more. */
export function filmNightlyRate(date: number): string {
  const day = filmWeekday(date);
  return day === 4 || day === 5 ? '₱4,200' : '₱3,200';
}

/** Month grid (October 2026) with booked stays, blocked days, and nightly prices. */
export function MonthGrid({
  frame,
  booked = [],
  blocked = [],
  smart = [],
  highlight = [],
  cellHeight = 62,
  priceFor = filmNightlyRate,
  guests = {},
}: {
  frame: number;
  booked?: number[];
  blocked?: number[];
  smart?: number[];
  highlight?: number[];
  cellHeight?: number;
  priceFor?: (date: number) => string;
  /** Guest label keyed by the first night of each stay. */
  guests?: Record<number, string>;
}) {
  const compact = cellHeight < 52;
  // Label for a pill: the stay's guest, even when the stay wraps onto a new week row.
  const stayGuest = (date: number) => {
    let start = date;
    while (guests[start] == null && booked.includes(start - 1)) start -= 1;
    return guests[start] ?? 'Guest';
  };
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
        <div key={day} className="text-muted-foreground pb-1 text-center text-[11px] font-semibold">
          {day}
        </div>
      ))}
      {Array.from({ length: 35 }, (_, index) => {
        const date = index - MONTH_OFFSET + 1;
        const appear = ease(frame, 4 + Math.floor(index / 7) * 3, 20 + Math.floor(index / 7) * 3);
        if (date < 1 || date > MONTH_DAYS) {
          return <div key={index} style={{ height: cellHeight, opacity: appear }} />;
        }
        const isBooked = booked.includes(date);
        const isRun =
          isBooked && booked.includes(date - 1) && index % 7 !== 0 && guests[date] == null;
        const isBlocked = blocked.includes(date);
        const isSmart = smart.includes(date);
        const isHot = highlight.includes(date);
        return (
          <div
            key={index}
            className={cn(
              'relative overflow-hidden rounded-lg border',
              isBlocked
                ? 'border-border bg-muted'
                : isHot
                  ? 'border-primary bg-primary/10'
                  : 'border-border/70 bg-card'
            )}
            style={{ height: cellHeight, opacity: appear }}
          >
            <span
              className={cn(
                'text-muted-foreground absolute left-1.5 top-1 font-semibold',
                compact ? 'text-[10px]' : 'text-[11px]'
              )}
            >
              {date}
            </span>
            {isBooked ? (
              <span
                className={cn(
                  'bg-primary text-primary-foreground absolute bottom-1 flex items-center rounded-md px-1.5 font-semibold',
                  compact ? 'h-4 text-[9px]' : 'h-5 text-[10px]',
                  isRun ? '-left-2 right-1 rounded-l-none' : 'inset-x-1'
                )}
              >
                <span className="truncate">{isRun ? '' : stayGuest(date)}</span>
              </span>
            ) : isBlocked ? (
              <span className="text-muted-foreground absolute inset-x-1 bottom-1 text-center text-[10px] font-semibold">
                Blocked
              </span>
            ) : (
              <span
                className={cn(
                  'absolute bottom-1 right-1.5 flex items-center gap-1 font-semibold tabular-nums',
                  compact ? 'text-[10px]' : 'left-1.5 right-auto text-[12px]',
                  isSmart ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'
                )}
              >
                {priceFor(date)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Phone device mockup for Telegram, guest call, etc. */
export function PhoneFrame({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={cn(
        'border-foreground/90 bg-background relative h-[560px] w-[280px] overflow-hidden rounded-[44px] border-[7px] shadow-[0_30px_70px_-20px_rgb(15_23_42_/_0.45)]',
        className
      )}
      style={style}
    >
      <div className="bg-foreground/90 absolute left-1/2 top-2 z-10 h-6 w-24 -translate-x-1/2 rounded-full" />
      {children}
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
    <div className={cn(CARD, 'shadow-elevated flex w-[330px] items-start gap-3 p-4')} style={style}>
      <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-foreground text-sm font-semibold">{title}</p>
        <p className="text-muted-foreground mt-0.5 text-[13px] leading-snug">{body}</p>
      </div>
    </div>
  );
}

const ROOM_ART: ((id: string) => ReactNode)[] = [
  // 0 · Living room at golden hour: window to the city, sofa, lamp, plant.
  (id) => (
    <>
      <rect width="400" height="300" fill="#f1e2cf" />
      <defs>
        <linearGradient id={`${id}-film-sky-gold`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd59e" />
          <stop offset="1" stopColor="#f39c6b" />
        </linearGradient>
      </defs>
      <rect x="150" y="34" width="210" height="150" rx="6" fill={`url(#${id}-film-sky-gold)`} />
      <path
        d="M150 184 V140 h22 v-30 h18 v42 h20 v-58 h24 v66 h18 v-36 h26 v48 h22 v-24 h30 v32 h30 v40 Z"
        fill="#c9785a"
        opacity="0.55"
      />
      <rect
        x="150"
        y="34"
        width="210"
        height="150"
        rx="6"
        fill="none"
        stroke="#fff8ee"
        strokeWidth="8"
      />
      <line x1="255" y1="34" x2="255" y2="184" stroke="#fff8ee" strokeWidth="6" />
      <rect y="214" width="400" height="86" fill="#c49a73" />
      <path d="M170 214 L250 214 L320 300 L200 300 Z" fill="#ffe2b8" opacity="0.45" />
      <rect x="40" y="168" width="190" height="60" rx="16" fill="#5d7d73" />
      <rect x="30" y="150" width="210" height="34" rx="14" fill="#6f9085" />
      <rect x="52" y="146" width="56" height="34" rx="10" fill="#f3d9a6" />
      <rect x="120" y="148" width="50" height="32" rx="10" fill="#e8b98c" />
      <rect x="48" y="226" width="10" height="18" fill="#4a3a2c" />
      <rect x="212" y="226" width="10" height="18" fill="#4a3a2c" />
      <rect x="300" y="236" width="70" height="10" rx="4" fill="#8a5e3c" />
      <rect x="22" y="90" width="4" height="78" fill="#3d3a36" />
      <path d="M6 80 h36 l-8 -26 h-20 Z" fill="#fff1d6" />
      <ellipse cx="372" cy="200" rx="22" ry="34" fill="#4f8a5b" />
      <rect x="362" y="214" width="20" height="22" rx="3" fill="#d9c2a3" />
    </>
  ),
  // 1 · Bedroom, bright and airy.
  () => (
    <>
      <rect width="400" height="300" fill="#eef2f1" />
      <rect
        x="250"
        y="30"
        width="120"
        height="140"
        rx="6"
        fill="#d8ecf3"
        stroke="#ffffff"
        strokeWidth="8"
      />
      <path d="M250 30 L300 30 L210 300 L120 300 Z" fill="#ffffff" opacity="0.55" />
      <rect y="230" width="400" height="70" fill="#e3d5c1" />
      <rect x="60" y="96" width="220" height="80" rx="12" fill="#d7c1a0" />
      <rect x="44" y="160" width="252" height="70" rx="12" fill="#ffffff" />
      <rect x="44" y="190" width="252" height="40" rx="10" fill="#cfe0dc" />
      <rect x="72" y="138" width="80" height="34" rx="12" fill="#f8f4ec" />
      <rect x="166" y="138" width="80" height="34" rx="12" fill="#f8f4ec" />
      <rect x="304" y="178" width="46" height="52" rx="6" fill="#c8a983" />
      <circle cx="327" cy="164" r="12" fill="#f6e3b4" />
      <line x1="170" y1="0" x2="170" y2="40" stroke="#b8a48a" strokeWidth="2" />
      <path d="M150 40 h40 l-6 18 h-28 Z" fill="#e7d5b8" />
    </>
  ),
  // 2 · Balcony city view at dusk.
  (id) => (
    <>
      <defs>
        <linearGradient id={`${id}-film-sky-dusk`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#24386a" />
          <stop offset="0.55" stopColor="#7a5ea6" />
          <stop offset="1" stopColor="#f2a070" />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill={`url(#${id}-film-sky-dusk)`} />
      <circle cx="300" cy="196" r="26" fill="#ffd38a" opacity="0.85" />
      <path
        d="M0 230 V170 h30 v-40 h26 v56 h22 v-80 h34 v90 h18 v-50 h28 v62 h24 v-96 h30 v100 h22 v-44 h26 v58 h30 v-70 h28 v76 h22 v-30 h30 v40 Z"
        fill="#1c2443"
      />
      {[40, 66, 96, 124, 178, 206, 236, 262, 320, 350].map((x, i) => (
        <rect
          key={x}
          x={x}
          y={150 + (i % 3) * 18}
          width="5"
          height="7"
          fill="#ffd38a"
          opacity="0.9"
        />
      ))}
      <rect y="230" width="400" height="70" fill="#121a31" />
      <rect y="236" width="400" height="4" fill="#9fb3d9" opacity="0.6" />
      {[20, 80, 140, 200, 260, 320, 380].map((x) => (
        <rect key={x} x={x} y="236" width="3" height="64" fill="#9fb3d9" opacity="0.4" />
      ))}
    </>
  ),
  // 3 · Pool deck with loungers and palms.
  (id) => (
    <>
      <rect width="400" height="300" fill="#bfe6f5" />
      <circle cx="70" cy="60" r="26" fill="#fff4c9" />
      <rect x="0" y="120" width="400" height="40" fill="#e9dcc6" />
      <path d="M340 120 q4 -60 14 -80" stroke="#7b5b3a" strokeWidth="6" fill="none" />
      <path
        d="M354 40 q-30 -6 -44 14 M354 40 q26 -10 40 8 M354 40 q-10 -24 -30 -26 M354 40 q14 -22 34 -20"
        stroke="#3f8f5f"
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
      />
      <defs>
        <linearGradient id={`${id}-film-pool`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4cc6db" />
          <stop offset="1" stopColor="#1a8aa3" />
        </linearGradient>
      </defs>
      <rect x="0" y="160" width="400" height="140" fill={`url(#${id}-film-pool)`} />
      {[0, 1, 2, 3].map((row) => (
        <path
          key={row}
          d={`M${20 + row * 30} ${190 + row * 26} q20 -8 40 0 t40 0`}
          stroke="#ffffff"
          strokeWidth="3"
          fill="none"
          opacity="0.55"
        />
      ))}
      {[40, 160].map((x) => (
        <g key={x}>
          <rect x={x + 22} y="126" width="72" height="9" rx="4" fill="#ffffff" />
          <path
            d={`M${x + 26} 130 L${x + 6} 108`}
            stroke="#ffffff"
            strokeWidth="9"
            strokeLinecap="round"
          />
          <rect x={x + 30} y="135" width="4" height="10" fill="#b9c4c9" />
          <rect x={x + 84} y="135" width="4" height="10" fill="#b9c4c9" />
          <rect x={x + 40} y="119" width="26" height="8" rx="4" fill="#f6b26b" />
        </g>
      ))}
    </>
  ),
];

/** Flat illustrated listing "photo" so nothing depends on network images. */
export function PhotoTile({
  variant = 0,
  className,
  style,
  children,
}: {
  variant?: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const id = useId().replace(/[:]/g, '');
  return (
    <div className={cn('relative overflow-hidden rounded-xl', className)} style={style}>
      <svg
        viewBox="0 0 400 300"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 size-full"
        aria-hidden
      >
        {ROOM_ART[variant % ROOM_ART.length](id)}
      </svg>
      {children}
    </div>
  );
}
