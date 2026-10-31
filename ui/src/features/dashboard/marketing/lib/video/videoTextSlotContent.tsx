import type { VideoScene } from '@/features/dashboard/marketing/lib/video/videoProjectTypes';
import { slotIsActive } from '@/features/dashboard/marketing/lib/video/videoSceneElements';
import type { VideoTextSlotId } from '@/features/dashboard/marketing/lib/video/videoTextSlots';

export function scaleForVideoFormat(width: number, height: number): number {
  const base = 1080;
  return Math.min(width / base, height / base, 1.35);
}

export function slotHasVisibleText(scene: VideoScene, slot: VideoTextSlotId): boolean {
  if (!slotIsActive(scene, slot)) return false;
  const { texts } = scene;
  switch (slot) {
    case 'headline':
      return Boolean(texts.headline?.trim());
    case 'subheadline':
      return Boolean(texts.subheadline?.trim());
    case 'promoLine':
      return Boolean(texts.promoLine?.trim());
    case 'ctaLine':
      return Boolean(texts.ctaLine?.trim());
    case 'rulesLine':
      return Boolean(texts.rulesLine?.trim());
    case 'slotLabels':
      return texts.slotLabels.some((label) => label.trim().length > 0);
    default:
      return false;
  }
}
