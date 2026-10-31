import { hasShowcaseHostContent } from '@/features/guest/marketing/showcase/lib/showcaseHostContent';
import { hasShowcaseLocationContent } from '@/features/guest/marketing/showcase/lib/showcaseLocation';
import type {
  ShowcaseData,
  ShowcaseResolvedSection,
  ShowcaseSectionId,
  ShowcaseTestimonial,
} from '@/features/guest/marketing/showcase/types/showcase';

export const SHOWCASE_PREVIEW_MOCK_MESSAGE = 'Renders test data';

/** Default section heading when host has not overridden copy. */
export const SHOWCASE_SECTION_HEADING: Record<ShowcaseSectionId, string> = {
  hero: 'Your stay',
  gallery: 'Gallery',
  about: 'About',
  amenities: 'Amenities',
  highlights: 'Highlights',
  location: 'Location',
  testimonials: 'Reviews',
  host: 'Your host',
  cta: 'Ready to book?',
};

export const SHOWCASE_MOCK_GALLERY_IMAGES = [
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=80',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=80',
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=80',
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&q=80',
] as const;

const MOCK_AMENITIES = [
  'High-speed Wi‑Fi',
  'Air conditioning',
  'Full kitchen',
  'Smart TV',
  'Self check-in',
  'Dedicated workspace',
];

const MOCK_HIGHLIGHTS = [
  'Walkable neighborhood',
  'Natural light throughout',
  'Quiet hours respected',
  'Flexible check-in',
];

const MOCK_TESTIMONIALS: ShowcaseTestimonial[] = [
  {
    id: 'mock-1',
    author: 'Maria L.',
    body: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    rating: 5,
  },
  {
    id: 'mock-2',
    author: 'James R.',
    body: 'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    rating: 5,
  },
  {
    id: 'mock-3',
    author: 'Aisha K.',
    body: 'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
    rating: 4,
  },
];

const MOCK_COPY: Partial<Record<ShowcaseSectionId, { subheading?: string; body?: string }>> = {
  hero: {
    subheading: 'A place made for arriving well',
  },
  about: {
    body: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer nec odio. Praesent libero. Sed cursus ante dapibus diam. Sed nisi. Nulla quis sem at nibh elementum imperdiet.',
  },
  amenities: {
    body: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Duis sagittis ipsum praesent mollis.',
  },
  highlights: {
    body: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Curabitur sodales ligula in libero.',
  },
  host: {
    body: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Your host profile and contact details appear here.',
  },
  gallery: {
    body: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Add photos in the page editor or property gallery.',
  },
  cta: {
    subheading: 'Check dates or start your request',
    body: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ready when you are.',
  },
};

function markMock(section: ShowcaseResolvedSection): ShowcaseResolvedSection {
  return { ...section, usesPreviewMock: true };
}

function applyCopyMock(
  section: ShowcaseResolvedSection,
  markWhenFilled: boolean
): ShowcaseResolvedSection {
  const mock = MOCK_COPY[section.id as keyof typeof MOCK_COPY];
  if (!mock) return section;

  let next = { ...section };
  let filled = false;

  if (!next.subheading?.trim() && mock.subheading) {
    next = { ...next, subheading: mock.subheading };
    filled = true;
  }
  if (!next.body?.trim() && mock.body) {
    next = { ...next, body: mock.body };
    filled = true;
  }

  return markWhenFilled && filled ? markMock(next) : next;
}

function hasShowcaseTestimonialContent(testimonials: ShowcaseTestimonial[]): boolean {
  return testimonials.some((item) => Boolean(item.body?.trim()));
}

export function applyShowcasePreviewMocks(data: ShowcaseData): ShowcaseData {
  let amenities = data.amenities;
  const amenitiesMocked = amenities.length === 0;
  if (amenitiesMocked) amenities = [...MOCK_AMENITIES];

  let highlights = data.highlights;
  const highlightsMocked = highlights.length === 0;
  if (highlightsMocked) highlights = [...MOCK_HIGHLIGHTS];

  let testimonials = data.testimonials;
  const testimonialsMocked = !hasShowcaseTestimonialContent(testimonials);
  if (testimonialsMocked) testimonials = [...MOCK_TESTIMONIALS];

  const sections = data.sections.map((section) => {
    if (section.id === 'gallery') {
      if (section.images.length === 0) {
        return applyCopyMock(
          markMock({ ...section, images: [...SHOWCASE_MOCK_GALLERY_IMAGES] }),
          true
        );
      }
      return section;
    }

    if (section.id === 'hero') {
      let next = section;
      if (next.images.length === 0) {
        next = markMock({ ...next, images: [SHOWCASE_MOCK_GALLERY_IMAGES[0]] });
      }
      return applyCopyMock(next, next.usesPreviewMock === true);
    }

    if (section.id === 'about') {
      if (!section.body?.trim()) {
        return applyCopyMock(markMock({ ...section, body: MOCK_COPY.about!.body! }), true);
      }
      return section;
    }

    if (section.id === 'amenities' && amenitiesMocked) {
      return applyCopyMock(markMock(section), true);
    }

    if (section.id === 'highlights' && highlightsMocked) {
      return applyCopyMock(markMock(section), true);
    }

    if (section.id === 'testimonials') {
      const body = section.body?.trim() ?? '';
      const isStalePreviewCopy = body.includes('Guest feedback will appear here once published');
      if (isStalePreviewCopy) {
        return { ...section, body: undefined, usesPreviewMock: testimonialsMocked };
      }
      if (testimonialsMocked) {
        return markMock(section);
      }
      return section;
    }

    if (section.id === 'host') {
      const body = section.body?.trim() ?? '';
      const isStalePreviewCopy = body.includes('Your host profile and contact details appear here');
      if (hasShowcaseHostContent(data)) {
        return {
          ...section,
          usesPreviewMock: false,
          body: isStalePreviewCopy ? undefined : section.body,
        };
      }
      if (!body) {
        return applyCopyMock(markMock(section), true);
      }
      return section;
    }

    if (section.id === 'location') {
      const body = section.body?.trim() ?? '';
      const isStalePreviewCopy = body.includes(
        'Directions and address details come from property settings'
      );
      if (hasShowcaseLocationContent(data) || section.usesPreviewMock || isStalePreviewCopy) {
        return {
          ...section,
          usesPreviewMock: false,
          body: isStalePreviewCopy ? undefined : section.body,
        };
      }
      return section;
    }

    return section;
  });

  return {
    ...data,
    sections,
    amenities,
    highlights,
    testimonials,
  };
}
