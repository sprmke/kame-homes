import { useCallback, useMemo, useRef, useState } from 'react';

import { VideoTextPositionOverlay } from '@/features/dashboard/marketing/components/video-editor/VideoTextPositionOverlay';
import {
  moveTransform,
  pxDeltaToPct,
  resizedWidthPct,
  rotationFromPointer,
  safeAreaGuides,
  type Guide,
} from '@/features/dashboard/marketing/lib/video/v2/canvasTransformMath';
import { overlayAspect } from '@/features/dashboard/marketing/lib/video/v2/clipStyles';
import { itemsActiveAt } from '@/features/dashboard/marketing/lib/video/v2/timelineTiming';
import {
  isLayerItem,
  isMediaItem,
  type LayerItem,
  type MediaItem,
  type VideoProjectV2,
  type VisualTransform,
} from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';
import type {
  VideoLayerPosition,
  VideoScene,
} from '@/features/dashboard/marketing/lib/video/videoProjectTypes';
import type { VideoTypographyContext } from '@/features/dashboard/marketing/lib/video/videoTemplateTypography';

import { cn } from '@/lib/utils';

export type CanvasPatch =
  | { kind: 'layer-position'; itemId: string; position: VideoLayerPosition }
  | { kind: 'layer-width'; itemId: string; widthPct: number }
  | { kind: 'transform'; itemId: string; transform: Partial<VisualTransform> };

type Props = {
  project: VideoProjectV2;
  frame: number;
  selectedIds: string[];
  typography: VideoTypographyContext;
  compositionScale: number;
  previewWidthPx: number;
  previewHeightPx: number;
  compositionWidth: number;
  showSafeArea: boolean;
  snap: boolean;
  readOnly?: boolean;
  onSelect: (ids: string[]) => void;
  /** Called once per gesture on release (history) and live while dragging (preview). */
  onPatch: (patch: CanvasPatch) => void;
  onGestureEnd?: () => void;
};

type Gesture =
  | {
      kind: 'move';
      itemId: string;
      pointerId: number;
      startX: number;
      startY: number;
      start: VisualTransform;
      half: { w: number; h: number };
    }
  | {
      kind: 'resize';
      itemId: string;
      pointerId: number;
      center: { x: number; y: number };
      rotation: number;
    }
  | { kind: 'rotate'; itemId: string; pointerId: number; center: { x: number; y: number } };

const HANDLE = 'border-primary absolute size-3 rounded-[3px] border bg-white shadow-sm touch-none';

export function VideoCanvasOverlayV2({
  project,
  frame,
  selectedIds,
  typography,
  compositionScale,
  previewWidthPx,
  previewHeightPx,
  compositionWidth,
  showSafeArea,
  snap,
  readOnly = false,
  onSelect,
  onPatch,
  onGestureEnd,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);

  const active = useMemo(() => itemsActiveAt(project, frame), [project, frame]);
  const layerItems = useMemo(
    () =>
      active
        .filter(({ item, track }) => isLayerItem(item) && !track.hidden && !track.locked)
        .map(({ item }) => item as LayerItem),
    [active]
  );
  const overlayItems = useMemo(
    () =>
      active
        .filter(
          ({ item, track }) =>
            track.kind === 'overlay' && isMediaItem(item) && !track.hidden && !track.locked
        )
        .map(({ item }) => item as MediaItem),
    [active]
  );

  // The v1 overlay edits "scene layers"; give it one synthetic scene holding the active layers.
  const syntheticScene = useMemo<VideoScene>(
    () => ({
      id: 'v2-active',
      kind: 'photo',
      label: '',
      durationSec: 1,
      transition: 'none',
      imageUrl: null,
      texts: {
        headline: '',
        subheadline: '',
        promoLine: '',
        ctaLine: '',
        slotLabels: [],
        rulesLine: '',
      },
      layers: layerItems.map((item) => item.layer),
    }),
    [layerItems]
  );
  const itemIdByLayerId = useMemo(
    () => new Map(layerItems.map((item) => [item.layer.id, item.id])),
    [layerItems]
  );
  const selectedLayerId = useMemo(
    () => layerItems.find((item) => selectedIds.includes(item.id))?.layer.id ?? null,
    [layerItems, selectedIds]
  );

  const frameCenterPx = useCallback((item: MediaItem) => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: rect.left + (item.transform.x / 100) * rect.width,
      y: rect.top + (item.transform.y / 100) * rect.height,
    };
  }, []);

  const startMove = (event: React.PointerEvent, item: MediaItem) => {
    if (readOnly || event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    onSelect([item.id]);
    const aspect = overlayAspect(item);
    const w = item.transform.widthPct;
    const hPct = (((w / 100) * previewWidthPx) / aspect / Math.max(1, previewHeightPx)) * 100;
    setGesture({
      kind: 'move',
      itemId: item.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      start: item.transform,
      half: { w: w / 2, h: hPct / 2 },
    });
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    if (gesture.kind === 'move') {
      const result = moveTransform(
        gesture.start,
        pxDeltaToPct(event.clientX - gesture.startX, previewWidthPx),
        pxDeltaToPct(event.clientY - gesture.startY, previewHeightPx),
        gesture.half,
        snap && !event.altKey
      );
      setGuides(result.guides);
      onPatch({
        kind: 'transform',
        itemId: gesture.itemId,
        transform: { x: result.x, y: result.y },
      });
    } else if (gesture.kind === 'resize') {
      onPatch({
        kind: 'transform',
        itemId: gesture.itemId,
        transform: {
          widthPct: resizedWidthPct(
            gesture.center,
            { x: event.clientX, y: event.clientY },
            gesture.rotation,
            previewWidthPx
          ),
        },
      });
    } else {
      onPatch({
        kind: 'transform',
        itemId: gesture.itemId,
        transform: {
          rotation: rotationFromPointer(
            gesture.center,
            { x: event.clientX, y: event.clientY },
            event.shiftKey ? 15 : null
          ),
        },
      });
    }
  };

  const endGesture = (event: React.PointerEvent) => {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    setGesture(null);
    setGuides([]);
    onGestureEnd?.();
  };

  return (
    <div
      ref={rootRef}
      className="absolute inset-0"
      onPointerMove={onPointerMove}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
    >
      {/* Text, CTA, chips and logos: reuse the proven v1 drag and resize overlay. */}
      {layerItems.length > 0 ? (
        <VideoTextPositionOverlay
          scene={syntheticScene}
          templateTypography={typography}
          compositionScale={compositionScale}
          previewWidthPx={previewWidthPx}
          compositionWidth={compositionWidth}
          enabled={!readOnly}
          selectedElementId={selectedLayerId}
          onSelectElement={(layerId) => {
            const id = itemIdByLayerId.get(layerId);
            if (id) onSelect([id]);
          }}
          onActivateElement={(layerId) => {
            const id = itemIdByLayerId.get(layerId);
            if (id) onSelect([id]);
          }}
          onLayerPositionChange={(layerId, position) => {
            const itemId = itemIdByLayerId.get(layerId);
            if (itemId) onPatch({ kind: 'layer-position', itemId, position });
          }}
          onLayerWidthChange={(layerId, widthPct) => {
            const itemId = itemIdByLayerId.get(layerId);
            if (itemId) onPatch({ kind: 'layer-width', itemId, widthPct });
          }}
        />
      ) : null}

      {/* Overlay (picture in picture) clips: move, resize, rotate. */}
      {overlayItems.map((item) => {
        const selected = selectedIds.includes(item.id);
        const aspect = overlayAspect(item);
        const t = item.transform;
        return (
          <div
            key={item.id}
            data-video-layer
            className="absolute"
            style={{
              left: `${t.x}%`,
              top: `${t.y}%`,
              width: `${t.widthPct}%`,
              aspectRatio: String(aspect),
              transform: `translate(-50%, -50%) rotate(${t.rotation}deg)`,
            }}
          >
            <button
              type="button"
              aria-label={`Move ${item.label ?? (item.type === 'video' ? 'video' : 'photo')}`}
              disabled={readOnly}
              onPointerDown={(event) => startMove(event, item)}
              className={cn(
                'absolute inset-0 cursor-move touch-none rounded-[2px] border-2 transition-colors',
                selected ? 'border-primary' : 'hover:border-primary/60 border-transparent'
              )}
            />
            {selected && !readOnly ? (
              <>
                {(
                  [
                    '-left-1.5 -top-1.5',
                    '-right-1.5 -top-1.5',
                    '-bottom-1.5 -left-1.5',
                    '-bottom-1.5 -right-1.5',
                  ] as const
                ).map((pos) => (
                  <span
                    key={pos}
                    role="presentation"
                    className={cn(HANDLE, pos, 'cursor-nwse-resize')}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      event.currentTarget.setPointerCapture(event.pointerId);
                      setGesture({
                        kind: 'resize',
                        itemId: item.id,
                        pointerId: event.pointerId,
                        center: frameCenterPx(item),
                        rotation: t.rotation,
                      });
                    }}
                  />
                ))}
                <span
                  role="presentation"
                  className={cn(
                    HANDLE,
                    '-top-6 left-1/2 -translate-x-1/2 cursor-grab rounded-full'
                  )}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setGesture({
                      kind: 'rotate',
                      itemId: item.id,
                      pointerId: event.pointerId,
                      center: frameCenterPx(item),
                    });
                  }}
                />
              </>
            ) : null}
          </div>
        );
      })}

      {/* Guides: safe area (9:16) and live snap lines. */}
      {showSafeArea
        ? safeAreaGuides(project.format).map((guide) => (
            <div
              key={`${guide.axis}-${guide.at}`}
              aria-hidden
              className={cn(
                'pointer-events-none absolute border-dashed border-amber-300/80',
                guide.axis === 'y' ? 'inset-x-0 border-t' : 'inset-y-0 border-l'
              )}
              style={guide.axis === 'y' ? { top: `${guide.at}%` } : { left: `${guide.at}%` }}
            />
          ))
        : null}
      {guides.map((guide) => (
        <div
          key={`${guide.axis}-${guide.at}-live`}
          aria-hidden
          className={cn(
            'bg-primary pointer-events-none absolute',
            guide.axis === 'y' ? 'inset-x-0 h-px' : 'inset-y-0 w-px'
          )}
          style={guide.axis === 'y' ? { top: `${guide.at}%` } : { left: `${guide.at}%` }}
        />
      ))}
    </div>
  );
}
