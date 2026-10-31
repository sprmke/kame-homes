import type { ShowcaseTemplateKey } from '@/features/guest/marketing/showcase/types/showcase';

/**
 * Which Style panel controls actually affect each showcase template.
 * Hide the rest so hosts don’t toggle options that do nothing.
 */
export type ShowcaseEditorStyleFields = {
  /** Hero photo gradient strength (full-bleed / cinematic heroes only). */
  heroOverlay: boolean;
  /** Display font picker — Aurora only; other templates lock their face. */
  displayFont: boolean;
  /** Scroll-linked parallax (Aurora layered hero/sections; Atlas hero image). */
  parallax: boolean;
  /** Animated mesh / grain canvas behind the hero. */
  canvas: boolean;
};

const STYLE_FIELDS: Record<ShowcaseTemplateKey, ShowcaseEditorStyleFields> = {
  'showcase-aurora': {
    heroOverlay: true,
    displayFont: true,
    parallax: true,
    canvas: true,
  },
  'showcase-monolith': {
    heroOverlay: true,
    displayFont: false,
    parallax: false,
    canvas: true,
  },
  'showcase-editorial': {
    heroOverlay: false,
    displayFont: false,
    parallax: false,
    canvas: true,
  },
  'showcase-verso': {
    heroOverlay: true,
    displayFont: false,
    parallax: false,
    canvas: true,
  },
  'showcase-atlas': {
    heroOverlay: true,
    displayFont: false,
    parallax: true,
    canvas: true,
  },
  'showcase-haven': {
    heroOverlay: false,
    displayFont: false,
    parallax: false,
    canvas: false,
  },
};

export function resolveShowcaseEditorStyleFields(templateKey: string): ShowcaseEditorStyleFields {
  if (templateKey in STYLE_FIELDS) {
    return STYLE_FIELDS[templateKey as ShowcaseTemplateKey];
  }
  return STYLE_FIELDS['showcase-aurora'];
}
