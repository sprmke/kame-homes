/**
 * Social creative tokens (v2): flat color planes only. No washes, blurs or grain.
 * Every tone is a solid field; depth comes from scale, crop and contrast, not light effects.
 * Brand anchor: product primary `hsl(168 65% 40%)` from ui/src/index.css.
 */
export const c = {
  forest: 'hsl(172 58% 10%)',
  pine: 'hsl(171 60% 16%)',
  pineLine: 'hsl(170 40% 24%)',
  teal: 'hsl(168 65% 40%)', // brand primary
  tealDeep: 'hsl(169 70% 29%)',
  mint: 'hsl(163 60% 80%)',
  mintSoft: 'hsl(160 42% 92%)',
  paper: 'hsl(150 12% 96%)',
  white: '#ffffff',
  ink: 'hsl(175 28% 8%)',
  inkSoft: 'hsl(175 9% 30%)',
  muted: 'hsl(175 5% 46%)',
  line: 'hsl(160 9% 87%)',
  sun: 'hsl(44 100% 64%)', // single small highlight per piece, at most
} as const;

export type ToneName = 'paper' | 'white' | 'mint' | 'teal' | 'pine' | 'forest';

export interface Tone {
  bg: string;
  fg: string;
  sub: string;
  accent: string;
  line: string;
  /** Card / tile surface sitting on this background. */
  surface: string;
  dark: boolean;
}

export const tones: Record<ToneName, Tone> = {
  paper: {
    bg: c.paper,
    fg: c.ink,
    sub: c.inkSoft,
    accent: c.teal,
    line: c.line,
    surface: c.white,
    dark: false,
  },
  white: {
    bg: c.white,
    fg: c.ink,
    sub: c.inkSoft,
    accent: c.teal,
    line: c.line,
    surface: c.paper,
    dark: false,
  },
  mint: {
    bg: c.mint,
    fg: c.forest,
    sub: 'hsl(172 40% 22%)',
    accent: c.tealDeep,
    line: 'hsl(165 35% 70%)',
    surface: c.white,
    dark: false,
  },
  teal: {
    bg: c.teal,
    fg: c.white,
    sub: 'hsl(165 60% 92%)',
    accent: c.forest,
    line: 'hsl(168 55% 52%)',
    surface: c.white,
    dark: true,
  },
  pine: {
    bg: c.pine,
    fg: c.white,
    sub: 'hsl(165 18% 72%)',
    accent: c.mint,
    line: c.pineLine,
    surface: 'hsl(171 50% 21%)',
    dark: true,
  },
  forest: {
    bg: c.forest,
    fg: c.white,
    sub: 'hsl(165 14% 66%)',
    accent: c.mint,
    line: 'hsl(170 35% 18%)',
    surface: 'hsl(171 45% 15%)',
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
