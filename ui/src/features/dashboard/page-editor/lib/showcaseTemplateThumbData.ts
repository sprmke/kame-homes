import type { ResolvedPropertyDetail } from '@/features/guest/marketing/properties/types/publicProperty';
import { mapShowcaseData } from '@/features/guest/marketing/showcase/lib/mapShowcaseData';
import type {
  PropertyShowcaseConfig,
  ShowcaseData,
  ShowcaseTemplateKey,
} from '@/features/guest/marketing/showcase/types/showcase';

/** Matches PageEditorPreviewPane mobile frame width. */
export const SHOWCASE_TEMPLATE_THUMB_FRAME_WIDTH = 420;

/** Clip height so scaled preview fills the 5:8 thumb frame (420 × 8/5). */
export const SHOWCASE_TEMPLATE_THUMB_CLIP_HEIGHT = 672;

export function buildShowcaseTemplateThumbData(
  property: ResolvedPropertyDetail,
  config: PropertyShowcaseConfig,
  templateKey: ShowcaseTemplateKey
): ShowcaseData {
  const mapped = mapShowcaseData({
    property,
    config,
    templateKey,
    previewPlaceholders: true,
  });

  return {
    ...mapped,
    embed: true,
    reducedMotion: true,
    config: {
      ...mapped.config,
      motion: {
        ...mapped.config.motion,
        parallax: false,
        canvas: false,
        intensity: 'subtle',
      },
    },
  };
}
