/**
 * Curated type systems for Marketing Studio posters.
 *
 * Every reference post we benchmark against uses 3–4 type voices with fixed jobs:
 * a display face (chunky rounded or high-contrast serif), a script accent, tracked
 * small caps for labels, and a clean sans for body copy. Pairings are hand-picked
 * here; the AI director only chooses a pairing id and never names a font.
 *
 * Weights are 400/700 only: OpenPolotno injects Google Fonts with
 * `400,400italic,700,700italic`, so any other weight would be browser-synthesized.
 */

export type PosterTypeRole = {
  family: string;
  weight: '400' | '700';
  style?: 'normal' | 'italic';
  /** Em multiplier (OpenPolotno multiplies by fontSize). */
  letterSpacing: number;
  lineHeight: number;
  uppercase?: boolean;
  /**
   * Average glyph advance as a fraction of fontSize for mixed-case text. Used to
   * pre-fit copy before fonts load; the post-load pass (`fitPosterTextSlots`) corrects
   * any remaining drift with real Konva measurements. Err slightly high.
   */
  widthFactor: number;
};

export type PosterDisplayEffect = 'none' | 'soft-shadow' | 'outline-shadow';

export type PosterFontPairing = {
  id: PosterFontPairingId;
  label: string;
  display: PosterTypeRole;
  script: PosterTypeRole;
  eyebrow: PosterTypeRole;
  body: PosterTypeRole;
  chip: PosterTypeRole;
  displayEffect: PosterDisplayEffect;
};

export const POSTER_FONT_PAIRING_IDS = [
  'cozy-cafe',
  'tropical-script',
  'night-brush',
  'editorial-calm',
  'magazine-cover',
  'playful-pop',
  'modern-minimal',
  'sunny-weekend',
] as const;

export type PosterFontPairingId = (typeof POSTER_FONT_PAIRING_IDS)[number];

const POPPINS_BODY: PosterTypeRole = {
  family: 'Poppins',
  weight: '400',
  letterSpacing: 0.01,
  lineHeight: 1.35,
  widthFactor: 0.58,
};

const POPPINS_CHIP: PosterTypeRole = {
  family: 'Poppins',
  weight: '700',
  letterSpacing: 0.06,
  lineHeight: 1.1,
  uppercase: true,
  widthFactor: 0.62,
};

const MONTSERRAT_EYEBROW: PosterTypeRole = {
  family: 'Montserrat',
  weight: '700',
  letterSpacing: 0.3,
  lineHeight: 1.1,
  uppercase: true,
  widthFactor: 0.66,
};

export const POSTER_FONT_PAIRINGS: Record<PosterFontPairingId, PosterFontPairing> = {
  // Kame "Coffee • View • You time": chunky rounded caps + flowing script.
  'cozy-cafe': {
    id: 'cozy-cafe',
    label: 'Cozy Café',
    display: {
      family: 'Fredoka',
      weight: '700',
      letterSpacing: 0.01,
      lineHeight: 0.98,
      uppercase: true,
      widthFactor: 0.64,
    },
    script: { family: 'Allura', weight: '400', letterSpacing: 0, lineHeight: 1, widthFactor: 0.4 },
    eyebrow: { ...POPPINS_CHIP, letterSpacing: 0.08 },
    body: { ...POPPINS_BODY, uppercase: true, letterSpacing: 0.04, widthFactor: 0.64 },
    chip: POPPINS_CHIP,
    displayEffect: 'soft-shadow',
  },
  // Four J's "Bali" day: tracked caps eyebrow, huge script word, bold caps sub.
  'tropical-script': {
    id: 'tropical-script',
    label: 'Tropical Script',
    display: {
      family: 'Montserrat',
      weight: '700',
      letterSpacing: 0.02,
      lineHeight: 1.05,
      uppercase: true,
      widthFactor: 0.7,
    },
    script: {
      family: 'Great Vibes',
      weight: '400',
      letterSpacing: 0,
      lineHeight: 0.95,
      widthFactor: 0.42,
    },
    eyebrow: MONTSERRAT_EYEBROW,
    body: POPPINS_BODY,
    chip: { ...MONTSERRAT_EYEBROW, letterSpacing: 0.22 },
    displayEffect: 'none',
  },
  // Four J's "Bali" night: brush script over a dark photo, friendly sans body.
  'night-brush': {
    id: 'night-brush',
    label: 'Night Brush',
    display: {
      family: 'Montserrat',
      weight: '700',
      letterSpacing: 0.03,
      lineHeight: 1.05,
      uppercase: true,
      widthFactor: 0.7,
    },
    script: {
      family: 'Kaushan Script',
      weight: '400',
      letterSpacing: 0,
      lineHeight: 1,
      widthFactor: 0.5,
    },
    eyebrow: { ...POPPINS_BODY, letterSpacing: 0.02, widthFactor: 0.56 },
    body: POPPINS_BODY,
    chip: { ...MONTSERRAT_EYEBROW, letterSpacing: 0.08 },
    displayEffect: 'soft-shadow',
  },
  // "The Upper Room": restrained high-contrast serif caps with wide tracking.
  'editorial-calm': {
    id: 'editorial-calm',
    label: 'Editorial Calm',
    display: {
      family: 'Cormorant Garamond',
      weight: '700',
      letterSpacing: 0.04,
      lineHeight: 1,
      uppercase: true,
      widthFactor: 0.66,
    },
    script: {
      family: 'Parisienne',
      weight: '400',
      letterSpacing: 0,
      lineHeight: 1,
      widthFactor: 0.46,
    },
    eyebrow: {
      family: 'Jost',
      weight: '400',
      letterSpacing: 0.32,
      lineHeight: 1.1,
      uppercase: true,
      widthFactor: 0.62,
    },
    body: {
      family: 'Jost',
      weight: '400',
      letterSpacing: 0.02,
      lineHeight: 1.35,
      widthFactor: 0.54,
    },
    chip: {
      family: 'Jost',
      weight: '400',
      letterSpacing: 0.24,
      lineHeight: 1.1,
      uppercase: true,
      widthFactor: 0.62,
    },
    displayEffect: 'none',
  },
  // Kame "Slow mornings": magazine serif + oversized script overlap.
  'magazine-cover': {
    id: 'magazine-cover',
    label: 'Magazine Cover',
    display: {
      family: 'Playfair Display',
      weight: '400',
      letterSpacing: -0.01,
      lineHeight: 0.95,
      widthFactor: 0.54,
    },
    script: {
      family: 'Sacramento',
      weight: '400',
      letterSpacing: 0,
      lineHeight: 0.9,
      widthFactor: 0.4,
    },
    eyebrow: {
      family: 'Cormorant Garamond',
      weight: '700',
      letterSpacing: 0.02,
      lineHeight: 1.1,
      widthFactor: 0.5,
    },
    body: {
      family: 'Cormorant Garamond',
      weight: '400',
      letterSpacing: 0.01,
      lineHeight: 1.25,
      widthFactor: 0.48,
    },
    chip: {
      family: 'Cormorant Garamond',
      weight: '700',
      letterSpacing: 0.01,
      lineHeight: 1.1,
      widthFactor: 0.5,
    },
    displayEffect: 'soft-shadow',
  },
  // Kame "Game on, stay in": outlined two-tone chunky caps + brush tagline.
  'playful-pop': {
    id: 'playful-pop',
    label: 'Playful Pop',
    display: {
      family: 'Lilita One',
      weight: '400',
      letterSpacing: 0.01,
      lineHeight: 0.98,
      uppercase: true,
      widthFactor: 0.56,
    },
    script: {
      family: 'Kaushan Script',
      weight: '400',
      letterSpacing: 0,
      lineHeight: 1,
      widthFactor: 0.5,
    },
    eyebrow: { ...POPPINS_CHIP, letterSpacing: 0.14 },
    body: POPPINS_BODY,
    chip: POPPINS_CHIP,
    displayEffect: 'outline-shadow',
  },
  'modern-minimal': {
    id: 'modern-minimal',
    label: 'Modern Minimal',
    display: {
      family: 'DM Serif Display',
      weight: '400',
      letterSpacing: 0,
      lineHeight: 1,
      widthFactor: 0.5,
    },
    script: { family: 'Allura', weight: '400', letterSpacing: 0, lineHeight: 1, widthFactor: 0.4 },
    eyebrow: { ...MONTSERRAT_EYEBROW, weight: '400', letterSpacing: 0.26 },
    body: {
      family: 'Montserrat',
      weight: '400',
      letterSpacing: 0.01,
      lineHeight: 1.35,
      widthFactor: 0.6,
    },
    chip: { ...MONTSERRAT_EYEBROW, letterSpacing: 0.16 },
    displayEffect: 'none',
  },
  'sunny-weekend': {
    id: 'sunny-weekend',
    label: 'Sunny Weekend',
    display: {
      family: 'Baloo 2',
      weight: '700',
      letterSpacing: 0,
      lineHeight: 0.95,
      widthFactor: 0.56,
    },
    script: {
      family: 'Great Vibes',
      weight: '400',
      letterSpacing: 0,
      lineHeight: 0.95,
      widthFactor: 0.42,
    },
    eyebrow: { ...POPPINS_CHIP, letterSpacing: 0.18 },
    body: POPPINS_BODY,
    chip: POPPINS_CHIP,
    displayEffect: 'soft-shadow',
  },
};

export function isPosterFontPairingId(value: unknown): value is PosterFontPairingId {
  return (
    typeof value === 'string' && (POSTER_FONT_PAIRING_IDS as readonly string[]).includes(value)
  );
}

/** Every family a poster can reference — handy for preloading before export. */
export function posterFontFamilies(): string[] {
  const families = new Set<string>();
  for (const pairing of Object.values(POSTER_FONT_PAIRINGS)) {
    for (const role of [
      pairing.display,
      pairing.script,
      pairing.eyebrow,
      pairing.body,
      pairing.chip,
    ]) {
      families.add(role.family);
    }
  }
  return [...families];
}
