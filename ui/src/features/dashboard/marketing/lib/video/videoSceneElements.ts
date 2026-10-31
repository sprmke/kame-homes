import type {
  VideoScene,
  VideoSceneElementId,
  VideoSceneKind,
  VideoSceneTextFields,
} from '@/features/dashboard/marketing/lib/video/videoProjectTypes';
import { mergeSceneTextsForKind } from '@/features/dashboard/marketing/lib/video/videoSceneTexts';
import {
  VIDEO_TEXT_SLOT_LABELS,
  defaultTextLayoutForSceneKind,
  textSlotsForSceneKind,
  isVideoTextSlotId,
  type VideoTextSlotId,
} from '@/features/dashboard/marketing/lib/video/videoTextSlots';

export type { VideoSceneElementId } from '@/features/dashboard/marketing/lib/video/videoProjectTypes';

export const VIDEO_ELEMENT_LABELS: Record<VideoSceneElementId, string> = {
  background: 'Background',
  ...VIDEO_TEXT_SLOT_LABELS,
};

/** Elements that can be added for a layout (includes optional extras beyond default positions). */
const ELEMENTS_CATALOG_BY_KIND: Record<VideoSceneKind, VideoSceneElementId[]> = {
  photo: ['background', 'headline'],
  promo: ['background', 'headline', 'subheadline', 'promoLine', 'ctaLine', 'rulesLine'],
  slots: ['background', 'headline', 'subheadline', 'slotLabels', 'ctaLine', 'rulesLine'],
  cta: ['background', 'ctaLine', 'rulesLine'],
};

export function elementsCatalogForKind(kind: VideoSceneKind): VideoSceneElementId[] {
  return ELEMENTS_CATALOG_BY_KIND[kind];
}

/** Default visible elements when a layout is applied (matches composition defaults). */
export function defaultActiveElementsForKind(kind: VideoSceneKind): VideoSceneElementId[] {
  return ['background', ...textSlotsForSceneKind(kind)];
}

export function defaultHiddenElementsForKind(kind: VideoSceneKind): VideoSceneElementId[] {
  const catalog = elementsCatalogForKind(kind);
  const defaults = new Set(defaultActiveElementsForKind(kind));
  return catalog.filter((id) => !defaults.has(id));
}

export function resolvedHiddenElements(scene: VideoScene): VideoSceneElementId[] {
  return scene.hiddenElements ?? defaultHiddenElementsForKind(scene.kind);
}

export function activeElementsForScene(scene: VideoScene): VideoSceneElementId[] {
  const hidden = new Set(resolvedHiddenElements(scene));
  return elementsCatalogForKind(scene.kind).filter((id) => !hidden.has(id));
}

export function inactiveElementsForScene(scene: VideoScene): VideoSceneElementId[] {
  const active = new Set(activeElementsForScene(scene));
  return elementsCatalogForKind(scene.kind).filter((id) => !active.has(id));
}

export function sceneElementIsActive(scene: VideoScene, elementId: VideoSceneElementId): boolean {
  return activeElementsForScene(scene).includes(elementId);
}

export function sceneBackgroundIsActive(scene: VideoScene): boolean {
  return sceneElementIsActive(scene, 'background');
}

export function slotIsActive(scene: VideoScene, slot: VideoTextSlotId): boolean {
  if (!textSlotsForSceneKind(scene.kind).includes(slot)) {
    return elementsCatalogForKind(scene.kind).includes(slot) && sceneElementIsActive(scene, slot);
  }
  return sceneElementIsActive(scene, slot);
}

function emptyTexts(): VideoSceneTextFields {
  return {
    headline: '',
    subheadline: '',
    promoLine: '',
    ctaLine: '',
    slotLabels: [],
    rulesLine: '',
  };
}

function clearSlotText(texts: VideoSceneTextFields, slot: VideoTextSlotId): VideoSceneTextFields {
  if (slot === 'slotLabels') {
    return { ...texts, slotLabels: [] };
  }
  return { ...texts, [slot]: '' };
}

function defaultTextsForKind(
  kind: VideoSceneKind,
  templateSeed?: VideoSceneTextFields
): VideoSceneTextFields {
  return mergeSceneTextsForKind(kind, emptyTexts(), templateSeed);
}

function ensureSlotLayout(scene: VideoScene, slot: VideoTextSlotId): VideoScene {
  if (scene.textLayout?.[slot]) return scene;
  const kindDefaults = defaultTextLayoutForSceneKind(scene.kind);
  const fallback = defaultTextLayoutForSceneKind('promo')[slot] ??
    defaultTextLayoutForSceneKind('cta')[slot] ?? { x: 50, y: 50, align: 'center' as const };
  return {
    ...scene,
    textLayout: {
      ...scene.textLayout,
      ...defaultTextLayoutForSceneKind(scene.kind),
      [slot]: kindDefaults[slot] ?? fallback,
    },
  };
}

export function removeSceneElement(scene: VideoScene, elementId: VideoSceneElementId): VideoScene {
  const hidden = new Set(scene.hiddenElements ?? []);
  hidden.add(elementId);

  let next: VideoScene = {
    ...scene,
    hiddenElements: [...hidden],
  };

  if (elementId === 'background') {
    next = { ...next, imageUrl: null };
  } else if (isVideoTextSlotId(elementId)) {
    next = { ...next, texts: clearSlotText(next.texts, elementId) };
  }

  return next;
}

export function addSceneElement(
  scene: VideoScene,
  elementId: VideoSceneElementId,
  templateSeed?: VideoSceneTextFields
): VideoScene {
  const hidden = new Set(scene.hiddenElements ?? []);
  hidden.delete(elementId);

  let next: VideoScene = {
    ...scene,
    hiddenElements: [...hidden],
  };

  if (elementId !== 'background' && isVideoTextSlotId(elementId)) {
    const defaults = defaultTextsForKind(scene.kind, templateSeed);
    const slot = elementId;
    const current = next.texts;
    if (slot === 'slotLabels') {
      if (current.slotLabels.length === 0) {
        next = { ...next, texts: { ...current, slotLabels: [...defaults.slotLabels] } };
      }
    } else if (!current[slot].trim()) {
      next = { ...next, texts: { ...current, [slot]: defaults[slot] } };
    }
    next = ensureSlotLayout(next, slot);
  }

  return next;
}

export function removeAllSceneElements(scene: VideoScene): VideoScene {
  return {
    ...scene,
    hiddenElements: elementsCatalogForKind(scene.kind),
    imageUrl: null,
    texts: emptyTexts(),
  };
}

export function normalizeSceneElements(scene: VideoScene): VideoScene {
  return {
    ...scene,
    hiddenElements: scene.hiddenElements ?? defaultHiddenElementsForKind(scene.kind),
  };
}

export function activeTextSlotsForScene(scene: VideoScene): VideoTextSlotId[] {
  return elementsCatalogForKind(scene.kind).filter(
    (id): id is VideoTextSlotId => id !== 'background' && sceneElementIsActive(scene, id)
  );
}
