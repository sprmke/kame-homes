import type { VideoSceneKind } from '@/features/dashboard/marketing/lib/video/videoProjectTypes';

/**
 * Per-template composition — the pause-visible axis Design Quiet Coast already
 * has. Scene kind alone is not enough; every baseId gets its own stack.
 *
 * Position maps intentionally mirror `VideoSceneTextLayout` without importing
 * `videoTextSlots` (that file imports this one).
 */
export type VideoPillStyle = 'filled' | 'compact' | 'bare' | 'outline';
export type VideoCtaChrome = 'filled' | 'outline';

type LayoutSlot = 'headline' | 'subheadline' | 'promoLine' | 'ctaLine' | 'rulesLine' | 'slotLabels';

type LayoutPos = { x: number; y: number; align?: 'left' | 'center' | 'right' };
type LayoutMap = Partial<Record<LayoutSlot, LayoutPos>>;

export type VideoTemplateLayoutProfile = {
  photo: LayoutMap;
  promo: LayoutMap;
  slots: LayoutMap;
  cta: LayoutMap;
  pillStyle: VideoPillStyle;
  ctaChrome: VideoCtaChrome;
  /** Multiplier on title preset fontSize (photo / promo headlines). */
  titleScale?: number;
  /** Multiplier on promo-line preset fontSize. */
  promoScale?: number;
};

const KIND_DEFAULTS: Record<VideoSceneKind, LayoutMap> = {
  photo: {
    headline: { x: 50, y: 84, align: 'center' },
    subheadline: { x: 50, y: 52, align: 'center' },
    promoLine: { x: 50, y: 52, align: 'center' },
    rulesLine: { x: 50, y: 88, align: 'center' },
  },
  promo: {
    headline: { x: 50, y: 36, align: 'center' },
    subheadline: { x: 50, y: 48, align: 'center' },
    promoLine: { x: 50, y: 64, align: 'center' },
  },
  slots: {
    headline: { x: 50, y: 22, align: 'center' },
    subheadline: { x: 50, y: 34, align: 'center' },
    slotLabels: { x: 50, y: 54, align: 'center' },
    ctaLine: { x: 50, y: 78, align: 'center' },
  },
  cta: {
    promoLine: { x: 50, y: 36, align: 'center' },
    ctaLine: { x: 50, y: 52, align: 'center' },
    rulesLine: { x: 50, y: 72, align: 'center' },
  },
};

const QUIET_COAST_FALLBACK: VideoTemplateLayoutProfile = {
  photo: KIND_DEFAULTS.photo,
  promo: KIND_DEFAULTS.promo,
  slots: KIND_DEFAULTS.slots,
  cta: KIND_DEFAULTS.cta,
  pillStyle: 'outline',
  ctaChrome: 'outline',
};

/** Quiet Coast Motion — outline chrome by default; layouts vary by storyboard. */
const VIDEO_TEMPLATE_LAYOUTS: Record<string, VideoTemplateLayoutProfile> = {
  'quiet-morning': {
    photo: { headline: { x: 50, y: 84, align: 'center' } },
    promo: {
      headline: { x: 50, y: 58, align: 'center' },
      subheadline: { x: 50, y: 68, align: 'center' },
      promoLine: { x: 50, y: 78, align: 'center' },
    },
    slots: KIND_DEFAULTS.slots,
    cta: {
      ctaLine: { x: 50, y: 52, align: 'center' },
      rulesLine: { x: 50, y: 70, align: 'center' },
    },
    pillStyle: 'outline',
    ctaChrome: 'outline',
    titleScale: 1.05,
  },
  'golden-hour': {
    photo: {
      headline: { x: 50, y: 18, align: 'center' },
      subheadline: { x: 50, y: 78, align: 'center' },
    },
    promo: {
      headline: { x: 50, y: 22, align: 'center' },
      subheadline: { x: 50, y: 34, align: 'center' },
      promoLine: { x: 50, y: 72, align: 'center' },
    },
    slots: KIND_DEFAULTS.slots,
    cta: KIND_DEFAULTS.cta,
    pillStyle: 'outline',
    ctaChrome: 'outline',
    titleScale: 1.08,
  },
  'poolside-calm': {
    photo: { headline: { x: 14, y: 78, align: 'left' } },
    promo: {
      headline: { x: 14, y: 42, align: 'left' },
      promoLine: { x: 14, y: 58, align: 'left' },
    },
    slots: KIND_DEFAULTS.slots,
    cta: {
      promoLine: { x: 14, y: 38, align: 'left' },
      ctaLine: { x: 14, y: 54, align: 'left' },
      rulesLine: { x: 14, y: 72, align: 'left' },
    },
    pillStyle: 'outline',
    ctaChrome: 'outline',
    titleScale: 1.12,
  },
  'amenity-tour': {
    /** Amenity words ride photo b-roll — large mid-frame captions. */
    photo: {
      headline: { x: 50, y: 18, align: 'center' },
      subheadline: { x: 50, y: 52, align: 'center' },
      promoLine: { x: 50, y: 52, align: 'center' },
    },
    promo: {
      headline: { x: 50, y: 36, align: 'center' },
      subheadline: { x: 50, y: 48, align: 'center' },
      promoLine: { x: 50, y: 62, align: 'center' },
    },
    slots: KIND_DEFAULTS.slots,
    cta: KIND_DEFAULTS.cta,
    pillStyle: 'compact',
    ctaChrome: 'outline',
    titleScale: 1.15,
    promoScale: 1.25,
  },
  'weekday-cut': {
    photo: {
      headline: { x: 50, y: 16, align: 'center' },
      rulesLine: { x: 50, y: 82, align: 'center' },
    },
    promo: {
      headline: { x: 50, y: 28, align: 'center' },
      subheadline: { x: 50, y: 42, align: 'center' },
      promoLine: { x: 50, y: 56, align: 'center' },
    },
    slots: KIND_DEFAULTS.slots,
    cta: {
      ctaLine: { x: 50, y: 48, align: 'center' },
      rulesLine: { x: 50, y: 66, align: 'center' },
    },
    pillStyle: 'filled',
    ctaChrome: 'filled',
    promoScale: 1.2,
  },
  'percent-off': {
    photo: { headline: { x: 50, y: 82, align: 'center' } },
    promo: {
      headline: { x: 50, y: 54, align: 'center' },
      subheadline: { x: 50, y: 64, align: 'center' },
      promoLine: { x: 50, y: 76, align: 'center' },
    },
    slots: KIND_DEFAULTS.slots,
    cta: {
      ctaLine: { x: 50, y: 58, align: 'center' },
      rulesLine: { x: 50, y: 74, align: 'center' },
    },
    pillStyle: 'outline',
    ctaChrome: 'outline',
    titleScale: 0.95,
    promoScale: 1.18,
  },
  'rainy-day-rate': {
    photo: { headline: { x: 50, y: 20, align: 'center' } },
    promo: {
      headline: { x: 50, y: 38, align: 'center' },
      promoLine: { x: 50, y: 54, align: 'center' },
      subheadline: { x: 50, y: 68, align: 'center' },
    },
    slots: KIND_DEFAULTS.slots,
    cta: KIND_DEFAULTS.cta,
    pillStyle: 'filled',
    ctaChrome: 'outline',
    promoScale: 1.1,
  },
  'one-left': {
    photo: {
      headline: { x: 50, y: 22, align: 'center' },
      subheadline: { x: 50, y: 34, align: 'center' },
    },
    promo: KIND_DEFAULTS.promo,
    slots: {
      headline: { x: 50, y: 18, align: 'center' },
      subheadline: { x: 50, y: 28, align: 'center' },
      slotLabels: { x: 50, y: 52, align: 'center' },
      ctaLine: { x: 50, y: 80, align: 'center' },
    },
    cta: {
      ctaLine: { x: 50, y: 46, align: 'center' },
      rulesLine: { x: 50, y: 66, align: 'center' },
    },
    pillStyle: 'bare',
    ctaChrome: 'outline',
    titleScale: 1.18,
  },
  'three-dates': {
    photo: {
      headline: { x: 50, y: 18, align: 'center' },
      subheadline: { x: 50, y: 30, align: 'center' },
    },
    promo: KIND_DEFAULTS.promo,
    slots: {
      headline: { x: 50, y: 20, align: 'center' },
      subheadline: { x: 50, y: 30, align: 'center' },
      slotLabels: { x: 50, y: 52, align: 'center' },
      ctaLine: { x: 50, y: 80, align: 'center' },
    },
    cta: KIND_DEFAULTS.cta,
    pillStyle: 'compact',
    ctaChrome: 'outline',
  },
  'this-weekend': {
    photo: { headline: { x: 50, y: 14, align: 'center' } },
    promo: {
      headline: { x: 50, y: 30, align: 'center' },
      promoLine: { x: 50, y: 48, align: 'center' },
      subheadline: { x: 50, y: 62, align: 'center' },
    },
    slots: {
      headline: { x: 50, y: 16, align: 'center' },
      slotLabels: { x: 50, y: 48, align: 'center' },
      ctaLine: { x: 50, y: 78, align: 'center' },
    },
    cta: {
      ctaLine: { x: 50, y: 50, align: 'center' },
      rulesLine: { x: 50, y: 68, align: 'center' },
    },
    pillStyle: 'outline',
    ctaChrome: 'filled',
    titleScale: 1.08,
  },
  'guest-love': {
    photo: { headline: { x: 50, y: 78, align: 'center' } },
    promo: {
      headline: { x: 50, y: 22, align: 'center' },
      subheadline: { x: 50, y: 48, align: 'center' },
      promoLine: { x: 50, y: 72, align: 'center' },
    },
    slots: KIND_DEFAULTS.slots,
    cta: KIND_DEFAULTS.cta,
    pillStyle: 'outline',
    ctaChrome: 'outline',
    titleScale: 0.88,
  },
  'stay-again': {
    photo: { headline: { x: 50, y: 82, align: 'center' } },
    promo: {
      headline: { x: 50, y: 28, align: 'center' },
      subheadline: { x: 50, y: 52, align: 'center' },
    },
    slots: KIND_DEFAULTS.slots,
    cta: {
      ctaLine: { x: 50, y: 50, align: 'center' },
      rulesLine: { x: 50, y: 68, align: 'center' },
    },
    pillStyle: 'outline',
    ctaChrome: 'outline',
  },
  'sold-out-stamp': {
    photo: { headline: { x: 50, y: 48, align: 'center' } },
    promo: {
      headline: { x: 50, y: 36, align: 'center' },
      subheadline: { x: 50, y: 50, align: 'center' },
      promoLine: { x: 50, y: 64, align: 'center' },
    },
    slots: KIND_DEFAULTS.slots,
    cta: {
      ctaLine: { x: 50, y: 48, align: 'center' },
      rulesLine: { x: 50, y: 64, align: 'center' },
    },
    pillStyle: 'outline',
    ctaChrome: 'outline',
    titleScale: 1.22,
  },
  'join-waitlist': {
    photo: { headline: { x: 50, y: 18, align: 'center' } },
    promo: {
      headline: { x: 50, y: 28, align: 'center' },
      subheadline: { x: 50, y: 44, align: 'center' },
      promoLine: { x: 50, y: 58, align: 'center' },
    },
    slots: KIND_DEFAULTS.slots,
    cta: {
      ctaLine: { x: 50, y: 46, align: 'center' },
      rulesLine: { x: 50, y: 64, align: 'center' },
    },
    pillStyle: 'compact',
    ctaChrome: 'filled',
  },
  'ber-months': {
    photo: { headline: { x: 50, y: 80, align: 'center' } },
    promo: {
      headline: { x: 50, y: 32, align: 'center' },
      subheadline: { x: 50, y: 46, align: 'center' },
      promoLine: { x: 50, y: 62, align: 'center' },
    },
    slots: KIND_DEFAULTS.slots,
    cta: KIND_DEFAULTS.cta,
    pillStyle: 'outline',
    ctaChrome: 'outline',
    titleScale: 1.06,
  },
  'holiday-glow': {
    photo: { headline: { x: 50, y: 20, align: 'center' } },
    promo: {
      headline: { x: 50, y: 36, align: 'center' },
      promoLine: { x: 50, y: 54, align: 'center' },
      subheadline: { x: 50, y: 68, align: 'center' },
    },
    slots: KIND_DEFAULTS.slots,
    cta: {
      ctaLine: { x: 50, y: 50, align: 'center' },
      rulesLine: { x: 50, y: 70, align: 'center' },
    },
    pillStyle: 'outline',
    ctaChrome: 'outline',
    titleScale: 1.1,
    promoScale: 1.08,
  },
};

export function resolveVideoTemplateLayout(
  templateId: string | undefined
): VideoTemplateLayoutProfile {
  if (!templateId) return { ...QUIET_COAST_FALLBACK };
  return VIDEO_TEMPLATE_LAYOUTS[templateId] ?? { ...QUIET_COAST_FALLBACK };
}

/** Deep-ish copy of the layout for one scene kind. */
export function textLayoutForTemplate(
  templateId: string | undefined,
  kind: VideoSceneKind
): LayoutMap {
  const profile = resolveVideoTemplateLayout(templateId);
  const layout = profile[kind] ?? KIND_DEFAULTS[kind];
  return Object.fromEntries(
    Object.entries(layout).map(([slot, pos]) => [slot, { ...pos }])
  ) as LayoutMap;
}
