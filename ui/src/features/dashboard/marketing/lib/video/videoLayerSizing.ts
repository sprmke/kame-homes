import type { VideoSceneLayer } from '@/features/dashboard/marketing/lib/video/videoProjectTypes';

export function layerUsesWidthPct(layer: VideoSceneLayer): boolean {
  return layer.kind === 'image' || layer.kind === 'logo';
}

export function resolveLayerWidthPct(layer: VideoSceneLayer): number {
  if (layer.kind === 'logo') return layer.widthPct ?? 28;
  if (layer.kind === 'image') return layer.widthPct ?? 42;
  return 42;
}

export function widthPctFromPointerX(
  layer: VideoSceneLayer,
  clientX: number,
  containerRect: DOMRect
): number {
  const align = layer.position.align ?? 'center';
  const anchorX = containerRect.left + (layer.position.x / 100) * containerRect.width;
  let widthPx: number;
  if (align === 'center') {
    widthPx = Math.abs(clientX - anchorX) * 2;
  } else if (align === 'right') {
    widthPx = Math.max(0, anchorX - clientX);
  } else {
    widthPx = Math.max(0, clientX - anchorX);
  }
  const pct = (widthPx / containerRect.width) * 100;
  return Math.round(Math.min(90, Math.max(8, pct)));
}
