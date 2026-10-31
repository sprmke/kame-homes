/**
 * Public page section configs — visibility, order, light style overrides.
 * Host paths lazily create rows; guest render paths read-only with in-memory defaults.
 */

import { createClient } from './supabaseJs.ts';

import {
  BRAND_COLOR_PRESET_IDS,
  normalizeShowcaseCuratedPaletteId,
  type BrandColorPresetId,
} from './brandColorPresets.ts';

export type PublicPageType = 'stay_guide' | 'property_landing' | 'property_showcase';

export type StayGuideChapterId = 'getting-in' | 'make-yourself-at-home' | 'before-you-go';

export type StayGuideChapterConfig = {
  id: StayGuideChapterId;
  visible: boolean;
  order: number;
  /** null = inherit brand color */
  accentColor: string | null;
};

/** Legacy v1 Stay Guide config — read-tolerated + upgraded to v2 on normalize. */
export type StayGuideConfigV1 = {
  version: 1;
  hero: { visible: boolean };
  stayPassCard: { visible: boolean };
  checkInDocuments: { visible: boolean };
  galleryCarousel: { visible: boolean };
  quickNavTabs: { visible: boolean };
  chapters: StayGuideChapterConfig[];
  helpSection: { visible: boolean };
};

/** Chapter section ids keep their v1 identifiers so accent colors / order carry over. */
export const STAY_GUIDE_CHAPTER_SECTION_IDS = [
  'getting-in',
  'make-yourself-at-home',
  'before-you-go',
] as const;
export type StayGuideChapterSectionId = (typeof STAY_GUIDE_CHAPTER_SECTION_IDS)[number];

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

const STAY_GUIDE_REQUIRED_VISIBLE: ReadonlySet<StayGuideSectionId> = new Set(['hero']);

function isStayGuideChapterSectionId(id: string): id is StayGuideChapterSectionId {
  return (STAY_GUIDE_CHAPTER_SECTION_IDS as readonly string[]).includes(id);
}

export type StayGuideTextSource = {
  source: 'location' | 'development' | 'custom';
  customText?: string;
};

export type StayGuideSectionConfigEntry = {
  id: StayGuideSectionId;
  visible: boolean;
  order: number;
  copy?: { heading?: string; subheading?: string; body?: string };
  imageSlots?: string[];
  heroEyebrow?: StayGuideTextSource;
  accentColor?: string | null;
};

/** v2 — mirrors PropertyShowcaseConfig's palette/typography/motion + a flat sections[]. */
export type StayGuideConfigV2 = {
  version: 2;
  published: boolean;
  palette: PropertyShowcaseConfig['palette'];
  typography: PropertyShowcaseConfig['typography'];
  motion: PropertyShowcaseConfig['motion'];
  sections: StayGuideSectionConfigEntry[];
};

/** Current Stay Guide config shape. */
export type StayGuideConfig = StayGuideConfigV2;

export type PropertyLandingSectionId =
  'gallery' | 'overview' | 'amenities' | 'location' | 'rules' | 'reviews';

export type PropertyLandingSectionConfig = {
  id: PropertyLandingSectionId;
  visible: boolean;
  order: number;
};

export type PropertyLandingConfig = {
  version: 1;
  sections: PropertyLandingSectionConfig[];
};

export type PropertyShowcaseSectionId =
  | 'hero'
  | 'gallery'
  | 'about'
  | 'amenities'
  | 'location'
  | 'testimonials'
  | 'highlights'
  | 'host'
  | 'cta';

export type PropertyShowcaseSectionConfig = {
  id: PropertyShowcaseSectionId;
  visible: boolean;
  order: number;
  columns?: number;
  copy?: { heading?: string; subheading?: string; body?: string };
  imageSlots?: string[];
  ctaLabel?: string;
  ctaTarget?: string;
  heroEyebrow?: {
    source: 'location' | 'development' | 'custom';
    customText?: string;
  };
  locationLead?: {
    source: 'location' | 'development' | 'custom';
    customText?: string;
  };
};

export type PropertyShowcaseConfig = {
  version: 1;
  published: boolean;
  palette: {
    mode: 'default' | 'brand' | 'media' | 'custom' | BrandColorPresetId;
    accent: 'brand' | 'custom';
    customAccent: string | null;
    customPaletteBase: string | null;
    overlay: 'none' | 'soft' | 'strong';
  };
  typography: {
    displayFont: 'jakarta' | 'outfit' | 'instrument' | 'cormorant' | 'fraunces';
    scale: 'sm' | 'md' | 'lg';
  };
  motion: {
    intensity: 'subtle' | 'standard' | 'bold';
    parallax: boolean;
    canvas: boolean;
  };
  sections: PropertyShowcaseSectionConfig[];
};

export type PublicPageConfig = StayGuideConfig | PropertyLandingConfig | PropertyShowcaseConfig;

export type PublicPageConfigRow = {
  id: string;
  propertyId: string;
  pageType: PublicPageType;
  config: PublicPageConfig;
  createdAt: string;
  updatedAt: string;
};

const PROPERTY_LANDING_SECTION_IDS: PropertyLandingSectionId[] = [
  'gallery',
  'overview',
  'amenities',
  'location',
  'rules',
  'reviews',
];

const PROPERTY_SHOWCASE_SECTION_IDS: PropertyShowcaseSectionId[] = [
  'hero',
  'gallery',
  'about',
  'amenities',
  'highlights',
  'location',
  'testimonials',
  'host',
  'cta',
];

const SHOWCASE_REQUIRED_VISIBLE: ReadonlySet<PropertyShowcaseSectionId> = new Set(['hero', 'cta']);

function supabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
}

export function defaultStayGuideConfig(): StayGuideConfig {
  const showcase = defaultPropertyShowcaseConfig();
  return {
    version: 2,
    published: true,
    palette: showcase.palette,
    typography: showcase.typography,
    motion: showcase.motion,
    sections: STAY_GUIDE_SECTION_IDS.map((id, order) => ({
      id,
      visible: true,
      order,
      accentColor: isStayGuideChapterSectionId(id) ? null : undefined,
    })),
  };
}

export function defaultPropertyLandingConfig(): PropertyLandingConfig {
  return {
    version: 1,
    sections: PROPERTY_LANDING_SECTION_IDS.map((id, order) => ({
      id,
      visible: true,
      order,
    })),
  };
}

export function defaultPropertyShowcaseConfig(): PropertyShowcaseConfig {
  return {
    version: 1,
    published: true,
    palette: {
      mode: 'default',
      accent: 'brand',
      customAccent: null,
      customPaletteBase: null,
      overlay: 'soft',
    },
    typography: {
      displayFont: 'jakarta',
      scale: 'md',
    },
    motion: {
      intensity: 'standard',
      parallax: true,
      canvas: true,
    },
    sections: PROPERTY_SHOWCASE_SECTION_IDS.map((id, order) => ({
      id,
      visible: true,
      order,
    })),
  };
}

function defaultConfigFor(pageType: PublicPageType): PublicPageConfig {
  if (pageType === 'stay_guide') return defaultStayGuideConfig();
  if (pageType === 'property_landing') return defaultPropertyLandingConfig();
  return defaultPropertyShowcaseConfig();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readVisibleFlag(value: unknown, fallback: boolean): boolean {
  if (!isRecord(value) || typeof value.visible !== 'boolean') return fallback;
  return value.visible;
}

function normalizeAccentColor(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function stayGuideConfigIsV1(raw: Record<string, unknown>): boolean {
  return raw.version === 1 || Array.isArray(raw.chapters);
}

function normalizeStayGuideCopy(
  raw: unknown
): { heading?: string; subheading?: string; body?: string } | undefined {
  if (!isRecord(raw)) return undefined;
  const heading = readOptionalString(raw.heading, 120);
  const subheading = readOptionalString(raw.subheading, 200);
  const body = readOptionalString(raw.body, 4000);
  if (!heading && !subheading && !body) return undefined;
  return { heading, subheading, body };
}

function normalizeStayGuideImageSlots(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const slots = raw
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 24);
  return slots.length > 0 ? slots : undefined;
}

function normalizeStayGuideTextSource(raw: unknown): StayGuideTextSource | undefined {
  if (!isRecord(raw)) return undefined;
  const source = raw.source;
  if (source !== 'location' && source !== 'development' && source !== 'custom') return undefined;
  const customText = readOptionalString(raw.customText, 120);
  if (source === 'custom') return { source: 'custom', customText };
  if (source === 'development') return { source: 'development' };
  return { source: 'location' };
}

/** Map a legacy v1 Stay Guide config onto the v2 shape (visibility, order, chapter accents). */
export function upgradeStayGuideConfigV1toV2(raw: Record<string, unknown>): StayGuideConfigV2 {
  const base = defaultStayGuideConfig();

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

  const nonChapterVisible: Record<
    Exclude<StayGuideSectionId, StayGuideChapterSectionId>,
    boolean
  > = {
    hero: readVisibleFlag(raw.hero, true),
    passCard: readVisibleFlag(raw.stayPassCard, true),
    checkInDocuments: readVisibleFlag(raw.checkInDocuments, true),
    gallery: readVisibleFlag(raw.galleryCarousel, true),
    quickNav: readVisibleFlag(raw.quickNavTabs, true),
    host: readVisibleFlag(raw.helpSection, true),
  };

  const sortedChapters = [...STAY_GUIDE_CHAPTER_SECTION_IDS].sort(
    (a, b) =>
      (chapterOrder.get(a) ?? STAY_GUIDE_CHAPTER_SECTION_IDS.indexOf(a)) -
      (chapterOrder.get(b) ?? STAY_GUIDE_CHAPTER_SECTION_IDS.indexOf(b))
  );

  const orderedIds: StayGuideSectionId[] = [...STAY_GUIDE_SECTION_IDS];
  const firstChapterSlot = orderedIds.indexOf('getting-in');
  sortedChapters.forEach((id, index) => {
    orderedIds[firstChapterSlot + index] = id;
  });

  return {
    ...base,
    sections: orderedIds.map((id, order) =>
      isStayGuideChapterSectionId(id)
        ? {
            id,
            visible: chapterVisible.get(id) ?? true,
            order,
            accentColor: chapterAccent.get(id) ?? null,
          }
        : {
            id,
            visible: nonChapterVisible[id],
            order,
          }
    ),
  };
}

export function normalizeStayGuideConfig(raw: unknown): StayGuideConfig {
  const base = defaultStayGuideConfig();
  if (!isRecord(raw)) return base;
  if (stayGuideConfigIsV1(raw)) return upgradeStayGuideConfigV1toV2(raw);

  const showcaseShaped = normalizePropertyShowcaseConfig({
    version: 1,
    published: raw.published,
    palette: raw.palette,
    typography: raw.typography,
    motion: raw.motion,
    sections: [],
  });

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
        copy: normalizeStayGuideCopy(entry.copy),
        imageSlots:
          sectionId === 'hero' || sectionId === 'gallery'
            ? normalizeStayGuideImageSlots(entry.imageSlots)
            : undefined,
        heroEyebrow:
          sectionId === 'hero' ? normalizeStayGuideTextSource(entry.heroEyebrow) : undefined,
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
    palette: showcaseShaped.palette,
    typography: showcaseShaped.typography,
    motion: showcaseShaped.motion,
    sections,
  };
}

export function normalizePropertyLandingConfig(raw: unknown): PropertyLandingConfig {
  const base = defaultPropertyLandingConfig();
  if (!isRecord(raw)) return base;

  const sectionById = new Map<PropertyLandingSectionId, PropertyLandingSectionConfig>();
  for (const section of base.sections) {
    sectionById.set(section.id, { ...section });
  }

  if (Array.isArray(raw.sections)) {
    for (const entry of raw.sections) {
      if (!isRecord(entry)) continue;
      const id = entry.id;
      if (
        id !== 'gallery' &&
        id !== 'overview' &&
        id !== 'amenities' &&
        id !== 'location' &&
        id !== 'rules' &&
        id !== 'reviews'
      ) {
        continue;
      }
      const existing = sectionById.get(id)!;
      const isMandatory = id === 'gallery' || id === 'overview';
      sectionById.set(id, {
        id,
        visible: isMandatory
          ? true
          : typeof entry.visible === 'boolean'
            ? entry.visible
            : existing.visible,
        // Order is product-fixed; ignore host-saved order.
        order: existing.order,
      });
    }
  }

  const sections = PROPERTY_LANDING_SECTION_IDS.map((id, order) => {
    const section = sectionById.get(id)!;
    return {
      ...section,
      visible: id === 'gallery' || id === 'overview' ? true : section.visible,
      order,
    };
  });

  return { version: 1, sections };
}

function readOptionalString(value: unknown, maxLen = 500): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLen);
}

function normalizeShowcaseCopy(raw: unknown): PropertyShowcaseSectionConfig['copy'] | undefined {
  if (!isRecord(raw)) return undefined;
  const heading = readOptionalString(raw.heading, 120);
  const subheading = readOptionalString(raw.subheading, 200);
  const body = readOptionalString(raw.body, 2000);
  if (!heading && !subheading && !body) return undefined;
  return { heading, subheading, body };
}

function normalizeShowcaseImageSlots(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const slots = raw
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 12);
  return slots.length > 0 ? slots : undefined;
}

function normalizeShowcaseHeroEyebrow(
  raw: unknown
): PropertyShowcaseSectionConfig['heroEyebrow'] | undefined {
  if (!isRecord(raw)) return undefined;
  const source = raw.source;
  if (source !== 'location' && source !== 'development' && source !== 'custom') return undefined;
  const customText = readOptionalString(raw.customText, 120);
  if (source === 'location') {
    return customText ? { source: 'location', customText } : { source: 'location' };
  }
  if (source === 'custom') return { source: 'custom', customText };
  if (source === 'development') return { source: 'development' };
  return { source: 'location' };
}

const normalizeShowcaseLocationLead = normalizeShowcaseHeroEyebrow;

export function normalizePropertyShowcaseConfig(raw: unknown): PropertyShowcaseConfig {
  const base = defaultPropertyShowcaseConfig();
  if (!isRecord(raw)) return base;

  const sectionById = new Map<PropertyShowcaseSectionId, PropertyShowcaseSectionConfig>();
  for (const section of base.sections) {
    sectionById.set(section.id, { ...section });
  }

  if (Array.isArray(raw.sections)) {
    for (const entry of raw.sections) {
      if (!isRecord(entry)) continue;
      const rawId = entry.id;
      const id = rawId === 'houseRules' ? 'host' : rawId;
      if (
        typeof id !== 'string' ||
        !PROPERTY_SHOWCASE_SECTION_IDS.includes(id as PropertyShowcaseSectionId)
      ) {
        continue;
      }
      const sectionId = id as PropertyShowcaseSectionId;
      const existing = sectionById.get(sectionId)!;
      const columns =
        typeof entry.columns === 'number' && Number.isFinite(entry.columns)
          ? Math.min(4, Math.max(1, Math.round(entry.columns)))
          : existing.columns;
      sectionById.set(sectionId, {
        id: sectionId,
        visible: typeof entry.visible === 'boolean' ? entry.visible : existing.visible,
        order:
          typeof entry.order === 'number' && Number.isFinite(entry.order)
            ? entry.order
            : existing.order,
        columns,
        copy: normalizeShowcaseCopy(entry.copy) ?? existing.copy,
        imageSlots: normalizeShowcaseImageSlots(entry.imageSlots) ?? existing.imageSlots,
        ctaLabel: readOptionalString(entry.ctaLabel, 60) ?? existing.ctaLabel,
        ctaTarget: readOptionalString(entry.ctaTarget, 200) ?? existing.ctaTarget,
        heroEyebrow:
          sectionId === 'hero'
            ? (normalizeShowcaseHeroEyebrow(entry.heroEyebrow) ?? existing.heroEyebrow)
            : undefined,
        locationLead:
          sectionId === 'location'
            ? (normalizeShowcaseLocationLead(entry.locationLead) ?? existing.locationLead)
            : undefined,
      });
    }
  }

  const ordered = [...sectionById.values()].sort(
    (a, b) =>
      a.order - b.order ||
      PROPERTY_SHOWCASE_SECTION_IDS.indexOf(a.id) - PROPERTY_SHOWCASE_SECTION_IDS.indexOf(b.id)
  );
  ordered.forEach((section, index) => {
    section.order = index;
    if (SHOWCASE_REQUIRED_VISIBLE.has(section.id)) {
      section.visible = true;
    }
  });

  const paletteRaw = isRecord(raw.palette) ? raw.palette : {};
  const typographyRaw = isRecord(raw.typography) ? raw.typography : {};
  const motionRaw = isRecord(raw.motion) ? raw.motion : {};

  const presetModes = new Set<string>([
    ...BRAND_COLOR_PRESET_IDS,
    'warm',
    'ocean',
    'blush',
    'forest',
    'slate',
    'dusk',
  ]);

  let mode: PropertyShowcaseConfig['palette']['mode'] = base.palette.mode;
  if (
    paletteRaw.mode === 'default' ||
    paletteRaw.mode === 'brand' ||
    paletteRaw.mode === 'media' ||
    paletteRaw.mode === 'custom'
  ) {
    mode = paletteRaw.mode;
  } else if (paletteRaw.mode === 'light' || paletteRaw.mode === 'dark') {
    mode = 'default';
  } else if (presetModes.has(String(paletteRaw.mode))) {
    mode = normalizeShowcaseCuratedPaletteId(paletteRaw.mode) ?? base.palette.mode;
  }
  const accent =
    paletteRaw.accent === 'custom' || paletteRaw.accent === 'brand'
      ? paletteRaw.accent
      : base.palette.accent;
  const overlay =
    paletteRaw.overlay === 'none' ||
    paletteRaw.overlay === 'soft' ||
    paletteRaw.overlay === 'strong'
      ? paletteRaw.overlay
      : base.palette.overlay;

  const displayFont =
    typographyRaw.displayFont === 'outfit' ||
    typographyRaw.displayFont === 'instrument' ||
    typographyRaw.displayFont === 'cormorant' ||
    typographyRaw.displayFont === 'fraunces' ||
    typographyRaw.displayFont === 'jakarta'
      ? typographyRaw.displayFont
      : base.typography.displayFont;
  const scale =
    typographyRaw.scale === 'sm' || typographyRaw.scale === 'md' || typographyRaw.scale === 'lg'
      ? typographyRaw.scale
      : base.typography.scale;

  const intensity =
    motionRaw.intensity === 'subtle' ||
    motionRaw.intensity === 'standard' ||
    motionRaw.intensity === 'bold'
      ? motionRaw.intensity
      : base.motion.intensity;

  return {
    version: 1,
    published: typeof raw.published === 'boolean' ? raw.published : base.published,
    palette: {
      mode,
      accent,
      customAccent: normalizeAccentColor(paletteRaw.customAccent),
      customPaletteBase: normalizeAccentColor(paletteRaw.customPaletteBase),
      overlay,
    },
    typography: { displayFont, scale },
    motion: {
      intensity,
      parallax: typeof motionRaw.parallax === 'boolean' ? motionRaw.parallax : base.motion.parallax,
      canvas: typeof motionRaw.canvas === 'boolean' ? motionRaw.canvas : base.motion.canvas,
    },
    sections: ordered,
  };
}

export function normalizePublicPageConfig(
  pageType: PublicPageType,
  raw: unknown
): PublicPageConfig {
  if (pageType === 'stay_guide') return normalizeStayGuideConfig(raw);
  if (pageType === 'property_landing') return normalizePropertyLandingConfig(raw);
  return normalizePropertyShowcaseConfig(raw);
}

export function parsePublicPageType(value: unknown): PublicPageType | null {
  if (value === 'stay_guide' || value === 'property_landing' || value === 'property_showcase') {
    return value;
  }
  return null;
}

function toRow(
  row: {
    id: string;
    property_id: string;
    page_type: string;
    config: unknown;
    created_at: string;
    updated_at: string;
  },
  pageType: PublicPageType
): PublicPageConfigRow {
  return {
    id: row.id,
    propertyId: row.property_id,
    pageType,
    config: normalizePublicPageConfig(pageType, row.config),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Guest/public read path — never inserts. Missing row → in-memory defaults. */
export async function getPublicPageConfigOrDefault(
  propertyId: string,
  pageType: PublicPageType
): Promise<PublicPageConfig> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('public_page_configs')
    .select('config')
    .eq('property_id', propertyId)
    .eq('page_type', pageType)
    .maybeSingle();

  if (error) {
    console.error('[publicPageConfigs] getPublicPageConfigOrDefault:', error);
    return defaultConfigFor(pageType);
  }

  if (!data) return defaultConfigFor(pageType);
  return normalizePublicPageConfig(pageType, data.config);
}

/** Host path — create with defaults on first read. */
export async function getOrCreatePublicPageConfig(
  propertyId: string,
  pageType: PublicPageType
): Promise<PublicPageConfigRow> {
  const supabase = supabaseAdmin();

  const { data: existing, error: readError } = await supabase
    .from('public_page_configs')
    .select('*')
    .eq('property_id', propertyId)
    .eq('page_type', pageType)
    .maybeSingle();

  if (readError) {
    console.error('[publicPageConfigs] getOrCreatePublicPageConfig read:', readError);
    throw new Error('Failed to load public page config');
  }

  if (existing) return toRow(existing, pageType);

  const { data: created, error: insertError } = await supabase
    .from('public_page_configs')
    .insert({
      property_id: propertyId,
      page_type: pageType,
      config: defaultConfigFor(pageType),
    })
    .select('*')
    .single();

  if (insertError) {
    const { data: retried, error: retryError } = await supabase
      .from('public_page_configs')
      .select('*')
      .eq('property_id', propertyId)
      .eq('page_type', pageType)
      .maybeSingle();

    if (retryError || !retried) {
      console.error('[publicPageConfigs] getOrCreatePublicPageConfig insert:', insertError);
      throw new Error('Failed to create public page config');
    }
    return toRow(retried, pageType);
  }

  return toRow(created, pageType);
}

export async function upsertPublicPageConfig(
  propertyId: string,
  pageType: PublicPageType,
  config: unknown
): Promise<PublicPageConfigRow> {
  const normalized = normalizePublicPageConfig(pageType, config);
  const supabase = supabaseAdmin();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('public_page_configs')
    .upsert(
      {
        property_id: propertyId,
        page_type: pageType,
        config: normalized,
        updated_at: now,
      },
      { onConflict: 'property_id,page_type' }
    )
    .select('*')
    .single();

  if (error || !data) {
    console.error('[publicPageConfigs] upsertPublicPageConfig:', error);
    throw new Error('Failed to save public page config');
  }

  return toRow(data, pageType);
}
