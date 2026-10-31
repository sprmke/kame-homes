/**
 * Adapts the token-gated Stay Guide payload onto `ShowcaseData` so the same 6
 * animated template shells render it. Stay Guide sections carry their own `kind`
 * (`passCard`, `checkInDocuments`, `chapter`, `quickNav`, plus the shared `hero` /
 * `gallery` / `host`); templates switch on `section.kind`.
 */

import type { ResolvedPropertyDetail } from '@/features/guest/marketing/properties/types/publicProperty';
import { resolveShowcaseHeroEyebrow } from '@/features/guest/marketing/showcase/lib/showcaseHeroEyebrow';
import {
  defaultPropertyShowcaseConfig,
  isShowcaseTemplateKey,
  type PropertyShowcaseConfig,
  type ShowcaseData,
  type ShowcaseResolvedSection,
  type ShowcaseTemplateKey,
  type StayGuideChapterBlock,
} from '@/features/guest/marketing/showcase/types/showcase';
import type { GuestStayGuideDto } from '@/features/guest/stay-guide/lib/api';
import {
  isStayGuideChapterSectionId,
  normalizeStayGuideConfigV2,
  type StayGuideChapterSectionId,
  type StayGuideConfigV2,
  type StayGuideSectionConfigEntry,
  type StayGuideSectionId,
} from '@/features/guest/stay-guide/lib/stayGuideConfig';

const MOCK_GALLERY_IMAGES = [
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=80',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80',
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=80',
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&q=80',
];

const CHAPTER_TEMPLATE_KEYS: Record<StayGuideChapterSectionId, string[]> = {
  'getting-in': ['check-in-instructions'],
  'make-yourself-at-home': ['house-rules', 'parking-reminders'],
  'before-you-go': ['check-out-instructions'],
};

const SECTION_HEADING_DEFAULTS: Record<StayGuideSectionId, string> = {
  hero: 'Your stay',
  passCard: 'Your stay pass',
  checkInDocuments: 'Check-in documents',
  gallery: 'The space',
  quickNav: '',
  'getting-in': 'Getting In',
  'make-yourself-at-home': 'Make Yourself at Home',
  'before-you-go': 'Before You Go',
  host: 'Need anything?',
};

const SECTION_SUBHEADING_DEFAULTS: Partial<Record<StayGuideSectionId, string>> = {
  hero: 'Everything for a smooth arrival',
  gallery: 'A look around before you arrive',
  host: 'Your host is a message away',
};

const CHAPTER_MOCK_HTML: Record<StayGuideChapterSectionId, string> = {
  'getting-in':
    '<p>Head to the lobby and let the front desk know you are checking in. Your access card is waiting at the reception. The lift needs a tap of the card for your floor.</p><p>Wi-Fi name and password are on the welcome card by the TV.</p>',
  'make-yourself-at-home':
    '<p>Make yourself comfortable. The kitchen is stocked with the basics and there are fresh towels in the bathroom cabinet.</p><ul><li>Quiet hours are 10pm to 7am.</li><li>No smoking anywhere indoors.</li><li>Aircon: please switch off when you head out.</li></ul>',
  'before-you-go':
    '<p>Check-out is at 12nn. Leave the card on the kitchen counter, close the windows, and switch off the aircon and lights.</p><p>No need to strip the bed. Just drop used towels in the tub.</p>',
};

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isEmbedMode(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('embed') === '1';
}

function resolveTemplateKey(raw: string): ShowcaseTemplateKey {
  return isShowcaseTemplateKey(raw) ? raw : 'showcase-aurora';
}

/** Build a Showcase-shaped config so the shell's palette / typography / motion reads work. */
function toShowcaseConfig(config: StayGuideConfigV2): PropertyShowcaseConfig {
  const base = defaultPropertyShowcaseConfig();
  return {
    ...base,
    published: config.published,
    palette: config.palette,
    typography: config.typography,
    motion: config.motion,
  };
}

function resolveImages(all: string[], slots: string[] | undefined, limit: number): string[] {
  const pool = all.filter((url) => url.trim());
  if (!slots?.length) return pool.slice(0, limit);
  const inPool = new Set(pool);
  return slots.filter((url) => inPool.has(url)).slice(0, limit);
}

function chapterBlocks(
  dto: GuestStayGuideDto,
  chapterId: StayGuideChapterSectionId
): StayGuideChapterBlock[] {
  const keys = CHAPTER_TEMPLATE_KEYS[chapterId];
  return keys
    .map((key) => dto.sections.find((section) => section.key === key))
    .filter((section): section is GuestStayGuideDto['sections'][number] => Boolean(section))
    .map((section) => ({
      key: section.key,
      heading: section.displayHeading || section.label,
      html: section.html ?? '',
      imageUrl: section.imageUrl ?? null,
    }));
}

function hasRealChapterContent(blocks: StayGuideChapterBlock[]): boolean {
  return blocks.some((block) => block.html.replace(/<[^>]*>/g, '').trim().length > 0);
}

function resolveHeroEyebrow(
  dto: GuestStayGuideDto,
  entry: StayGuideSectionConfigEntry | undefined
): string {
  const property = dto.property as GuestStayGuideDto['property'] & {
    type?: string;
    residenceName?: string | null;
    developmentSlug?: string | null;
  };
  return resolveShowcaseHeroEyebrow(
    property as unknown as ResolvedPropertyDetail,
    dto.property.locationLabel || 'Your stay',
    entry?.heroEyebrow
  );
}

export function mapStayGuideData(input: {
  dto: GuestStayGuideDto;
  /** Overrides the DTO's own `sectionConfig` (Page Editor live preview). */
  config?: StayGuideConfigV2 | null;
  /** Lorem / stock fill when a visible section has no real content. */
  previewPlaceholders?: boolean;
}): ShowcaseData {
  const { dto } = input;
  const checkInDocuments = dto.checkInDocuments ?? [];
  const config = normalizeStayGuideConfigV2(input.config ?? dto.sectionConfig);
  const templateKey = resolveTemplateKey(dto.templateKey);
  const embed = isEmbedMode();
  const reducedMotion = prefersReducedMotion();
  const preview = input.previewPlaceholders ?? (embed || !config.published);

  const galleryPool =
    dto.property.galleryImages.length > 0 ? dto.property.galleryImages : dto.property.images;

  const orderedEntries = [...config.sections].sort((a, b) => a.order - b.order);
  const heroEntry = orderedEntries.find((entry) => entry.id === 'hero');

  // Stay Guide has no booking CTA — point the template hero buttons at in-page anchors
  // (first chapter / the "Need anything?" block) so they scroll somewhere useful.
  const firstChapterAnchor =
    orderedEntries.find((entry) => entry.visible && isStayGuideChapterSectionId(entry.id))?.id ??
    orderedEntries.find((entry) => entry.visible && entry.id !== 'hero')?.id ??
    'host';
  const primaryAnchor = `#${firstChapterAnchor}`;
  const secondaryAnchor = '#host';

  const sections: ShowcaseResolvedSection[] = orderedEntries
    .filter((entry) => entry.visible)
    .filter((entry) => {
      // Drop chapters + check-in docs that have nothing to show on a live (non-preview) page.
      if (preview) return true;
      if (entry.id === 'checkInDocuments') return checkInDocuments.length > 0;
      if (isStayGuideChapterSectionId(entry.id)) {
        return hasRealChapterContent(chapterBlocks(dto, entry.id));
      }
      return true;
    })
    .map((entry) => {
      const headingOverride = entry.copy?.heading?.trim();
      const subheadingOverride = entry.copy?.subheading?.trim();
      const heading = headingOverride || SECTION_HEADING_DEFAULTS[entry.id];
      const subheading = subheadingOverride || SECTION_SUBHEADING_DEFAULTS[entry.id];

      const shared = {
        visible: true,
        order: entry.order,
        columns: undefined,
        copy: entry.copy,
        imageSlots: entry.imageSlots,
        ctaLabel: undefined,
        ctaTarget: undefined,
        heroEyebrow: entry.heroEyebrow,
        locationLead: undefined,
        heading,
        subheading,
      } satisfies Partial<ShowcaseResolvedSection>;

      if (entry.id === 'hero') {
        const images = resolveImages(galleryPool, entry.imageSlots, 1);
        const heroImage =
          images[0] ??
          dto.property.heroImageUrl ??
          (preview ? MOCK_GALLERY_IMAGES[0] : (galleryPool[0] ?? ''));
        return {
          ...shared,
          id: 'hero',
          kind: 'hero' as const,
          heading: headingOverride || dto.property.name,
          ctaLabel: 'Open the guide',
          ctaTarget: primaryAnchor,
          images: heroImage ? [heroImage] : [],
          usesPreviewMock: preview && images.length === 0 && !dto.property.heroImageUrl,
        };
      }

      if (entry.id === 'gallery') {
        let images = resolveImages(galleryPool, entry.imageSlots, 12);
        const mocked = preview && images.length === 0;
        if (mocked) images = [...MOCK_GALLERY_IMAGES];
        return {
          ...shared,
          id: 'gallery',
          kind: 'gallery' as const,
          images,
          usesPreviewMock: mocked,
        };
      }

      if (entry.id === 'passCard') {
        return { ...shared, id: 'passCard', kind: 'passCard' as const, images: [] };
      }

      if (entry.id === 'checkInDocuments') {
        return {
          ...shared,
          id: 'checkInDocuments',
          kind: 'checkInDocuments' as const,
          images: [],
          usesPreviewMock: preview && checkInDocuments.length === 0,
        };
      }

      if (entry.id === 'quickNav') {
        return { ...shared, id: 'quickNav', kind: 'quickNav' as const, heading: '', images: [] };
      }

      if (entry.id === 'host') {
        return { ...shared, id: 'host', kind: 'host' as const, images: [] };
      }

      // Chapter section.
      let blocks = chapterBlocks(dto, entry.id);
      const mocked = preview && !hasRealChapterContent(blocks);
      if (mocked) {
        blocks = [
          { key: entry.id, heading: '', html: CHAPTER_MOCK_HTML[entry.id], imageUrl: null },
        ];
      }
      return {
        ...shared,
        id: entry.id,
        kind: 'chapter' as const,
        accentColor: entry.accentColor ?? null,
        blocks,
        bodyHtml: blocks.map((block) => block.html).join('\n'),
        images: blocks.map((block) => block.imageUrl).filter((url): url is string => Boolean(url)),
        usesPreviewMock: mocked,
      };
    });

  const loc = dto.property.location;
  const brandColor = dto.property.brandColor || 'hsl(168 65% 40%)';

  return {
    pageKind: 'stay-guide',
    stayGuide: {
      pass: {
        guestName: dto.booking.guestName,
        checkInDate: dto.booking.checkInDate,
        checkOutDate: dto.booking.checkOutDate,
        checkInTime: dto.booking.checkInTime,
        checkOutTime: dto.booking.checkOutTime,
        needParking: dto.booking.needParking,
        hasPets: dto.booking.hasPets,
        towerAndUnit: dto.property.towerAndUnit,
        validUntil: dto.validUntil,
        todayManila: dto.todayManila,
      },
      checkInDocuments: checkInDocuments.map((doc) => ({
        id: doc.id,
        label: doc.label,
        kind: doc.kind,
        status: doc.status,
        url: doc.url,
        isPreviewSample: doc.isPreviewSample,
      })),
    },
    templateKey,
    published: config.published,
    propertyId: dto.property.slug,
    propertySlug: dto.property.slug,
    propertyName: dto.property.name,
    brandColor,
    logoUrl: dto.property.logoUrl,
    description: null,
    locationLabel: dto.property.locationLabel,
    heroEyebrow: resolveHeroEyebrow(dto, heroEntry),
    locationLead: dto.property.locationLabel,
    address: loc.address,
    city: loc.city,
    state: loc.province,
    country: loc.country,
    zipCode: loc.zipCode,
    amenities: [],
    highlights: [],
    latitude: loc.latitude,
    longitude: loc.longitude,
    placeId: loc.placeId,
    mapsUrl: loc.mapsUrl,
    host: {
      ownerName: dto.host?.name || dto.property.name,
      ownerAvatarUrl: dto.host?.avatarUrl ?? dto.property.logoUrl,
      organizationName: dto.host?.organizationName || dto.property.name,
      organizationSlug: '',
      organizationLogoUrl: dto.property.logoUrl,
      verifiedBadge: false,
      isSuperhost: false,
    },
    guestContact: {
      contactName: dto.host?.name || '',
      contactPhone: dto.contact.phone,
      contactEmail: dto.contact.email,
      socialLinks: {
        facebookUrl: dto.contact.facebookUrl || null,
        airbnbUrl: dto.contact.airbnbUrl || null,
        instagramUrl: null,
        tiktokUrl: null,
      },
    },
    hostPublicPath: null,
    contactPath: secondaryAnchor,
    testimonials: [],
    formPath: primaryAnchor,
    calendarPath: secondaryAnchor,
    config: toShowcaseConfig(config),
    sections,
    accentColor: brandColor,
    embed,
    reducedMotion,
  };
}
