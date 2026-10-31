import type {
  ShowcaseData,
  ShowcaseResolvedSection,
  ShowcaseTestimonial,
} from '@/features/guest/marketing/showcase/types/showcase';

/** Maximum guest review cards shown on showcase pages (all templates). */
export const SHOWCASE_MAX_TESTIMONIALS = 4;

export function showcaseTestimonialsForDisplay(
  testimonials: ShowcaseTestimonial[]
): ShowcaseTestimonial[] {
  return testimonials.slice(0, SHOWCASE_MAX_TESTIMONIALS);
}

/** Two-up testimonial grid — flex wrap centers a lone odd card on the last row. */
export const showcaseTestimonialsGridClass = 'flex flex-wrap justify-center gap-5';

export const showcaseTestimonialsGridItemClass = 'w-full min-w-0 @md:w-[calc(50%-0.625rem)]';

/** Standard vertical padding for showcase content sections. */
export const showcaseSectionPyClass = 'py-12 @sm:py-16';

/** Closing CTA band — compact against the section above, room before footer. */
export const showcaseCtaSectionPyClass = 'py-10 @sm:py-14';

/** Inner padding for CTA cards/surfaces (outer section uses {@link showcaseCtaSectionPyClass}). */
export const showcaseCtaInnerPyClass = 'py-10 @sm:py-12';

/** Verso plates / Atlas chapters — slightly roomier without py-32 gaps. */
export const showcaseChapterSectionPyClass = 'py-14 @md:py-20';

function clampColumns(columns: number | undefined, fallback: number): 1 | 2 | 3 | 4 {
  const n = columns ?? fallback;
  if (n <= 1) return 1;
  if (n === 2) return 2;
  if (n === 3) return 3;
  return 4;
}

/** Responsive grid for amenities / highlights cards (1–4 columns from editor). */
export function resolveShowcaseGridColsClass(columns: number | undefined, fallback = 3): string {
  const cols = clampColumns(columns, fallback);
  if (cols === 1) return 'grid grid-cols-1 gap-3';
  if (cols === 2) return 'grid grid-cols-1 gap-3 @sm:grid-cols-2';
  if (cols === 3) return 'grid grid-cols-1 gap-3 @sm:grid-cols-2 @lg:grid-cols-3';
  return 'grid grid-cols-1 gap-3 @sm:grid-cols-2 @lg:grid-cols-4';
}

/** CSS multi-column flow (Editorial amenities). */
export function resolveShowcaseCssColumnsClass(columns: number | undefined, fallback = 3): string {
  const cols = clampColumns(columns, fallback);
  if (cols === 1) return 'columns-1 gap-8';
  if (cols === 2) return 'columns-1 gap-8 @sm:columns-2';
  if (cols === 3) return 'columns-1 gap-8 @sm:columns-2 @lg:columns-3';
  return 'columns-1 gap-8 @sm:columns-2 @lg:columns-4';
}

const CTA_TARGET_FORM = 'form';
const CTA_TARGET_CALENDAR = 'calendar';
/** Editor-only draft while host picks Custom URL but has not typed a path yet. */
const CTA_TARGET_CUSTOM_DRAFT = '__custom__';

/** Primary CTA href from section override or defaults. */
export function resolveShowcasePrimaryCtaHref(
  ctaTarget: string | undefined,
  data: ShowcaseData
): string {
  const target = ctaTarget?.trim();
  // Empty / form / unfinished custom draft → booking form
  if (!target || target === CTA_TARGET_FORM || target === CTA_TARGET_CUSTOM_DRAFT) {
    return data.formPath;
  }
  if (target === CTA_TARGET_CALENDAR) return data.calendarPath;
  if (target.startsWith('#')) {
    const id = target.slice(1).trim();
    return id ? `#${id}` : data.formPath;
  }
  if (target.startsWith('/') || target.startsWith('http://') || target.startsWith('https://')) {
    return target;
  }
  return data.formPath;
}

export function resolveShowcaseSecondaryCtaHref(data: ShowcaseData): string {
  if (data.pageKind === 'stay-guide') return '#host';
  return data.calendarPath;
}

/** Secondary hero CTA label — Stay Guide scrolls to host contact, Showcase defaults to calendar. */
export function resolveShowcaseSecondaryCtaLabel(data: ShowcaseData): string {
  return data.pageKind === 'stay-guide' ? 'Contact host' : 'Check dates';
}

export { CTA_TARGET_CALENDAR, CTA_TARGET_CUSTOM_DRAFT, CTA_TARGET_FORM };

/**
 * Whether a section has real content worth rendering on a live (non-preview) page.
 * Preview-mock sections always pass — the editor/draft/embed fill them with
 * placeholders and must stay visible. On published pages, genuinely empty
 * soft sections collapse instead of leaving a void.
 */
export function shouldRenderShowcaseSection(
  section: ShowcaseResolvedSection,
  data: ShowcaseData
): boolean {
  if (data.pageKind === 'stay-guide') {
    // The Stay Guide mapper already drops empty chapters / docs on live pages.
    if (section.kind === 'quickNav') return false;
    if (section.kind === 'gallery') return section.images.length > 0;
    return true;
  }
  if (section.usesPreviewMock) return true;
  switch (section.id) {
    case 'hero':
    case 'cta':
    case 'host':
      return true;
    case 'gallery':
      return section.images.length > 0;
    case 'amenities':
      return data.amenities.length > 0;
    case 'highlights':
      return data.highlights.length > 0;
    case 'testimonials':
      return data.testimonials.some((item) => Boolean(item.body?.trim()));
    case 'about':
      return Boolean(section.body?.trim());
    case 'location': {
      const hasGeo =
        (data.latitude != null && data.longitude != null) ||
        Boolean(data.placeId?.trim()) ||
        Boolean(data.mapsUrl?.trim());
      return hasGeo || Boolean(data.address?.trim()) || Boolean(data.locationLabel?.trim());
    }
    default:
      return Boolean(section.body?.trim() || section.subheading?.trim());
  }
}

/**
 * Split a highlight string into a leading value + trailing label when the
 * first token is numeric / time-like (`"2 bedrooms"`, `"11:00 AM ..."`), or when
 * the string matches known property stats (`"Up to 4 guests"`, `"Check-in 2:00 PM"`).
 * Non-numeric phrases (`"Walkable neighborhood"`) return `{ value: null }`.
 */
export function parseShowcaseHighlight(item: string): { value: string | null; label: string } {
  const trimmed = item.trim();
  if (!trimmed) return { value: null, label: '' };

  const upToGuests = /^Up to (\d+)\s+(.+)$/i.exec(trimmed);
  if (upToGuests) {
    return { value: upToGuests[1], label: upToGuests[2] };
  }

  const checkIn = /^Check-in\s+(.+)$/i.exec(trimmed);
  if (checkIn) {
    return { value: checkIn[1], label: 'Check-in' };
  }

  const checkOut = /^Check-out\s+(.+)$/i.exec(trimmed);
  if (checkOut) {
    return { value: checkOut[1], label: 'Check-out' };
  }

  const [first, ...rest] = trimmed.split(/\s+/);
  if (first && /^\d+(?:[.:]\d+)?$/.test(first)) {
    return { value: first, label: rest.join(' ') };
  }

  return { value: null, label: trimmed };
}
