import type { CSSProperties, ReactNode } from 'react';

import {
  layerUsesWidthPct,
  resolveLayerWidthPct,
} from '@/features/dashboard/marketing/lib/video/videoLayerSizing';
import type { VideoScene } from '@/features/dashboard/marketing/lib/video/videoProjectTypes';
import type { VideoSceneLayer } from '@/features/dashboard/marketing/lib/video/videoProjectTypes';
import {
  type VideoTextSlotId,
  resolveTextSlotPosition,
} from '@/features/dashboard/marketing/lib/video/videoTextSlots';

function horizontalTranslate(align: 'left' | 'center' | 'right'): string {
  if (align === 'center') return '-50%';
  if (align === 'right') return '-100%';
  return '0';
}

/** Scale typography/layout from composition pixels to the on-screen preview frame. */
export function overlayDisplayScale(previewWidthPx: number, compositionWidth: number): number {
  if (compositionWidth <= 0 || previewWidthPx <= 0) return 1;
  return previewWidthPx / compositionWidth;
}

export function overlayPositionedLayerStyle(
  layer: VideoSceneLayer,
  compositionScale: number,
  previewWidthPx: number,
  compositionWidth: number
): CSSProperties {
  const align = layer.position.align ?? 'center';
  const widthPct = layerUsesWidthPct(layer) ? resolveLayerWidthPct(layer) : undefined;
  const displayScale = overlayDisplayScale(previewWidthPx, compositionWidth);
  const scaledMax = Math.round(900 * compositionScale * displayScale);
  const maxWidthPx = Math.min(scaledMax, previewWidthPx);

  return {
    position: 'absolute',
    left: `${layer.position.x}%`,
    top: `${layer.position.y}%`,
    transform: `translate(${horizontalTranslate(align)}, -50%)`,
    maxWidth: widthPct ? `${widthPct}%` : `${maxWidthPx}px`,
    width: layer.kind === 'slots' ? `${maxWidthPx}px` : widthPct ? `${widthPct}%` : 'max-content',
    textAlign: align,
  };
}

export function positionedLayerStyle(
  layer: VideoSceneLayer,
  scale: number,
  enterOffset = 0,
  enterOffsetX = 0
): CSSProperties {
  const align = layer.position.align ?? 'center';
  const widthPct = layerUsesWidthPct(layer) ? resolveLayerWidthPct(layer) : undefined;
  return {
    position: 'absolute',
    left: `${layer.position.x}%`,
    top: `${layer.position.y}%`,
    transform: `translate(${horizontalTranslate(align)}, -50%) translate(${enterOffsetX}px, ${enterOffset}px)`,
    maxWidth: widthPct ? `${widthPct}%` : `${Math.round(900 * scale)}px`,
    width:
      layer.kind === 'slots'
        ? `${Math.round(900 * scale)}px`
        : widthPct
          ? `${widthPct}%`
          : 'max-content',
    textAlign: align,
  };
}

export function layerHitZoneStyle(layer: VideoSceneLayer): CSSProperties {
  const align = layer.position.align ?? 'center';
  const widthPct = layerUsesWidthPct(layer) ? resolveLayerWidthPct(layer) : undefined;
  return {
    position: 'absolute',
    left: `${layer.position.x}%`,
    top: `${layer.position.y}%`,
    transform: `translate(${horizontalTranslate(align)}, -50%)`,
    width: widthPct ? `${widthPct}%` : layer.kind === 'slots' ? '88%' : 'max-content',
    minWidth: layerUsesWidthPct(layer) ? '48px' : '120px',
    textAlign: align,
  };
}

export function PositionedLayer({
  layer,
  scale,
  enterOffset = 0,
  enterOffsetX = 0,
  children,
}: {
  layer: VideoSceneLayer;
  scale: number;
  enterOffset?: number;
  enterOffsetX?: number;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        ...positionedLayerStyle(layer, scale, enterOffset, enterOffsetX),
        pointerEvents: 'none',
      }}
    >
      {children}
    </div>
  );
}

export function positionedSlotStyle(
  scene: VideoScene,
  slot: VideoTextSlotId,
  scale: number,
  enterOffset = 0
): CSSProperties {
  const position = resolveTextSlotPosition(scene, slot);
  const align = position.align ?? 'center';
  return {
    position: 'absolute',
    left: `${position.x}%`,
    top: `${position.y}%`,
    transform: `translate(${horizontalTranslate(align)}, -50%) translateY(${enterOffset}px)`,
    maxWidth: `${Math.round(900 * scale)}px`,
    width: slot === 'slotLabels' ? `${Math.round(900 * scale)}px` : 'max-content',
    textAlign: align,
  };
}

/** Hit area for editor drag — same anchor as composition text, no duplicate rendering. */
export function textSlotHitZoneStyle(scene: VideoScene, slot: VideoTextSlotId): CSSProperties {
  const position = resolveTextSlotPosition(scene, slot);
  const align = position.align ?? 'center';
  return {
    position: 'absolute',
    left: `${position.x}%`,
    top: `${position.y}%`,
    transform: `translate(${horizontalTranslate(align)}, -50%)`,
    textAlign: align,
  };
}

export function PositionedTextSlot({
  scene,
  slot,
  scale,
  enterOffset = 0,
  children,
}: {
  scene: VideoScene;
  slot: VideoTextSlotId;
  scale: number;
  enterOffset?: number;
  children: ReactNode;
}) {
  return (
    <div style={{ ...positionedSlotStyle(scene, slot, scale, enterOffset), pointerEvents: 'none' }}>
      {children}
    </div>
  );
}
