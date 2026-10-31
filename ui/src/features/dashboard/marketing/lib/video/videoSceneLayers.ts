import { inferBackgroundMediaType } from '@/features/dashboard/marketing/lib/propertyBindingMedia';
import { buildTypographyFromPreset } from '@/features/dashboard/marketing/lib/video/videoLayerTypography';
import type {
  VideoScene,
  VideoSceneKind,
  VideoSceneLayer,
  VideoSceneTextFields,
  VideoTextStyle,
} from '@/features/dashboard/marketing/lib/video/videoProjectTypes';
import { mergeSceneTextsForKind } from '@/features/dashboard/marketing/lib/video/videoSceneTexts';
import type { VideoTypographyContext } from '@/features/dashboard/marketing/lib/video/videoTemplateTypography';
import {
  defaultTextLayoutForSceneKind,
  textSlotsForSceneKind,
} from '@/features/dashboard/marketing/lib/video/videoTextSlots';

export function createLayerId(): string {
  return `layer-${crypto.randomUUID().slice(0, 8)}`;
}

const BACKGROUND_LAYER_ID = 'layer-background';

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

function slotToTextStyle(slot: string): VideoTextStyle {
  switch (slot) {
    case 'subheadline':
      return 'subheadline';
    case 'promoLine':
      return 'promo';
    case 'rulesLine':
      return 'footer';
    case 'ctaLine':
      return 'body';
    default:
      return 'headline';
  }
}

function defaultHiddenSlotsForKind(kind: VideoSceneKind): string[] {
  const catalog = [
    'background',
    'headline',
    'subheadline',
    'promoLine',
    'ctaLine',
    'rulesLine',
    'slotLabels',
    ...textSlotsForSceneKind(kind),
  ].filter((id, index, arr) => arr.indexOf(id) === index);
  const defaults = new Set(['background', ...textSlotsForSceneKind(kind)]);
  return catalog.filter((id) => !defaults.has(id));
}

/** Build layers from legacy texts / imageUrl / hiddenElements. */
export function migrateLegacySceneToLayers(scene: VideoScene): VideoSceneLayer[] {
  // Prefer explicit host hides. When absent, infer from kind — but never hide a
  // slot that still has storyboard/host text (Quiet Coast photo amenity beats).
  const inferredHidden = defaultHiddenSlotsForKind(scene.kind);
  const explicitHidden = scene.hiddenElements;
  const layers: VideoSceneLayer[] = [];
  const layout = scene.textLayout ?? defaultTextLayoutForSceneKind(scene.kind);

  const isHidden = (slot: string, hasContent: boolean) => {
    if (explicitHidden !== undefined) return explicitHidden.includes(slot);
    if (hasContent) return false;
    return inferredHidden.includes(slot);
  };

  if (!isHidden('background', true)) {
    layers.push({
      id: BACKGROUND_LAYER_ID,
      kind: 'background',
      imageUrl: scene.imageUrl,
      mediaType: scene.backgroundMediaType ?? inferBackgroundMediaType(scene.imageUrl),
      position: { x: 50, y: 50, align: 'center' },
    });
  }

  const addTextLayer = (slot: string, text: string, kind: VideoSceneLayer['kind'] = 'text') => {
    const trimmed = text.trim();
    if (!trimmed || isHidden(slot, true)) return;
    const pos = layout[slot as keyof typeof layout];
    layers.push({
      id: `layer-${slot}`,
      kind,
      text,
      textStyle: slot === 'ctaLine' ? undefined : slotToTextStyle(slot),
      position: {
        x: pos?.x ?? 50,
        y: pos?.y ?? 50,
        align: pos?.align ?? 'center',
      },
    });
  };

  if (scene.texts.slotLabels.some((label) => label.trim()) && !isHidden('slotLabels', true)) {
    const pos = layout.slotLabels;
    layers.push({
      id: 'layer-slotLabels',
      kind: 'slots',
      lines: [...scene.texts.slotLabels],
      position: {
        x: pos?.x ?? 50,
        y: pos?.y ?? 55,
        align: pos?.align ?? 'center',
      },
    });
  }

  addTextLayer('headline', scene.texts.headline);
  addTextLayer('subheadline', scene.texts.subheadline);
  addTextLayer('promoLine', scene.texts.promoLine);
  addTextLayer('ctaLine', scene.texts.ctaLine, 'cta');
  addTextLayer('rulesLine', scene.texts.rulesLine);

  return layers;
}

export function getSceneLayers(scene: VideoScene): VideoSceneLayer[] {
  if (scene.layers !== undefined) {
    return scene.layers;
  }
  return migrateLegacySceneToLayers(scene);
}

function legacyFieldsFromLayers(
  layers: VideoSceneLayer[],
  kind: VideoSceneKind,
  priorLayout?: VideoScene['textLayout'],
  templateId?: string
): Pick<
  VideoScene,
  'imageUrl' | 'backgroundMediaType' | 'texts' | 'textLayout' | 'hiddenElements'
> {
  const texts = emptyTexts();
  const textLayout = {
    ...defaultTextLayoutForSceneKind(kind, templateId),
    ...priorLayout,
  };
  const hidden: string[] = [];

  const bg = layers.find((layer) => layer.kind === 'background');
  if (!bg) {
    hidden.push('background');
  }

  const catalog = new Set([
    'background',
    ...textSlotsForSceneKind(kind),
    'headline',
    'subheadline',
    'promoLine',
    'ctaLine',
    'rulesLine',
    'slotLabels',
  ]);

  for (const layer of layers) {
    if (layer.kind === 'background') continue;

    if (layer.kind === 'slots' && layer.lines?.length) {
      texts.slotLabels = [...layer.lines];
      textLayout.slotLabels = { ...layer.position };
      continue;
    }

    if (layer.kind === 'cta' && layer.text?.trim()) {
      texts.ctaLine = layer.text;
      textLayout.ctaLine = { ...layer.position };
      continue;
    }

    if (layer.kind === 'text' && layer.text?.trim()) {
      const style = layer.textStyle ?? 'headline';
      if (style === 'headline') {
        texts.headline = layer.text;
        textLayout.headline = { ...layer.position };
      } else if (style === 'subheadline') {
        texts.subheadline = layer.text;
        textLayout.subheadline = { ...layer.position };
      } else if (style === 'promo') {
        texts.promoLine = layer.text;
        textLayout.promoLine = { ...layer.position };
      } else if (style === 'footer') {
        texts.rulesLine = layer.text;
        textLayout.rulesLine = { ...layer.position };
      } else if (!texts.ctaLine) {
        texts.ctaLine = layer.text;
        textLayout.ctaLine = { ...layer.position };
      }
    }
  }

  for (const slot of catalog) {
    if (slot === 'background') continue;
    if (slot === 'headline' && !texts.headline) hidden.push(slot);
    if (slot === 'subheadline' && !texts.subheadline) hidden.push(slot);
    if (slot === 'promoLine' && !texts.promoLine) hidden.push(slot);
    if (slot === 'ctaLine' && !texts.ctaLine) hidden.push(slot);
    if (slot === 'rulesLine' && !texts.rulesLine) hidden.push(slot);
    if (slot === 'slotLabels' && texts.slotLabels.length === 0) hidden.push(slot);
  }

  return {
    imageUrl: bg?.imageUrl ?? null,
    backgroundMediaType: bg?.mediaType ?? inferBackgroundMediaType(bg?.imageUrl),
    texts,
    textLayout,
    hiddenElements: hidden,
  };
}

export function persistSceneLayers(scene: VideoScene, layers: VideoSceneLayer[]): VideoScene {
  const legacy = legacyFieldsFromLayers(layers, scene.kind, scene.textLayout);
  return {
    ...scene,
    layers,
    ...legacy,
  };
}

export function normalizeSceneLayers(scene: VideoScene): VideoScene {
  const layers = getSceneLayers(scene);
  return persistSceneLayers(scene, layers);
}

/**
 * Build layers from whatever text the storyboard (or host) put on the scene.
 * Quiet Coast recipes put amenity words / offer lines on `photo` and `cta`
 * clips — kind alone must not drop those beats.
 *
 * When `templateSeed` is provided it is authoritative (storyboard beats only).
 * Generic kind fillers are used only when seeding a blank scene with no seed.
 */
export function defaultLayersForKind(
  kind: VideoSceneKind,
  imageUrl: string | null,
  templateSeed?: VideoSceneTextFields,
  templateId?: string
): VideoSceneLayer[] {
  const texts = templateSeed
    ? {
        headline: templateSeed.headline ?? '',
        subheadline: templateSeed.subheadline ?? '',
        promoLine: templateSeed.promoLine ?? '',
        ctaLine: templateSeed.ctaLine ?? '',
        slotLabels: [...(templateSeed.slotLabels ?? [])],
        rulesLine: templateSeed.rulesLine ?? '',
      }
    : mergeSceneTextsForKind(kind, emptyTexts());
  const layout = defaultTextLayoutForSceneKind(kind, templateId);
  const layers: VideoSceneLayer[] = [
    {
      id: BACKGROUND_LAYER_ID,
      kind: 'background',
      imageUrl,
      mediaType: inferBackgroundMediaType(imageUrl),
      position: { x: 50, y: 50, align: 'center' },
    },
  ];

  const pushText = (
    slot: 'headline' | 'subheadline' | 'promoLine' | 'ctaLine' | 'rulesLine',
    text: string,
    textStyle: VideoTextStyle,
    layerKind: VideoSceneLayer['kind'] = 'text'
  ) => {
    if (!text.trim()) return;
    const pos = layout[slot] ?? { x: 50, y: 50, align: 'center' as const };
    layers.push({
      id: createLayerId(),
      kind: layerKind,
      text,
      textStyle: layerKind === 'text' ? textStyle : undefined,
      position: { ...pos },
    });
  };

  pushText('headline', texts.headline, 'headline');
  pushText('subheadline', texts.subheadline, 'subheadline');
  pushText('promoLine', texts.promoLine, 'promo');

  if (texts.slotLabels.length > 0) {
    const pos = layout.slotLabels ?? { x: 50, y: 55, align: 'center' as const };
    layers.push({
      id: createLayerId(),
      kind: 'slots',
      lines: [...texts.slotLabels],
      position: { ...pos },
    });
  }

  pushText('ctaLine', texts.ctaLine, 'body', 'cta');
  pushText('rulesLine', texts.rulesLine, 'footer');

  return layers;
}

export function sceneBackgroundLayer(scene: VideoScene): VideoSceneLayer | undefined {
  return getSceneLayers(scene).find((layer) => layer.kind === 'background');
}

export function sceneBackgroundIsActive(scene: VideoScene): boolean {
  return Boolean(sceneBackgroundLayer(scene));
}

export function overlayLayersForScene(scene: VideoScene): VideoSceneLayer[] {
  return getSceneLayers(scene).filter((layer) => layer.kind !== 'background');
}

export function layerLabel(layer: VideoSceneLayer, index: number): string {
  if (layer.kind === 'background') return 'Background';
  if (layer.kind === 'image') return `Image ${index}`;
  if (layer.kind === 'logo') return `Logo ${index}`;
  if (layer.kind === 'cta') return `CTA ${index}`;
  if (layer.kind === 'slots') return `Slots ${index}`;
  const style = layer.textStyle ?? 'headline';
  const labels: Record<VideoTextStyle, string> = {
    headline: 'Headline',
    subheadline: 'Subheadline',
    promo: 'Promo',
    body: 'Text',
    footer: 'Footer',
  };
  return `${labels[style]} ${index}`;
}

export function addSceneLayer(
  scene: VideoScene,
  kind: 'text' | 'cta' | 'image' | 'logo' | 'background',
  options: {
    imageUrl?: string | null;
    logoUrl?: string | null;
    templateSeed?: VideoSceneTextFields;
    typography: VideoTypographyContext;
  }
): VideoScene {
  const layers = [...getSceneLayers(scene)];
  const typography = options.typography;

  if (kind === 'background') {
    if (layers.some((layer) => layer.kind === 'background')) {
      return scene;
    }
    layers.unshift({
      id: BACKGROUND_LAYER_ID,
      kind: 'background',
      imageUrl: options.imageUrl ?? scene.imageUrl,
      mediaType:
        scene.backgroundMediaType ?? inferBackgroundMediaType(options.imageUrl ?? scene.imageUrl),
      position: { x: 50, y: 50, align: 'center' },
    });
    return persistSceneLayers(scene, layers);
  }

  const defaults = mergeSceneTextsForKind(scene.kind, emptyTexts(), options.templateSeed);

  if (kind === 'text') {
    layers.push({
      id: createLayerId(),
      kind: 'text',
      text: defaults.headline || 'YOUR TEXT',
      textStyle: 'headline',
      typography: buildTypographyFromPreset('title', typography),
      position: { x: 50, y: 42, align: 'center' },
    });
  } else if (kind === 'cta') {
    layers.push({
      id: createLayerId(),
      kind: 'cta',
      text: defaults.ctaLine || 'BOOK NOW',
      typography: buildTypographyFromPreset('cta', typography),
      position: { x: 50, y: 72, align: 'center' },
    });
  } else if (kind === 'image') {
    layers.push({
      id: createLayerId(),
      kind: 'image',
      imageUrl: options.imageUrl ?? null,
      widthPct: 42,
      position: { x: 50, y: 48, align: 'center' },
    });
  } else if (kind === 'logo') {
    layers.push({
      id: createLayerId(),
      kind: 'logo',
      imageUrl: options.logoUrl ?? null,
      widthPct: 28,
      position: { x: 50, y: 12, align: 'center' },
    });
  }

  return persistSceneLayers(scene, layers);
}

export function removeSceneLayer(scene: VideoScene, layerId: string): VideoScene {
  const layers = getSceneLayers(scene).filter((layer) => layer.id !== layerId);
  return persistSceneLayers(scene, layers);
}

export function updateSceneLayer(
  scene: VideoScene,
  layerId: string,
  patch: Partial<VideoSceneLayer>
): VideoScene {
  const layers = getSceneLayers(scene).map((layer) =>
    layer.id === layerId ? { ...layer, ...patch } : layer
  );
  return persistSceneLayers(scene, layers);
}

export function updateSceneLayerPosition(
  scene: VideoScene,
  layerId: string,
  position: VideoSceneLayer['position']
): VideoScene {
  return updateSceneLayer(scene, layerId, { position });
}

export function removeAllSceneLayers(scene: VideoScene): VideoScene {
  return persistSceneLayers(scene, []);
}

export function applySceneKindLayers(
  scene: VideoScene,
  kind: VideoSceneKind,
  imageUrl: string | null,
  templateSeed?: VideoSceneTextFields,
  templateId?: string
): VideoScene {
  return persistSceneLayers(scene, defaultLayersForKind(kind, imageUrl, templateSeed, templateId));
}
