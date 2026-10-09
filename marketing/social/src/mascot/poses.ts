import { EASE_IN_OUT, ease } from '../motion';
import { REST, type Pose, type Prop } from './Kame';

/**
 * Kame's acting vocabulary. Each preset is a base pose plus a "life" layer (breath,
 * blinks, the waving hand, the talking mouth) computed from the frame, so a still
 * (`frame = SETTLED`) and a video frame use the same code.
 *
 * Direction: Kame faces the viewer's left by default (three-quarter view). `pointR`
 * turns toward UI placed on the right of Kame, `pointL` toward UI on the left.
 */
export type PoseName =
  | 'idle'
  | 'wave'
  | 'cheer'
  | 'pointR'
  | 'pointL'
  | 'show'
  | 'hold'
  | 'talk'
  | 'love'
  | 'proud'
  | 'sleepy';

const base: Record<PoseName, Partial<Pose>> = {
  idle: {},
  wave: { armR: 125, eyes: 'happy', open: 0.7, tilt: -7 },
  cheer: { armL: -128, armR: 128, eyes: 'happy', open: 1, hop: 0.12 },
  pointR: { armR: 84, yaw: 44, headYaw: 8, tilt: -4, open: 0.35 },
  pointL: { armL: -84, yaw: -14, headYaw: -10, tilt: 4, open: 0.35 },
  show: { armR: 100, yaw: 14, headYaw: 6, tilt: -5, eyes: 'happy', open: 0.5 },
  hold: { armR: 62, armL: -24, yaw: 12, tilt: -3 },
  talk: { armR: 40, armL: -22, yaw: 10, tilt: -3 },
  love: { armL: -55, armR: 55, eyes: 'happy', blush: 1.4, tilt: 6 },
  proud: { armL: -34, armR: 34, headPitch: -6, open: 0.25, yaw: 6 },
  sleepy: { eyes: 'closed', tilt: 10, armL: -10, armR: 10, headPitch: 6 },
};

export interface PoseOptions {
  prop?: Prop;
  /** Seed so two Kames on one frame do not blink together. */
  seed?: number;
  /** Extra fields layered on top of the preset. */
  with?: Partial<Pose>;
  /** Freeze the life layer (used for perfectly still stills). */
  still?: boolean;
}

/** Frame-driven life: breathing, blinks, wave and talk loops. */
function life(name: PoseName, frame: number, p: Pose, seed: number, still: boolean): Pose {
  if (still) return p;
  const f = frame + seed * 37;
  const out = { ...p, breath: f };
  // Blink: ~4.5 frames closing and opening, every 110 frames.
  const k = f % 110;
  if (out.eyes === 'open' && k < 6) out.lids = Math.abs(k - 3) / 3;
  // Idle arm sway.
  out.armL += -Math.sin(f * 0.053) * 3;
  out.armR += Math.sin(f * 0.053) * 3;
  out.tilt += Math.sin(f * 0.03) * 2;
  if (name === 'wave') out.armR = 125 + Math.sin(f * 0.43) * 14;
  if (name === 'talk') {
    const syl = Math.max(0, Math.sin(f * 0.62));
    out.open = syl * (0.55 + 0.45 * Math.abs(Math.sin(f * 0.21)));
    out.wide = 0.35 + 0.5 * Math.abs(Math.sin(f * 0.17));
    out.armR = 40 + Math.sin(f * 0.1) * 8;
  }
  if (name === 'sleepy') out.headPitch += Math.sin(f * 0.04) * 2;
  return out;
}

export function pose(name: PoseName, frame: number, opts: PoseOptions = {}): Pose {
  const p: Pose = { ...REST, ...base[name], ...opts.with, prop: opts.prop ?? 'none' };
  return life(name, frame, p, opts.seed ?? 0, opts.still ?? false);
}

const NUM: (keyof Pose)[] = [
  'armL',
  'armR',
  'hop',
  'yaw',
  'headYaw',
  'headPitch',
  'tilt',
  'lids',
  'open',
  'wide',
  'blush',
];

/** Blend two poses; discrete fields (eyes, prop) switch halfway. */
export function blendPose(a: Pose, b: Pose, t: number): Pose {
  const out = { ...(t < 0.5 ? a : b) } as Pose;
  for (const k of NUM)
    (out as unknown as Record<string, number>)[k] =
      (a[k] as number) + ((b[k] as number) - (a[k] as number)) * t;
  out.breath = b.breath;
  return out;
}

export interface Beat {
  /** Frame the beat starts. */
  at: number;
  name: PoseName;
  prop?: Prop;
  with?: Partial<Pose>;
}

/**
 * A sequence of beats. Each transition eases over `blend` frames starting at the beat.
 * A hop is added on transitions with `hopOnChange`.
 */
export function timeline(
  frame: number,
  beats: Beat[],
  {
    blend = 12,
    seed = 0,
    hopOnChange = false,
  }: { blend?: number; seed?: number; hopOnChange?: boolean } = {}
): Pose {
  let i = 0;
  while (i < beats.length - 1 && frame >= beats[i + 1].at) i++;
  const cur = beats[i];
  const now = pose(cur.name, frame, { prop: cur.prop, with: cur.with, seed });
  if (i === 0) return now;
  const prev = beats[i - 1];
  const t = ease(frame, cur.at, cur.at + blend, EASE_IN_OUT);
  if (t >= 1) return now;
  const before = pose(prev.name, frame, { prop: prev.prop, with: prev.with, seed });
  const out = blendPose(before, now, t);
  if (hopOnChange) out.hop += Math.sin(t * Math.PI) * 0.18;
  return out;
}
