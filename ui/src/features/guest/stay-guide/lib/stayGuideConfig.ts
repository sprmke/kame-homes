/**
 * Stay Guide page config v2 — mirrors the Property Showcase config engine
 * (palette / typography / motion + a flat, reorderable `sections[]`) but with the
 * Stay Guide's own section set. Keep in sync with the server mirror in
 * `supabase/functions/_shared/publicPageConfigs.ts`.
 *
 * v1 (`StayGuideSectionConfig` in ./api.ts) had per-section `{ visible }` flags plus a
 * `chapters[]` array. `upgradeStayGuideConfigV1toV2` maps every v1 row onto v2.
 */

import {
  defaultPropertyShowcaseConfig,
  normalizeShowcasePaletteMode,
  SHOWCASE_PRESET_PALETTE_IDS,
  type PropertyShowcaseConfig,
  type ShowcasePaletteMode,
  type ShowcaseTextSourceConfig,
} from '@/features/guest/marketing/showcase/types/showcase';

/** Chapter section ids keep their v1 identifiers so accent colors / order carry over. */
export const STAY_GUIDE_CHAPTER_SECTION_IDS = [
  'getting-in',
  'make-yourself-at-home',
  'before-you-go',
] as const;

export type StayGuideChapterSectionId = (typeof STAY_GUIDE_CHAPTER_SECTION_IDS)[number];

/** Full ordered section set — drives the editor list and the default render order. */
export const STAY_GUIDE_SECTION_IDS = [
  'hero',
  'passCard',
  'checkInDocuments',
  'gallery',
  'quickNav',
  'getting-in',
  'make-yourself-at-home',
  'before-you-go',
  'host',
] as const;

export type StayGuideSectionId = (typeof STAY_GUIDE_SECTION_IDS)[number];

/** Hero is always shown (parity with Showcase's locked hero/cta). */
export const STAY_GUIDE_REQUIRED_VISIBLE: ReadonlySet<StayGuideSectionId> = new Set(['hero']);

export function isStayGuideChapterSectionId(id: string): id is StayGuideChapterSectionId {
  return (STAY_GUIDE_CHAPTER_SECTION_IDS as readonly string[]).includes(id);
}

export type StayGuideSectionConfigEntry = {
  id: StayGuideSectionId;
  visible: boolean;
  order: number;
  /** Heading / subheading overrides; body override only used by chapter sections' intro. */
  copy?: { heading?: string; subheading?: string; body?: string };
  /** Hero (single) + gallery (multi) photo slots. */
  imageSlots?: string[];
  /** Hero only — the line above the main heading (location / development / custom). */
  heroEyebrow?: ShowcaseTextSourceConfig;
  /** Chapter sections only — carries the v1 per-chapter accent color. */
  accentColor?: string | null;
};

export type StayGuideConfigV2 = {
  version: 2;
  /** Kept for parity with Showcase; the token render path ignores it. */
  published: boolean;
  palette: PropertyShowcaseConfig['palette'];
  typography: PropertyShowcaseConfig['typography'];
  motion: PropertyShowcaseConfig['motion'];
  sections: StayGuideSectionConfigEntry[];
};

const PALETTE_MODES = new Set<ShowcasePaletteMode>([
  'default',
  'brand',
  'media',
  'custom',
  ...SHOWCASE_PRESET_PALETTE_IDS,
]);

export function defaultStayGuideConfigV2(): StayGuideConfigV2 {
  const showcaseDefaults = defaultPropertyShowcaseConfig();
  return {
    version: 2,
    published: true,
    palette: showcaseDefaults.palette,
    typography: showcaseDefaults.typography,
    motion: showcaseDefaults.motion,
    sections: STAY_GUIDE_SECTION_IDS.map((id, order) => ({
      id,
      visible: true,
      order,
      accentColor: isStayGuideChapterSectionId(id) ? null : undefined,
    })),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readVisible(value: unknown, fallback: boolean): boolean {
  if (!isRecord(value) || typeof value.visible !== 'boolean') return fallback;
  return value.visible;
}

function normalizeAccentColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeTextSource(value: unknown): ShowcaseTextSourceConfig | undefined {
  if (!isRecord(value)) return undefined;
  const source = value.source;
  if (source !== 'location' && source !== 'development' && source !== 'custom') return undefined;
  const customText = typeof value.customText === 'string' ? value.customText : undefined;
  return source === 'custom' ? { source, customText } : { source };
}

function normalizeCopy(
  value: unknown
): { heading?: string; subheading?: string; body?: string } | undefined {
  if (!isRecord(value)) return undefined;
  const pick = (key: string) => {
    const raw = value[key];
    if (typeof raw !== 'string') return undefined;
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  };
  const heading = pick('heading');
  const subheading = pick('subheading');
  const body = pick('body');
  if (!heading && !subheading && !body) return undefined;
  return { heading, subheading, body };
}

function normalizeImageSlots(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const urls = value.filter(
    (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0
  );
  return urls.length > 0 ? urls.slice(0, 24) : undefined;
}

function isV1(raw: Record<string, unknown>): boolean {
  return raw.version === 1 || Array.isArray(raw.chapters);
}

/** Map a v1 Stay Guide config onto the v2 shape (visibility, order, chapter accents). */
export function upgradeStayGuideConfigV1toV2(raw: Record<string, unknown>): StayGuideConfigV2 {
  const base = defaultStayGuideConfigV2();

  const chapterOrder = new Map<StayGuideChapterSectionId, number>();
  const chapterVisible = new Map<StayGuideChapterSectionId, boolean>();
  const chapterAccent = new Map<StayGuideChapterSectionId, string | null>();
  if (Array.isArray(raw.chapters)) {
    raw.chapters.forEach((entry, index) => {
      if (!isRecord(entry)) return;
      const id = entry.id;
      if (typeof id !== 'string' || !isStayGuideChapterSectionId(id)) return;
      chapterOrder.set(
        id,
        typeof entry.order === 'number' && Number.isFinite(entry.order) ? entry.order : index
      );
      chapterVisible.set(id, typeof entry.visible === 'boolean' ? entry.visible : true);
      chapterAccent.set(id, normalizeAccentColor(entry.accentColor));
    });
  }

  const v1VisibleById: Record<Exclude<StayGuideSectionId, StayGuideChapterSectionId>, boolean> = {
    hero: readVisible(raw.hero, true),
    passCard: readVisible(raw.stayPassCard, true),
    checkInDocuments: readVisible(raw.checkInDocuments, true),
    gallery: readVisible(raw.galleryCarousel, true),
    quickNav: readVisible(raw.quickNavTabs, true),
    host: readVisible(raw.helpSection, true),
  };

  // Chapters keep their contiguous default band (indices 5–7) but reorder within it.
  const sortedChapters = [...STAY_GUIDE_CHAPTER_SECTION_IDS].sort(
    (a, b) =>
      (chapterOrder.get(a) ?? STAY_GUIDE_CHAPTER_SECTION_IDS.indexOf(a)) -
      (chapterOrder.get(b) ?? STAY_GUIDE_CHAPTER_SECTION_IDS.indexOf(b))
  );

  const orderedIds: StayGuideSectionId[] = STAY_GUIDE_SECTION_IDS.map((id) => id);
  const firstChapterSlot = orderedIds.indexOf('getting-in');
  sortedChapters.forEach((id, index) => {
    orderedIds[firstChapterSlot + index] = id;
  });

  return {
    ...base,
    sections: orderedIds.map((id, order) => {
      if (isStayGuideChapterSectionId(id)) {
        return {
          id,
          visible: chapterVisible.get(id) ?? true,
          order,
          accentColor: chapterAccent.get(id) ?? null,
        };
      }
      return {
        id,
        visible: v1VisibleById[id],
        order,
      };
    }),
  };
}

/** Accepts a v1 or v2 raw config (or nothing) and returns a clean v2 config. */
export function normalizeStayGuideConfigV2(raw: unknown): StayGuideConfigV2 {
  const base = defaultStayGuideConfigV2();
  if (!isRecord(raw)) return base;
  if (isV1(raw)) return upgradeStayGuideConfigV1toV2(raw);

  const paletteRaw = isRecord(raw.palette) ? raw.palette : {};
  const typographyRaw = isRecord(raw.typography) ? raw.typography : {};
  const motionRaw = isRecord(raw.motion) ? raw.motion : {};

  const palette: PropertyShowcaseConfig['palette'] = {
    mode: PALETTE_MODES.has(paletteRaw.mode as ShowcasePaletteMode)
      ? (paletteRaw.mode as ShowcasePaletteMode)
      : normalizeShowcasePaletteMode(paletteRaw.mode),
    accent: paletteRaw.accent === 'custom' ? 'custom' : 'brand',
    customAccent: typeof paletteRaw.customAccent === 'string' ? paletteRaw.customAccent : null,
    customPaletteBase:
      typeof paletteRaw.customPaletteBase === 'string' ? paletteRaw.customPaletteBase : null,
    overlay:
      paletteRaw.overlay === 'none' || paletteRaw.overlay === 'strong'
        ? paletteRaw.overlay
        : 'soft',
  };

  const displayFont = typographyRaw.displayFont;
  const typography: PropertyShowcaseConfig['typography'] = {
    displayFont:
      displayFont === 'jakarta' ||
      displayFont === 'outfit' ||
      displayFont === 'instrument' ||
      displayFont === 'cormorant' ||
      displayFont === 'fraunces'
        ? displayFont
        : base.typography.displayFont,
    scale:
      typographyRaw.scale === 'sm' || typographyRaw.scale === 'lg' ? typographyRaw.scale : 'md',
  };

  const motion: PropertyShowcaseConfig['motion'] = {
    intensity:
      motionRaw.intensity === 'subtle' || motionRaw.intensity === 'bold'
        ? motionRaw.intensity
        : 'standard',
    parallax: typeof motionRaw.parallax === 'boolean' ? motionRaw.parallax : true,
    canvas: typeof motionRaw.canvas === 'boolean' ? motionRaw.canvas : true,
  };

  const byId = new Map<StayGuideSectionId, StayGuideSectionConfigEntry>();
  for (const entry of base.sections) byId.set(entry.id, { ...entry });

  if (Array.isArray(raw.sections)) {
    raw.sections.forEach((entry, index) => {
      if (!isRecord(entry)) return;
      const id = entry.id;
      if (typeof id !== 'string' || !(STAY_GUIDE_SECTION_IDS as readonly string[]).includes(id)) {
        return;
      }
      const sectionId = id as StayGuideSectionId;
      const existing = byId.get(sectionId)!;
      byId.set(sectionId, {
        id: sectionId,
        visible: STAY_GUIDE_REQUIRED_VISIBLE.has(sectionId)
          ? true
          : typeof entry.visible === 'boolean'
            ? entry.visible
            : existing.visible,
        order:
          typeof entry.order === 'number' && Number.isFinite(entry.order)
            ? entry.order
            : (existing.order ?? index),
        copy: normalizeCopy(entry.copy),
        imageSlots:
          sectionId === 'hero' || sectionId === 'gallery'
            ? normalizeImageSlots(entry.imageSlots)
            : undefined,
        heroEyebrow: sectionId === 'hero' ? normalizeTextSource(entry.heroEyebrow) : undefined,
        accentColor: isStayGuideChapterSectionId(sectionId)
          ? normalizeAccentColor(entry.accentColor)
          : undefined,
      });
    });
  }

  const sections = [...byId.values()].sort((a, b) => a.order - b.order);
  sections.forEach((section, order) => {
    section.order = order;
  });

  return {
    version: 2,
    published: typeof raw.published === 'boolean' ? raw.published : true,
    palette,
    typography,
    motion,
    sections,
  };
}

/** Editor always persists published Stay Guide configs (no draft toggle), mirroring Showcase. */
export function stayGuideConfigForSave(config: StayGuideConfigV2): StayGuideConfigV2 {
  return { ...config, published: true };
}
