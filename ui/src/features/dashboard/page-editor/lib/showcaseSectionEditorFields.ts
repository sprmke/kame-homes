import type { ShowcaseSectionId } from '@/features/guest/marketing/showcase/types/showcase';

/** Which Section details controls apply per showcase section. */
export type ShowcaseSectionEditorFields = {
  heading: boolean;
  subheading: boolean;
  body: boolean;
  columns: boolean;
  imageSlots: boolean;
  cta: boolean;
};

export const SHOWCASE_SECTION_EDITOR_FIELDS: Record<
  ShowcaseSectionId,
  ShowcaseSectionEditorFields
> = {
  hero: {
    heading: true,
    subheading: true,
    body: false,
    columns: false,
    imageSlots: true,
    cta: true,
  },
  gallery: {
    heading: true,
    subheading: true,
    body: false,
    columns: false,
    imageSlots: true,
    cta: false,
  },
  about: {
    heading: true,
    subheading: true,
    body: true,
    columns: false,
    imageSlots: false,
    cta: false,
  },
  amenities: {
    heading: true,
    subheading: true,
    body: true,
    columns: true,
    imageSlots: false,
    cta: false,
  },
  highlights: {
    heading: true,
    subheading: true,
    body: true,
    columns: true,
    imageSlots: false,
    cta: false,
  },
  location: {
    heading: true,
    subheading: false,
    body: true,
    columns: false,
    imageSlots: false,
    cta: false,
  },
  testimonials: {
    heading: true,
    subheading: true,
    body: false,
    columns: false,
    imageSlots: false,
    cta: false,
  },
  host: {
    heading: true,
    subheading: false,
    body: true,
    columns: false,
    imageSlots: false,
    cta: false,
  },
  cta: {
    heading: true,
    subheading: true,
    body: true,
    columns: false,
    imageSlots: false,
    cta: true,
  },
};

export function resolveShowcaseSectionEditorFields(
  id: ShowcaseSectionId
): ShowcaseSectionEditorFields {
  return SHOWCASE_SECTION_EDITOR_FIELDS[id];
}
