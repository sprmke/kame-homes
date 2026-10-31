import type {
  ShowcaseData,
  ShowcaseTemplateKey,
} from '@/features/guest/marketing/showcase/types/showcase';
import type { GuestStayGuideDto } from '@/features/guest/stay-guide/lib/api';
import { mapStayGuideData } from '@/features/guest/stay-guide/lib/mapStayGuideData';
import type { StayGuideConfigV2 } from '@/features/guest/stay-guide/lib/stayGuideConfig';

/** Matches PageEditorPreviewPane mobile frame width (same as Showcase thumbs). */
export const STAY_GUIDE_TEMPLATE_THUMB_FRAME_WIDTH = 420;

/** Clip height so the scaled preview fills the 5:8 thumb frame (420 × 8/5). */
export const STAY_GUIDE_TEMPLATE_THUMB_CLIP_HEIGHT = 672;

/** Build an inert, motion-toned `ShowcaseData` for a Stay Guide template picker thumbnail. */
export function buildStayGuideTemplateThumbData(
  dto: GuestStayGuideDto,
  config: StayGuideConfigV2,
  templateKey: ShowcaseTemplateKey
): ShowcaseData {
  const mapped = mapStayGuideData({
    dto: { ...dto, templateKey },
    config,
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
