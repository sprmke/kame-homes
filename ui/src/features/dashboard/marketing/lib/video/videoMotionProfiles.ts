/**
 * Per-template camera motion. Every template renders the same layer stack, so
 * motion is one of the few axes that carries template identity into the video
 * itself — it is resolved from `project.templateId` on every render path.
 */
export type VideoMotionProfile = {
  /** Background scale at the first and last frame of a scene. */
  zoomFrom: number;
  zoomTo: number;
  /** Horizontal / vertical background sweep across a scene, in % of frame width. */
  panXPct: number;
  panYPct: number;
  /** Flip the horizontal sweep on every other scene (countdown cadence). */
  alternatePan?: boolean;
  /**
   * Overlay entrance spring. Lower damping = bouncier. Both are required —
   * passing `undefined` to Remotion's `spring()` overrides its default with NaN.
   */
  springDamping: number;
  springStiffness: number;
  /** Overlay entrance travel in composition pixels. */
  entryOffsetX: number;
  entryOffsetY: number;
  /** Frames a CTA scene takes to fade up. */
  ctaRevealFrames: number;
};

/**
 * Behaviour of the video editor before per-template motion shipped. Used for any
 * template id missing from the table below, so older saved projects render unchanged.
 */
export const DEFAULT_VIDEO_MOTION_PROFILE: VideoMotionProfile = {
  zoomFrom: 1,
  zoomTo: 1.06,
  panXPct: 0,
  panYPct: 0,
  springDamping: 16,
  // Remotion's own default — the pre-redesign editor never passed a stiffness.
  springStiffness: 100,
  entryOffsetX: 0,
  entryOffsetY: 24,
  ctaRevealFrames: 12,
};

/** Quiet Coast Motion — soft Ken Burns by default; flash/urgency punches harder. */
const VIDEO_TEMPLATE_MOTION_PROFILES: Record<string, VideoMotionProfile> = {
  'quiet-morning': {
    zoomFrom: 1,
    zoomTo: 1.08,
    panXPct: 0,
    panYPct: -1.2,
    springDamping: 22,
    springStiffness: 90,
    entryOffsetX: 0,
    entryOffsetY: 28,
    ctaRevealFrames: 16,
  },
  'golden-hour': {
    zoomFrom: 1.02,
    zoomTo: 1.12,
    panXPct: 1.8,
    panYPct: 0,
    springDamping: 18,
    springStiffness: 100,
    entryOffsetX: 0,
    entryOffsetY: 22,
    ctaRevealFrames: 14,
  },
  'poolside-calm': {
    zoomFrom: 1.04,
    zoomTo: 1.1,
    panXPct: 0,
    panYPct: -0.8,
    springDamping: 26,
    springStiffness: 80,
    entryOffsetX: 0,
    entryOffsetY: 18,
    ctaRevealFrames: 20,
  },
  'amenity-tour': {
    zoomFrom: 1.02,
    zoomTo: 1.1,
    panXPct: 2,
    panYPct: 0,
    alternatePan: true,
    springDamping: 16,
    springStiffness: 110,
    entryOffsetX: 16,
    entryOffsetY: 12,
    ctaRevealFrames: 12,
  },
  'weekday-cut': {
    zoomFrom: 1,
    zoomTo: 1.16,
    panXPct: 0,
    panYPct: 0,
    springDamping: 10,
    springStiffness: 160,
    entryOffsetX: 0,
    entryOffsetY: 36,
    ctaRevealFrames: 8,
  },
  'percent-off': {
    zoomFrom: 1.02,
    zoomTo: 1.12,
    panXPct: 0,
    panYPct: -1.4,
    springDamping: 14,
    springStiffness: 120,
    entryOffsetX: 0,
    entryOffsetY: 30,
    ctaRevealFrames: 10,
  },
  'rainy-day-rate': {
    zoomFrom: 1.06,
    zoomTo: 1.02,
    panXPct: -1.6,
    panYPct: 0,
    springDamping: 18,
    springStiffness: 100,
    entryOffsetX: 0,
    entryOffsetY: 24,
    ctaRevealFrames: 12,
  },
  'one-left': {
    zoomFrom: 1.1,
    zoomTo: 1.18,
    panXPct: 0,
    panYPct: 0,
    springDamping: 24,
    springStiffness: 100,
    entryOffsetX: 0,
    entryOffsetY: 14,
    ctaRevealFrames: 14,
  },
  'three-dates': {
    zoomFrom: 1.04,
    zoomTo: 1.12,
    panXPct: 2.4,
    panYPct: 0,
    alternatePan: true,
    springDamping: 14,
    springStiffness: 100,
    entryOffsetX: 18,
    entryOffsetY: 0,
    ctaRevealFrames: 10,
  },
  'this-weekend': {
    zoomFrom: 1,
    zoomTo: 1.18,
    panXPct: 0,
    panYPct: 0,
    springDamping: 9,
    springStiffness: 170,
    entryOffsetX: 0,
    entryOffsetY: 40,
    ctaRevealFrames: 7,
  },
  'guest-love': {
    zoomFrom: 1.02,
    zoomTo: 1.08,
    panXPct: 0,
    panYPct: -1,
    springDamping: 20,
    springStiffness: 90,
    entryOffsetX: 0,
    entryOffsetY: 26,
    ctaRevealFrames: 16,
  },
  'stay-again': {
    zoomFrom: 1.03,
    zoomTo: 1.09,
    panXPct: 1.4,
    panYPct: 0,
    springDamping: 22,
    springStiffness: 95,
    entryOffsetX: 0,
    entryOffsetY: 20,
    ctaRevealFrames: 18,
  },
  'sold-out-stamp': {
    zoomFrom: 1.01,
    zoomTo: 1.03,
    panXPct: 0,
    panYPct: 0,
    springDamping: 28,
    springStiffness: 90,
    entryOffsetX: 0,
    entryOffsetY: 10,
    ctaRevealFrames: 22,
  },
  'join-waitlist': {
    zoomFrom: 1.08,
    zoomTo: 1.02,
    panXPct: 0,
    panYPct: -1.4,
    springDamping: 18,
    springStiffness: 100,
    entryOffsetX: 0,
    entryOffsetY: 24,
    ctaRevealFrames: 14,
  },
  'ber-months': {
    zoomFrom: 1.02,
    zoomTo: 1.12,
    panXPct: 1.6,
    panYPct: -0.8,
    springDamping: 17,
    springStiffness: 100,
    entryOffsetX: 0,
    entryOffsetY: 28,
    ctaRevealFrames: 14,
  },
  'holiday-glow': {
    zoomFrom: 1,
    zoomTo: 1.1,
    panXPct: 0,
    panYPct: 0,
    springDamping: 12,
    springStiffness: 130,
    entryOffsetX: 0,
    entryOffsetY: 32,
    ctaRevealFrames: 18,
  },
};

/** Per-scene escape hatch from the template signature. */
export type VideoMotionOverride =
  | 'slow-zoom-in'
  | 'punch-in'
  | 'zoom-out'
  | 'pan-left'
  | 'pan-right'
  | 'drift-up'
  | 'diagonal-drift'
  | 'hold';

const VIDEO_MOTION_OVERRIDE_PROFILES: Record<VideoMotionOverride, VideoMotionProfile> = {
  'slow-zoom-in': {
    zoomFrom: 1,
    zoomTo: 1.08,
    panXPct: 0,
    panYPct: 0,
    springDamping: 18,
    springStiffness: 100,
    entryOffsetX: 0,
    entryOffsetY: 24,
    ctaRevealFrames: 12,
  },
  'punch-in': {
    zoomFrom: 1,
    zoomTo: 1.2,
    panXPct: 0,
    panYPct: 0,
    springDamping: 9,
    springStiffness: 180,
    entryOffsetX: 0,
    entryOffsetY: 40,
    ctaRevealFrames: 8,
  },
  'zoom-out': {
    zoomFrom: 1.14,
    zoomTo: 1.02,
    panXPct: 0,
    panYPct: 0,
    springDamping: 20,
    springStiffness: 100,
    entryOffsetX: 0,
    entryOffsetY: 20,
    ctaRevealFrames: 14,
  },
  'pan-left': {
    zoomFrom: 1.06,
    zoomTo: 1.12,
    panXPct: -2.6,
    panYPct: 0,
    springDamping: 18,
    springStiffness: 100,
    entryOffsetX: -20,
    entryOffsetY: 0,
    ctaRevealFrames: 12,
  },
  'pan-right': {
    zoomFrom: 1.06,
    zoomTo: 1.12,
    panXPct: 2.6,
    panYPct: 0,
    springDamping: 18,
    springStiffness: 100,
    entryOffsetX: 20,
    entryOffsetY: 0,
    ctaRevealFrames: 12,
  },
  'drift-up': {
    zoomFrom: 1.04,
    zoomTo: 1.12,
    panXPct: 0,
    panYPct: -2,
    springDamping: 18,
    springStiffness: 100,
    entryOffsetX: 0,
    entryOffsetY: 30,
    ctaRevealFrames: 12,
  },
  'diagonal-drift': {
    zoomFrom: 1.06,
    zoomTo: 1.14,
    panXPct: 2,
    panYPct: 1.6,
    springDamping: 17,
    springStiffness: 100,
    entryOffsetX: 22,
    entryOffsetY: 14,
    ctaRevealFrames: 12,
  },
  hold: {
    zoomFrom: 1.01,
    zoomTo: 1.02,
    panXPct: 0,
    panYPct: 0,
    springDamping: 26,
    springStiffness: 100,
    entryOffsetX: 0,
    entryOffsetY: 10,
    ctaRevealFrames: 18,
  },
};

export const VIDEO_MOTION_OVERRIDES: { value: VideoMotionOverride; label: string }[] = [
  { value: 'slow-zoom-in', label: 'Slow zoom in' },
  { value: 'punch-in', label: 'Punch in' },
  { value: 'zoom-out', label: 'Zoom out' },
  { value: 'pan-left', label: 'Pan left' },
  { value: 'pan-right', label: 'Pan right' },
  { value: 'drift-up', label: 'Drift up' },
  { value: 'diagonal-drift', label: 'Diagonal drift' },
  { value: 'hold', label: 'Hold' },
];

export function resolveVideoMotionProfile(templateId: string | undefined): VideoMotionProfile {
  if (!templateId) return DEFAULT_VIDEO_MOTION_PROFILE;
  return VIDEO_TEMPLATE_MOTION_PROFILES[templateId] ?? DEFAULT_VIDEO_MOTION_PROFILE;
}

/** A scene's own Motion select wins over the template signature. */
export function resolveSceneMotionProfile(
  templateProfile: VideoMotionProfile,
  override: VideoMotionOverride | undefined
): VideoMotionProfile {
  if (!override) return templateProfile;
  return VIDEO_MOTION_OVERRIDE_PROFILES[override] ?? templateProfile;
}

export function isVideoMotionOverride(value: unknown): value is VideoMotionOverride {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(VIDEO_MOTION_OVERRIDE_PROFILES, value)
  );
}

/**
 * Zoom floor that keeps a panning background from exposing the frame edge.
 * Only panning profiles need it — a still background must render its authored
 * zoom exactly, so pre-motion projects keep starting at scale 1.
 */
function safeScale(profile: VideoMotionProfile, zoom: number): number {
  const sweep = Math.max(Math.abs(profile.panXPct), Math.abs(profile.panYPct));
  if (sweep <= 0) return zoom;
  return Math.max(zoom, 1 + sweep / 100 + 0.02);
}

/**
 * Ken Burns transform for a scene background. `progress` runs 0 → 1 across the
 * scene; the pan sweeps symmetrically so the midpoint stays centred.
 */
export function backgroundMotionTransform(
  profile: VideoMotionProfile,
  progress: number,
  sceneIndex: number,
  zoom: number
): string {
  const direction = profile.alternatePan && sceneIndex % 2 === 1 ? -1 : 1;
  const offset = progress - 0.5;
  const x = profile.panXPct * direction * offset;
  const y = profile.panYPct * offset;
  const scale = safeScale(profile, zoom);
  return `translate(${x.toFixed(3)}%, ${y.toFixed(3)}%) scale(${scale.toFixed(4)})`;
}
