import type { VideoTemplateFields } from '@/features/dashboard/marketing/lib/designCanvasTypes';
import type {
  VideoScene,
  VideoSceneKind,
  VideoSceneTextFields,
} from '@/features/dashboard/marketing/lib/video/videoProjectTypes';
import { applySceneKindLayers } from '@/features/dashboard/marketing/lib/video/videoSceneLayers';
import { mergeSceneTextsForKind } from '@/features/dashboard/marketing/lib/video/videoSceneTexts';
import { defaultTextLayoutForSceneKind } from '@/features/dashboard/marketing/lib/video/videoTextSlots';

export { mergeSceneTextsForKind } from '@/features/dashboard/marketing/lib/video/videoSceneTexts';

export function videoTemplateFieldsToSceneTexts(fields: VideoTemplateFields): VideoSceneTextFields {
  return {
    headline: fields.headline,
    subheadline: fields.subheadline,
    promoLine: fields.promoLine,
    ctaLine: fields.ctaLine,
    slotLabels: [...fields.slotLabels],
    rulesLine: fields.rulesLine,
  };
}

export function applySceneKindChange(
  scene: VideoScene,
  kind: VideoSceneKind,
  templateSeed?: VideoSceneTextFields,
  templateId?: string
): VideoScene {
  if (scene.kind === kind) return scene;

  const mergedTexts = mergeSceneTextsForKind(kind, scene.texts, templateSeed);
  const withKind: VideoScene = {
    ...scene,
    kind,
    texts: mergedTexts,
    textLayout: defaultTextLayoutForSceneKind(kind, templateId),
  };

  return applySceneKindLayers(withKind, kind, scene.imageUrl, templateSeed, templateId);
}
