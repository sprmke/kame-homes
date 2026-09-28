import { normalizePosterHex } from '@/features/dashboard/marketing/lib/poster/posterColor';
import {
  isPosterFontPairingId,
  type PosterFontPairingId,
} from '@/features/dashboard/marketing/lib/poster/posterFonts';
import {
  isPosterIconName,
  resolvePosterIcon,
  type PosterIconName,
} from '@/features/dashboard/marketing/lib/poster/posterIcons';

/**
 * PosterSpec: the contract between the AI art director and the deterministic
 * poster compiler. The director picks an archetype, a font pairing, a palette and
 * short copy; the compiler owns every coordinate. Mirrored (validation only) in
 * supabase/functions/_shared/marketingPosterDirector.ts — keep enums in sync.
 */

export const POSTER_ARCHETYPE_IDS = [
  'wave-duo',
  'sky-headline',
  'night-glass',
  'minimal-title',
  'magazine-cover',
  'feature-sticker',
] as const;

export type PosterArchetypeId = (typeof POSTER_ARCHETYPE_IDS)[number];

export const POSTER_GOALS = [
  'vibe',
  'promo',
  'amenity-spotlight',
  'feature-spotlight',
  'stay-info',
] as const;

export type PosterGoal = (typeof POSTER_GOALS)[number];

/** Real, stored property facts. Every fact-derived string on a poster comes from here. */
export type PosterFacts = {
  propertyName: string;
  brandName: string | null;
  /** e.g. "Azure North, Pampanga". */
  location: string | null;
  checkIn: string | null;
  checkOut: string | null;
  /** Formatted, e.g. "₱2,000". */
  securityDeposit: string | null;
  nightlyRate: string | null;
  amenities: string[];
  logoUrl: string | null;
  photos: string[];
};

export type PosterCopy = {
  /** Tracked caps line above the headline. */
  eyebrow: string;
  /** Display line, the hero words. */
  headline: string;
  /** Script accent, the signature flourish. */
  accent: string;
  /** One supporting sentence. */
  subhead: string;
  /** Up to 3 one or two word chips ("Coffee", "View", "You time"). */
  chips: string[];
  /** Short closing line ("Unwind. Recharge. Just like home."). */
  tagline: string;
  cta: string;
  /** Sticker badge copy (feature spotlight). */
  badge: string;
  /** Heading over the icon card ("Perfect for"). */
  listTitle: string;
};

export type PosterFeature = { label: string; icon: PosterIconName };

export type PosterSpec = {
  version: 1;
  archetype: PosterArchetypeId;
  fontPairing: PosterFontPairingId;
  goal: PosterGoal;
  palette: { accent: string | null; secondary: string | null; field: string | null };
  copy: PosterCopy;
  features: PosterFeature[];
  include: { infoBar: boolean; location: boolean; logo: boolean };
  /** Indexes into `facts.photos`, hero first. */
  photoIndexes: number[];
  label: string;
};

/** Per-slot word caps. Tuned so every archetype can hold the copy at a legible size. */
const COPY_LIMITS: Record<keyof Omit<PosterCopy, 'chips'>, { words: number; chars: number }> = {
  eyebrow: { words: 5, chars: 32 },
  headline: { words: 5, chars: 34 },
  accent: { words: 4, chars: 30 },
  subhead: { words: 18, chars: 120 },
  tagline: { words: 8, chars: 48 },
  cta: { words: 4, chars: 24 },
  badge: { words: 6, chars: 36 },
  listTitle: { words: 3, chars: 20 },
};

const CHIP_LIMIT = { words: 2, chars: 16 };
export const POSTER_MAX_FEATURES = 7;

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

/**
 * Human-copy rules applied to every model string: no em/en dashes, no wrapping
 * quotes. Length is a budget, not a guillotine: a truncated phrase ("Take a
 * staycation with") reads like a typo, so copy up to 1.5x the budget is kept whole
 * (the fitter sizes it down) and anything longer is dropped from the slot. When the
 * over-long copy has a clean sentence break inside the budget, that first sentence
 * is kept instead.
 */
export function cleanPosterCopy(value: unknown, limit: { words: number; chars: number }): string {
  if (typeof value !== 'string') return '';
  const text = value
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/^["'“‘\s]+|["'”’\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[,;:\s]+$/, '');
  const fits = (candidate: string, slack: number) =>
    candidate.split(' ').filter(Boolean).length <= Math.floor(limit.words * slack) &&
    candidate.length <= Math.floor(limit.chars * slack);
  if (fits(text, 1.5)) return text;
  const firstSentence = /^(.+?[.!?])\s/.exec(`${text} `)?.[1]?.trim();
  if (firstSentence && firstSentence !== text && fits(firstSentence, 1)) return firstSentence;
  return '';
}

/**
 * Display form of a listing name for headlines: the part before a location or
 * separator ("The Upper Room at Azure North Suites" → "The Upper Room",
 * "Charming 3BR Home in Makati" → "Charming 3BR Home"). Still a fact, just shorter.
 */
export function posterShortName(name: string): string {
  const trimmed = name.replace(/\s+/g, ' ').trim();
  const head = trimmed.split(/\s+(?:at|in|@)\s+|\s*[|•·–—-]\s+|,\s*/i)[0]?.trim() ?? '';
  return head.length >= 3 ? head : trimmed;
}

function normalizeCopy(raw: unknown): PosterCopy {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const chips = Array.isArray(source.chips)
    ? source.chips
        .map((chip) => cleanPosterCopy(chip, CHIP_LIMIT))
        .filter(Boolean)
        .slice(0, 3)
    : [];
  const copy = { chips } as PosterCopy;
  for (const key of Object.keys(COPY_LIMITS) as Array<keyof typeof COPY_LIMITS>) {
    copy[key] = cleanPosterCopy(source[key], COPY_LIMITS[key]);
  }
  return copy;
}

function normalizeFeatures(raw: unknown, facts: PosterFacts): PosterFeature[] {
  const fromModel = Array.isArray(raw)
    ? raw.flatMap((item) => {
        const entry = (item && typeof item === 'object' ? item : { label: item }) as {
          label?: unknown;
          icon?: unknown;
        };
        const label = cleanPosterCopy(entry.label, { words: 3, chars: 22 });
        if (!label) return [];
        const icon = isPosterIconName(entry.icon) ? entry.icon : resolvePosterIcon(label);
        return [{ label, icon }];
      })
    : [];
  const features =
    fromModel.length > 0
      ? fromModel
      : facts.amenities.map((label) => ({
          label: cleanPosterCopy(label, { words: 3, chars: 22 }),
          icon: resolvePosterIcon(label),
        }));
  const seen = new Set<string>();
  return features
    .filter((feature) => {
      const key = feature.label.toLowerCase();
      if (!feature.label || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, POSTER_MAX_FEATURES);
}

function normalizePhotoIndexes(raw: unknown, photoCount: number): number[] {
  const indexes = Array.isArray(raw)
    ? raw.filter(
        (value): value is number => Number.isInteger(value) && value >= 0 && value < photoCount
      )
    : [];
  const unique = [...new Set(indexes)];
  if (unique.length > 0) return unique.slice(0, 3);
  return photoCount > 0 ? [0, ...(photoCount > 1 ? [1] : [])] : [];
}

/**
 * Coerces untrusted director output into a spec the compiler can always render.
 * Fact-backed modules are switched off when the fact is missing, so a poster never
 * shows an empty "Security deposit" cell or a blank location pill.
 */
export function normalizePosterSpec(input: unknown, facts: PosterFacts): PosterSpec {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const include = (raw.include && typeof raw.include === 'object' ? raw.include : {}) as Record<
    string,
    unknown
  >;
  const palette = (raw.palette && typeof raw.palette === 'object' ? raw.palette : {}) as Record<
    string,
    unknown
  >;
  const copy = normalizeCopy(raw.copy);
  // The property name is a fact: never clipped, and the headline is never empty.
  if (!copy.headline) copy.headline = posterShortName(facts.propertyName);

  return {
    version: 1,
    archetype: isOneOf(raw.archetype, POSTER_ARCHETYPE_IDS) ? raw.archetype : 'sky-headline',
    fontPairing: isPosterFontPairingId(raw.fontPairing) ? raw.fontPairing : 'tropical-script',
    goal: isOneOf(raw.goal, POSTER_GOALS) ? raw.goal : 'vibe',
    palette: {
      accent: normalizePosterHex(palette.accent),
      secondary: normalizePosterHex(palette.secondary),
      field: normalizePosterHex(palette.field),
    },
    copy,
    features: normalizeFeatures(raw.features, facts),
    include: {
      infoBar: include.infoBar !== false && Boolean(facts.checkIn || facts.checkOut),
      location: include.location !== false && Boolean(facts.location),
      logo: include.logo !== false && Boolean(facts.logoUrl),
    },
    photoIndexes: normalizePhotoIndexes(raw.photoIndexes, facts.photos.length),
    label: cleanPosterCopy(raw.label, { words: 6, chars: 40 }) || copy.headline,
  };
}
