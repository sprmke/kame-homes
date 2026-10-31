import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import { overlayPositionedLayerStyle } from '@/features/dashboard/marketing/lib/video/videoCompositionLayout';
import {
  layerHasContent,
  VideoLayerBody,
} from '@/features/dashboard/marketing/lib/video/videoLayerContent';
import {
  layerUsesWidthPct,
  widthPctFromPointerX,
} from '@/features/dashboard/marketing/lib/video/videoLayerSizing';
import type { VideoLayerPosition } from '@/features/dashboard/marketing/lib/video/videoProjectTypes';
import type { VideoScene } from '@/features/dashboard/marketing/lib/video/videoProjectTypes';
import {
  getSceneLayers,
  layerLabel,
  overlayLayersForScene,
} from '@/features/dashboard/marketing/lib/video/videoSceneLayers';
import type { VideoTypographyContext } from '@/features/dashboard/marketing/lib/video/videoTemplateTypography';

import { cn } from '@/lib/utils';

type Props = {
  scene: VideoScene;
  templateTypography: VideoTypographyContext;
  compositionScale: number;
  previewWidthPx: number;
  compositionWidth: number;
  enabled?: boolean;
  selectedElementId?: string | null;
  /** Highlights the layer while dragging without opening the sidebar. */
  onSelectElement?: (id: string) => void;
  /** Opens sidebar controls for the layer (canvas click). */
  onActivateElement?: (id: string) => void;
  onLayerPositionChange: (layerId: string, position: VideoLayerPosition) => void;
  onLayerWidthChange?: (layerId: string, widthPct: number) => void;
};

type DragState = {
  layerId: string;
  pointerId: number;
  startX: number;
  startY: number;
};

type ResizeState = {
  layerId: string;
  pointerId: number;
};

const TAP_MOVE_THRESHOLD_PX = 6;

const CORNER_HANDLE =
  'pointer-events-none absolute size-2 rounded-[2px] border border-primary bg-white shadow-sm';

function SelectionChrome({ active, selected }: { active: boolean; selected: boolean }) {
  if (!active) return null;

  return (
    <>
      <div
        className={cn(
          'pointer-events-none absolute rounded-[3px] border-2 transition-colors',
          selected ? 'border-primary' : 'border-primary/45'
        )}
        style={{ inset: '-5px' }}
      />
      {selected ? (
        <>
          <span className={cn(CORNER_HANDLE, '-left-[5px] -top-[5px]')} aria-hidden />
          <span className={cn(CORNER_HANDLE, '-right-[5px] -top-[5px]')} aria-hidden />
          <span className={cn(CORNER_HANDLE, '-bottom-[5px] -left-[5px]')} aria-hidden />
          <span className={cn(CORNER_HANDLE, '-bottom-[5px] -right-[5px]')} aria-hidden />
        </>
      ) : null}
    </>
  );
}

function OverlayLayerTarget({
  layer,
  templateTypography,
  compositionScale,
  renderScale,
  previewWidthPx,
  compositionWidth,
  isDragging,
  isResizing,
  isHovered,
  isSelected,
  label,
  onPointerDown,
  onResizePointerDown,
  onPointerEnter,
  onPointerLeave,
}: {
  layer: ReturnType<typeof overlayLayersForScene>[number];
  templateTypography: VideoTypographyContext;
  compositionScale: number;
  renderScale: number;
  previewWidthPx: number;
  compositionWidth: number;
  isDragging: boolean;
  isResizing: boolean;
  isHovered: boolean;
  isSelected: boolean;
  label: string;
  onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onResizePointerDown: (event: React.PointerEvent<HTMLSpanElement>) => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<{ width: number; height: number } | null>(null);
  const showChrome = isDragging || isResizing || isHovered || isSelected;
  const usesWidthPct = layerUsesWidthPct(layer);

  useLayoutEffect(() => {
    if (usesWidthPct) {
      setMeasured(null);
      return;
    }

    const node = contentRef.current;
    if (!node) return;

    const measure = () => {
      const rect = node.getBoundingClientRect();
      setMeasured((prev) =>
        prev?.width === rect.width && prev?.height === rect.height
          ? prev
          : { width: rect.width, height: rect.height }
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [layer, templateTypography, renderScale, previewWidthPx, usesWidthPct]);

  return (
    <div
      style={overlayPositionedLayerStyle(layer, compositionScale, previewWidthPx, compositionWidth)}
      className={cn(isSelected && 'z-10', (isDragging || isResizing) && 'z-20')}
    >
      <button
        type="button"
        className={cn(
          'pointer-events-auto relative touch-none select-none outline-none',
          usesWidthPct ? 'block w-full' : 'inline-block max-w-full',
          isDragging || isResizing ? 'cursor-grabbing' : 'cursor-grab'
        )}
        style={
          !usesWidthPct && measured ? { width: measured.width, height: measured.height } : undefined
        }
        aria-label={`Move ${label}`}
        aria-pressed={isSelected}
        data-video-layer=""
        onPointerDown={onPointerDown}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
      >
        <div
          ref={contentRef}
          aria-hidden
          className={cn('invisible', usesWidthPct ? 'block w-full' : 'inline-block max-w-full')}
        >
          <VideoLayerBody layer={layer} typography={templateTypography} scale={renderScale} />
        </div>
        <SelectionChrome active={showChrome} selected={isSelected || isDragging || isResizing} />
        {isSelected && usesWidthPct ? (
          <span
            role="presentation"
            aria-hidden
            className={cn(
              'border-primary bg-background pointer-events-auto absolute -bottom-[5px] -right-[5px] size-3 cursor-nwse-resize touch-none rounded-[2px] border-2 shadow-sm',
              // Expand the touch target to ~44px without growing the visible dot.
              "after:absolute after:-inset-[16px] after:content-['']"
            )}
            onPointerDown={onResizePointerDown}
          />
        ) : null}
      </button>
    </div>
  );
}

export function VideoTextPositionOverlay({
  scene,
  templateTypography,
  compositionScale,
  previewWidthPx,
  compositionWidth,
  enabled = true,
  selectedElementId = null,
  onSelectElement,
  onActivateElement,
  onLayerPositionChange,
  onLayerWidthChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragMovedRef = useRef(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [resize, setResize] = useState<ResizeState | null>(null);
  const [hoveredLayerId, setHoveredLayerId] = useState<string | null>(null);

  const allLayers = getSceneLayers(scene);
  const layers = overlayLayersForScene(scene).filter((layer) => layerHasContent(layer));
  const renderScale = compositionScale * (previewWidthPx / compositionWidth || 1);

  const updateLayer = useCallback(
    (layerId: string, clientX: number, clientY: number) => {
      const container = containerRef.current;
      if (!container) return;

      const layer = allLayers.find((item) => item.id === layerId);
      if (!layer) return;

      const rect = container.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 100;
      const y = ((clientY - rect.top) / rect.height) * 100;

      onLayerPositionChange(layerId, {
        ...layer.position,
        x: Math.min(96, Math.max(4, x)),
        y: Math.min(96, Math.max(4, y)),
      });
    },
    [allLayers, onLayerPositionChange]
  );

  const updateLayerWidth = useCallback(
    (layerId: string, clientX: number) => {
      const container = containerRef.current;
      if (!container || !onLayerWidthChange) return;

      const layer = allLayers.find((item) => item.id === layerId);
      if (!layer || !layerUsesWidthPct(layer)) return;

      const rect = container.getBoundingClientRect();
      onLayerWidthChange(layerId, widthPctFromPointerX(layer, clientX, rect));
    },
    [allLayers, onLayerWidthChange]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (resize && event.pointerId === resize.pointerId) {
        updateLayerWidth(resize.layerId, event.clientX);
        return;
      }
      if (!drag || event.pointerId !== drag.pointerId) return;

      const dx = Math.abs(event.clientX - drag.startX);
      const dy = Math.abs(event.clientY - drag.startY);
      if (dx > TAP_MOVE_THRESHOLD_PX || dy > TAP_MOVE_THRESHOLD_PX) {
        dragMovedRef.current = true;
      }
      if (!dragMovedRef.current) return;

      updateLayer(drag.layerId, event.clientX, event.clientY);
    },
    [drag, resize, updateLayer, updateLayerWidth]
  );

  const endInteraction = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (resize && event.pointerId === resize.pointerId) {
        setResize(null);
        event.currentTarget.releasePointerCapture(event.pointerId);
        return;
      }
      if (!drag || event.pointerId !== drag.pointerId) return;

      const layerId = drag.layerId;
      const wasTap = !dragMovedRef.current;

      setDrag(null);
      event.currentTarget.releasePointerCapture(event.pointerId);

      if (wasTap) {
        onActivateElement?.(layerId);
      }
    },
    [drag, resize, onActivateElement]
  );

  if (!enabled || layers.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 z-50"
      onPointerMove={handlePointerMove}
      onPointerUp={endInteraction}
      onPointerCancel={endInteraction}
    >
      {layers.map((layer) => {
        const isDragging = drag?.layerId === layer.id;
        const isResizing = resize?.layerId === layer.id;
        const isHovered = hoveredLayerId === layer.id;
        const isSelected = selectedElementId === layer.id;
        const sameKind = allLayers.filter((item) => item.kind === layer.kind);
        const index = sameKind.findIndex((item) => item.id === layer.id) + 1;
        const label = layerLabel(layer, index);

        return (
          <OverlayLayerTarget
            key={layer.id}
            layer={layer}
            templateTypography={templateTypography}
            compositionScale={compositionScale}
            renderScale={renderScale}
            previewWidthPx={previewWidthPx}
            compositionWidth={compositionWidth}
            isDragging={isDragging}
            isResizing={isResizing}
            isHovered={isHovered}
            isSelected={isSelected}
            label={label}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onSelectElement?.(layer.id);
              dragMovedRef.current = false;
              containerRef.current?.setPointerCapture(event.pointerId);
              setDrag({
                layerId: layer.id,
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
              });
            }}
            onResizePointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onSelectElement?.(layer.id);
              containerRef.current?.setPointerCapture(event.pointerId);
              setResize({ layerId: layer.id, pointerId: event.pointerId });
            }}
            onPointerEnter={() => setHoveredLayerId(layer.id)}
            onPointerLeave={() => {
              if (!isDragging && !isResizing) {
                setHoveredLayerId((current) => (current === layer.id ? null : current));
              }
            }}
          />
        );
      })}
    </div>
  );
}
