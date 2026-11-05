import type { CanvasPatch } from '@/features/dashboard/marketing/components/video-editor/v2/VideoCanvasOverlayV2';
import { updateItem } from '@/features/dashboard/marketing/lib/video/v2/timelineOps';
import {
  isLayerItem,
  isMediaItem,
  type VideoProjectV2,
} from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';

/** Apply a canvas drag/resize/rotate result to the project. Unchanged when the item is gone. */
export function applyCanvasPatch(project: VideoProjectV2, patch: CanvasPatch): VideoProjectV2 {
  const result = updateItem(project, patch.itemId, (item) => {
    switch (patch.kind) {
      case 'layer-position':
        return isLayerItem(item)
          ? { ...item, layer: { ...item.layer, position: patch.position } }
          : item;
      case 'layer-width':
        return isLayerItem(item)
          ? { ...item, layer: { ...item.layer, widthPct: patch.widthPct } }
          : item;
      case 'transform':
        return isMediaItem(item)
          ? { ...item, transform: { ...item.transform, ...patch.transform } }
          : item;
    }
  });
  return result.ok ? result.project : project;
}
