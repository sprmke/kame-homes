import type {
  VideoScene,
  VideoSceneKind,
} from '@/features/dashboard/marketing/lib/video/videoProjectTypes';
import { textLayoutForTemplate } from '@/features/dashboard/marketing/lib/video/videoTemplateLayouts';

export type VideoTextSlotId =
  'headline' | 'subheadline' | 'promoLine' | 'ctaLine' | 'rulesLine' | 'slotLabels';

export type VideoTextAlign = 'left' | 'center' | 'right';

export type VideoTextSlotPosition = {
  /** 0–100, percentage from left edge */
  x: number;
  /** 0–100, percentage from top edge */
  y: number;
  align?: VideoTextAlign;
};

export type VideoSceneTextLayout = Partial<Record<VideoTextSlotId, VideoTextSlotPosition>>;

export const VIDEO_TEXT_SLOT_LABELS: Record<VideoTextSlotId, string> = {
  headline: 'Headline',
  subheadline: 'Subheadline',
  promoLine: 'Promo',
  ctaLine: 'CTA',
  rulesLine: 'Footer',
  slotLabels: 'Slots',
};

const DEFAULT_LAYOUT_BY_KIND: Record<VideoSceneKind, VideoSceneTextLayout> = {
  photo: {
    headline: { x: 50, y: 88, align: 'center' },
    /** Quiet Coast amenity / caption beats on b-roll. */
    subheadline: { x: 50, y: 52, align: 'center' },
    promoLine: { x: 50, y: 52, align: 'center' },
    rulesLine: { x: 50, y: 88, align: 'center' },
  },
  promo: {
    headline: { x: 50, y: 42, align: 'center' },
    subheadline: { x: 50, y: 52, align: 'center' },
    promoLine: { x: 50, y: 62, align: 'center' },
  },
  slots: {
    headline: { x: 50, y: 28, align: 'center' },
    subheadline: { x: 50, y: 38, align: 'center' },
    slotLabels: { x: 50, y: 55, align: 'center' },
    ctaLine: { x: 50, y: 78, align: 'center' },
  },
  cta: {
    promoLine: { x: 50, y: 36, align: 'center' },
    ctaLine: { x: 50, y: 48, align: 'center' },
    rulesLine: { x: 50, y: 68, align: 'center' },
  },
};

export function textSlotsForSceneKind(kind: VideoSceneKind): VideoTextSlotId[] {
  return Object.keys(DEFAULT_LAYOUT_BY_KIND[kind]) as VideoTextSlotId[];
}

const VIDEO_TEXT_SLOT_IDS = new Set<string>([
  'headline',
  'subheadline',
  'promoLine',
  'ctaLine',
  'rulesLine',
  'slotLabels',
]);

export function isVideoTextSlotId(id: string): id is VideoTextSlotId {
  return VIDEO_TEXT_SLOT_IDS.has(id);
}

/**
 * Default positions for a scene kind. Pass `templateId` so each campaign preset
 * seeds a distinct composition (Quiet Coast parity).
 */
export function defaultTextLayoutForSceneKind(
  kind: VideoSceneKind,
  templateId?: string
): VideoSceneTextLayout {
  if (templateId) {
    return textLayoutForTemplate(templateId, kind) as VideoSceneTextLayout;
  }
  return { ...DEFAULT_LAYOUT_BY_KIND[kind] };
}

export function resolveTextSlotPosition(
  scene: VideoScene,
  slot: VideoTextSlotId
): VideoTextSlotPosition {
  const fromScene = scene.textLayout?.[slot];
  const fallback = DEFAULT_LAYOUT_BY_KIND[scene.kind][slot];
  return {
    x: fromScene?.x ?? fallback?.x ?? 50,
    y: fromScene?.y ?? fallback?.y ?? 50,
    align: fromScene?.align ?? fallback?.align ?? 'center',
  };
}

export function normalizeSceneTextLayout(scene: VideoScene): VideoScene {
  const defaults = defaultTextLayoutForSceneKind(scene.kind);
  return {
    ...scene,
    textLayout: {
      ...defaults,
      ...scene.textLayout,
    },
  };
}

export function slotPreviewText(scene: VideoScene, slot: VideoTextSlotId): string {
  const texts = scene.texts;
  switch (slot) {
    case 'headline':
      return texts.headline || VIDEO_TEXT_SLOT_LABELS.headline;
    case 'subheadline':
      return texts.subheadline || VIDEO_TEXT_SLOT_LABELS.subheadline;
    case 'promoLine':
      return texts.promoLine || VIDEO_TEXT_SLOT_LABELS.promoLine;
    case 'ctaLine':
      return texts.ctaLine || VIDEO_TEXT_SLOT_LABELS.ctaLine;
    case 'rulesLine':
      return texts.rulesLine || VIDEO_TEXT_SLOT_LABELS.rulesLine;
    case 'slotLabels':
      return texts.slotLabels.length > 0
        ? texts.slotLabels.join(' · ')
        : VIDEO_TEXT_SLOT_LABELS.slotLabels;
    default:
      return '';
  }
}
