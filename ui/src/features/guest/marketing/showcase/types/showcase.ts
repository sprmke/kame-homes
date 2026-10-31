/** Mirror of server PropertyShowcaseConfig — keep in sync with _shared/publicPageConfigs.ts */

export const SHOWCASE_TEMPLATE_KEYS = [
  'showcase-aurora',
  'showcase-monolith',
  'showcase-editorial',
  'showcase-verso',
  'showcase-atlas',
  'showcase-haven',
] as const;

export type ShowcaseTemplateKey = (typeof SHOWCASE_TEMPLATE_KEYS)[number];

export const SHOWCASE_SECTION_IDS = [
  'hero',
  'gallery',
  'about',
  'amenities',
  'highlights',
  'location',
  'testimonials',
  'host',
  'cta',
] as const;

export type ShowcaseSectionId = (typeof SHOWCASE_SECTION_IDS)[number];

/** Shared source for hero “above heading” and location “under heading” lines. */
export type ShowcaseTextSource = 'location' | 'development' | 'custom';

export type ShowcaseTextSourceConfig = {
  source: ShowcaseTextSource;
  /** Used when source is `custom`. */
  customText?: string;
};

/** @deprecated Prefer ShowcaseTextSourceConfig — same shape. */
export type ShowcaseHeroEyebrowSource = ShowcaseTextSource;
/** @deprecated Prefer ShowcaseTextSourceConfig — same shape. */
export type ShowcaseHeroEyebrowConfig = ShowcaseTextSourceConfig;

export type PropertyShowcaseSectionConfig = {
  id: ShowcaseSectionId;
  visible: boolean;
  order: number;
  columns?: number;
  copy?: { heading?: string; subheading?: string; body?: string };
  imageSlots?: string[];
  ctaLabel?: string;
  ctaTarget?: string;
  /** Hero only — text above the main heading. */
  heroEyebrow?: ShowcaseTextSourceConfig;
  /** Location only — primary line under the Location heading (body stays separate). */
  locationLead?: ShowcaseTextSourceConfig;
};

import {
  normalizeShowcasePresetPaletteId,
  SHOWCASE_PRESET_PALETTE_IDS,
  type ShowcasePresetPaletteId,
} from '@/features/guest/marketing/showcase/lib/showcasePresetPalettes';

export type ShowcasePaletteMode =
  'default' | 'brand' | 'media' | 'custom' | ShowcasePresetPaletteId;

/** Maps stored palette mode — legacy `light` / `dark` and old curated ids normalize on read. */
export function normalizeShowcasePaletteMode(mode: unknown): ShowcasePaletteMode {
  if (mode === 'default' || mode === 'brand' || mode === 'media' || mode === 'custom') return mode;
  const preset = normalizeShowcasePresetPaletteId(mode);
  if (preset) return preset;
  return 'default';
}

export { SHOWCASE_PRESET_PALETTE_IDS, type ShowcasePresetPaletteId };

export type PropertyShowcaseConfig = {
  version: 1;
  published: boolean;
  palette: {
    mode: ShowcasePaletteMode;
    accent: 'brand' | 'custom';
    customAccent: string | null;
    /** Base hue for palette mode `custom` — surfaces/accent derived via buildShowcaseBrandPalette. */
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

export type ShowcaseTestimonial = {
  id: string;
  author: string;
  body: string;
  rating?: number | null;
};

/**
 * Section renderer discriminator. Showcase templates historically switched on
 * `section.id`; Stay Guide reuses the same 6 template shells with its own section
 * kinds, so templates now switch on `section.kind` (defaults to `id` for Showcase).
 */
export type TemplateSectionKind =
  ShowcaseSectionId | 'passCard' | 'checkInDocuments' | 'quickNav' | 'chapter';

/** One rich-text sub-block inside a Stay Guide chapter (e.g. house rules, parking). */
export type StayGuideChapterBlock = {
  key: string;
  heading: string;
  html: string;
  imageUrl: string | null;
};

export type ShowcaseResolvedSection = Omit<PropertyShowcaseSectionConfig, 'id'> & {
  /** Anchor id — a Showcase section id, or a Stay Guide section id (e.g. `getting-in`). */
  id: string;
  kind: TemplateSectionKind;
  heading: string;
  subheading?: string;
  body?: string;
  /** Sanitized rich HTML body — Stay Guide chapters (single-block). */
  bodyHtml?: string;
  /** Multi-block rich content — Stay Guide chapters with >1 template section. */
  blocks?: StayGuideChapterBlock[];
  images: string[];
  /** Per-section accent — Stay Guide chapters. */
  accentColor?: string | null;
  /** True when copy/media was filled with preview placeholders. */
  usesPreviewMock?: boolean;
};

export type ShowcaseSocialLinks = {
  facebookUrl: string | null;
  airbnbUrl: string | null;
  instagramUrl: string | null;
  tiktokUrl: string | null;
};

export type ShowcaseGuestContact = {
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  socialLinks: ShowcaseSocialLinks;
};

export type ShowcaseHostInfo = {
  ownerName: string;
  ownerAvatarUrl: string | null;
  organizationName: string;
  organizationSlug: string;
  organizationLogoUrl: string | null;
  verifiedBadge: boolean;
  isSuperhost: boolean;
};

/** Booking-scoped facts the Stay Guide Stay Pass + hero surface. */
export type StayGuidePassInfo = {
  guestName: string;
  checkInDate: string;
  checkOutDate: string;
  checkInTime: string;
  checkOutTime: string;
  needParking: boolean;
  hasPets: boolean;
  towerAndUnit: string | null;
  validUntil: string;
  todayManila: string;
};

export type StayGuideDocItem = {
  id: string;
  label: string;
  kind: 'gaf' | 'pet' | 'parking' | 'other';
  status: 'ready' | 'pending';
  url: string | null;
  isPreviewSample?: boolean;
};

/** Extra payload present only when `pageKind === 'stay-guide'`. */
export type ShowcaseStayGuideExtras = {
  pass: StayGuidePassInfo;
  checkInDocuments: StayGuideDocItem[];
};

export type ShowcaseData = {
  /** Which product renders through the template engine. Defaults to `showcase`. */
  pageKind: 'showcase' | 'stay-guide';
  /** Present only when `pageKind === 'stay-guide'`. */
  stayGuide?: ShowcaseStayGuideExtras;
  templateKey: ShowcaseTemplateKey;
  published: boolean;
  propertyId: string;
  propertySlug: string;
  propertyName: string;
  brandColor: string;
  logoUrl: string | null;
  description: string | null;
  locationLabel: string;
  /** Resolved line above the hero heading (location / development / custom). */
  heroEyebrow: string;
  /** Resolved primary line under the Location heading. */
  locationLead: string;
  address: string;
  city: string;
  state: string | null;
  country: string;
  zipCode: string | null;
  amenities: string[];
  highlights: string[];
  latitude: number | null;
  longitude: number | null;
  placeId: string | null;
  mapsUrl: string | null;
  host: ShowcaseHostInfo;
  guestContact: ShowcaseGuestContact;
  hostPublicPath: string | null;
  contactPath: string;
  testimonials: ShowcaseTestimonial[];
  formPath: string;
  calendarPath: string;
  config: PropertyShowcaseConfig;
  sections: ShowcaseResolvedSection[];
  accentColor: string;
  embed: boolean;
  reducedMotion: boolean;
};

export function isShowcaseTemplateKey(value: unknown): value is ShowcaseTemplateKey {
  return typeof value === 'string' && (SHOWCASE_TEMPLATE_KEYS as readonly string[]).includes(value);
}

/** Saved configs from the Page Editor are always published (no draft toggle in UI). */
export function showcaseConfigForSave(config: PropertyShowcaseConfig): PropertyShowcaseConfig {
  return {
    ...config,
    published: true,
    sections: config.sections.map((section) => {
      if (section.ctaTarget !== '__custom__') return section;
      const { ctaTarget: _draft, ...rest } = section;
      return rest;
    }),
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
    sections: SHOWCASE_SECTION_IDS.map((id, order) => ({
      id,
      visible: true,
      order,
    })),
  };
}
