/**
 * Social creative tokens (v3): flat color planes only. No washes, blurs or grain.
 *
 * Palette rules (why v3 exists):
 * - One brand green, a clean emerald, used as a full plane or as an accent. Never two
 *   mid-greens touching (no green text on a green plane of similar depth).
 * - Darks are graphite with a trace of green, not saturated teal-black.
 * - On the brand plane the accent is pale mint (light on mid), never dark forest.
 * - Lights are near-neutral; green tint only on chips and the `tint` tone.
 * Contrast: white on brand 4.3:1, onBrand on brand 3.5:1 (display only),
 * brandDeep on paper 5.0:1, mint on night 10:1.
 */
export const c = {
  // darks
  night: 'hsl(160 12% 8%)',
  graphite: 'hsl(160 9% 12%)',
  graphiteLine: 'hsl(160 7% 21%)',
  nightSurface: 'hsl(160 8% 14%)',
  nightSub: 'hsl(150 6% 68%)',
  // brand
  brand: 'hsl(162 80% 30%)',
  brandDeep: 'hsl(162 84% 25%)',
  brandTrack: 'hsl(158 50% 44%)',
  onBrand: 'hsl(150 70% 86%)',
  onBrandSub: 'hsl(150 45% 92%)',
  mint: 'hsl(154 56% 62%)', // accent on dark planes
  mintDim: 'hsl(158 30% 30%)', // quiet fills on dark (chart bars, idle tiles)
  // lights
  tint: 'hsl(150 36% 92%)',
  tintPlane: 'hsl(150 32% 89%)',
  tintLine: 'hsl(152 22% 78%)',
  paper: 'hsl(140 10% 96.5%)',
  white: '#ffffff',
  ink: 'hsl(165 20% 9%)',
  inkSoft: 'hsl(165 8% 30%)',
  muted: 'hsl(165 5% 45%)',
  line: 'hsl(150 8% 88%)',
  sun: 'hsl(42 96% 62%)', // single small highlight per piece, at most
  coral: 'hsl(8 78% 60%)', // negative values only (expenses, overdue)
} as const;

export type ToneName = 'paper' | 'white' | 'tint' | 'brand' | 'graphite' | 'night';

export interface Tone {
  bg: string;
  fg: string;
  sub: string;
  accent: string;
  line: string;
  /** Card / tile surface sitting on this background. */
  surface: string;
  /** Brand diamond color on this background. */
  mark: string;
  dark: boolean;
}

export const tones: Record<ToneName, Tone> = {
  paper: {
    bg: c.paper,
    fg: c.ink,
    sub: c.inkSoft,
    accent: c.brandDeep,
    line: c.line,
    surface: c.white,
    mark: c.brand,
    dark: false,
  },
  white: {
    bg: c.white,
    fg: c.ink,
    sub: c.inkSoft,
    accent: c.brandDeep,
    line: c.line,
    surface: c.paper,
    mark: c.brand,
    dark: false,
  },
  tint: {
    bg: c.tintPlane,
    fg: c.ink,
    sub: 'hsl(160 14% 26%)',
    accent: c.brandDeep,
    line: c.tintLine,
    surface: c.white,
    mark: c.brand,
    dark: false,
  },
  brand: {
    bg: c.brand,
    fg: c.white,
    sub: c.onBrandSub,
    accent: c.onBrand,
    line: c.brandTrack,
    surface: c.white,
    mark: c.white,
    dark: true,
  },
  graphite: {
    bg: c.graphite,
    fg: c.white,
    sub: c.nightSub,
    accent: c.mint,
    line: c.graphiteLine,
    surface: c.nightSurface,
    mark: c.mint,
    dark: true,
  },
  night: {
    bg: c.night,
    fg: c.white,
    sub: c.nightSub,
    accent: c.mint,
    line: c.graphiteLine,
    surface: c.nightSurface,
    mark: c.mint,
    dark: true,
  },
};

export const FONT = "'Jakarta', system-ui, sans-serif";

export type FormatKind = 'vertical' | 'portrait' | 'square' | 'landscape';

export interface Format {
  id: string;
  /** Output pixels. */
  width: number;
  height: number;
  /** Width the layout is designed at; the frame is scaled to the output width. */
  designWidth: number;
  kind: FormatKind;
  label: string;
}

const f = (
  id: string,
  width: number,
  height: number,
  designWidth: number,
  kind: FormatKind,
  label: string
): Format => ({
  id,
  width,
  height,
  designWidth,
  kind,
  label,
});

export const formats = {
  story: f('story', 1080, 1920, 1080, 'vertical', 'Story, Reel, TikTok 9:16'),
  portrait: f('portrait', 1080, 1350, 1080, 'portrait', 'Feed portrait 4:5'),
  square: f('square', 1080, 1080, 1080, 'square', 'Feed square 1:1'),
  landscape: f('landscape', 1920, 1080, 1920, 'landscape', 'Landscape 16:9'),
  link: f('link', 1200, 628, 1920, 'landscape', 'Link ad 1.91:1'),
  email: f('email', 1200, 600, 1920, 'landscape', 'Email hero 2:1 (600px @2x)'),
} as const;

export type FormatId = keyof typeof formats;

export const FPS = 30;

/** 9:16 overlays: profile/audio on top, caption + action rail at the bottom and right. */
export const STORY_SAFE = { top: 250, bottom: 1340, right: 940 } as const;
