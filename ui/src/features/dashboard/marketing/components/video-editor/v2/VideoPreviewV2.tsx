import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import {
  VideoCanvasOverlayV2,
  type CanvasPatch,
} from '@/features/dashboard/marketing/components/video-editor/v2/VideoCanvasOverlayV2';
import { VideoRemotionPlayerV2 } from '@/features/dashboard/marketing/components/video-editor/v2/VideoRemotionPlayerV2';
import { VideoTransportBarV2 } from '@/features/dashboard/marketing/components/video-editor/v2/VideoTransportBarV2';
import type { VideoCompositionV2Props } from '@/features/dashboard/marketing/components/video-editor/VideoCompositionV2';
import { marketingEditorWorkspaceClassName } from '@/features/dashboard/marketing/lib/marketingEditorWorkspace';
import { topmostVisualAt } from '@/features/dashboard/marketing/lib/video/v2/timelineTiming';
import type { VideoProjectV2 } from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';
import {
  VIDEO_FORMAT_DIMENSIONS,
  fitVideoPreviewFrameSize,
} from '@/features/dashboard/marketing/lib/video/videoFormatDimensions';
import { resolveVideoTypographyContext } from '@/features/dashboard/marketing/lib/video/videoTemplateTypography';
import { scaleForVideoFormat } from '@/features/dashboard/marketing/lib/video/videoTextSlotContent';
import { PlanGateWatermarkOverlay } from '@/features/dashboard/plans/components/PlanGateWatermarkOverlay';

import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

import type { PlayerRef } from '@remotion/player';

/** Shorter than the scene editor's: the timeline shares the column, so the preview flexes. */
const PREVIEW_SHELL_MIN_HEIGHT_CLASS = 'min-h-[220px] sm:min-h-[300px] lg:min-h-[260px]';

const SCROLLBAR_HIDDEN =
  '[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden';

export type VideoPreviewV2Handle = { fitToView: () => void; toggleFullscreen: () => void };

type Props = {
  playerRef: React.RefObject<PlayerRef | null>;
  project: VideoProjectV2;
  durationInFrames: number;
  inputProps: VideoCompositionV2Props;
  compositionKey: string;
  currentFrame: number;
  isPlaying: boolean;
  selectedIds: string[];
  relativeZoom: number;
  snap: boolean;
  showSafeArea: boolean;
  readOnly?: boolean;
  onSelect: (ids: string[]) => void;
  onPatch: (patch: CanvasPatch) => void;
  onGestureEnd: () => void;
  onTogglePlay: () => void;
  onSeek: (frame: number) => void;
  onPlayerInstance: (player: PlayerRef | null) => void;
  playerInstance: PlayerRef | null;
};

export const VideoPreviewV2 = forwardRef<VideoPreviewV2Handle, Props>(function VideoPreviewV2(
  {
    playerRef,
    project,
    durationInFrames,
    inputProps,
    compositionKey,
    currentFrame,
    isPlaying,
    selectedIds,
    relativeZoom,
    snap,
    showSafeArea,
    readOnly,
    onSelect,
    onPatch,
    onGestureEnd,
    onTogglePlay,
    onSeek,
    onPlayerInstance,
  },
  ref
) {
  const isBelowLg = useIsBelowLg();
  const shellRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ id: number; x: number; y: number; left: number; top: number } | null>(
    null
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [fit, setFit] = useState<{ width: number; height: number } | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [fitNonce, setFitNonce] = useState(0);

  const format = project.format;
  const dimensions = VIDEO_FORMAT_DIMENSIONS[format];
  const maxWidth = isBelowLg
    ? 4096
    : format === 'landscape'
      ? 640
      : format === 'instagram-post'
        ? 400
        : 360;
  const zoomFactor = Math.max(0.5, Math.min(2, relativeZoom / 100));

  const typography =
    inputProps.typography ??
    resolveVideoTypographyContext(
      project.templateId,
      inputProps.brandColor,
      project.palette,
      inputProps.theme
    );

  const measure = useCallback(() => {
    const node = areaRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    setViewport((prev) =>
      prev.width === rect.width && prev.height === rect.height
        ? prev
        : { width: rect.width, height: rect.height }
    );
    const next = fitVideoPreviewFrameSize(
      rect.width,
      rect.height,
      format,
      isFullscreen ? rect.width : maxWidth,
      100
    );
    setFit((prev) => (prev?.width === next.width && prev?.height === next.height ? prev : next));
  }, [format, isFullscreen, maxWidth]);

  useLayoutEffect(() => {
    measure();
    const node = areaRef.current;
    if (!node) return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [measure]);

  const toggleFullscreen = useCallback(async () => {
    const node = shellRef.current;
    if (!node) return;
    if (!document.fullscreenElement) {
      try {
        await node.requestFullscreen();
        setIsFullscreen(true);
      } catch {
        setIsFullscreen(false);
      }
      return;
    }
    await document.exitFullscreen();
    setIsFullscreen(false);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      fitToView: () => setFitNonce((n) => n + 1),
      toggleFullscreen: () => void toggleFullscreen(),
    }),
    [toggleFullscreen]
  );

  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
      requestAnimationFrame(measure);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [measure]);

  const frameWidth = fit?.width ?? maxWidth;
  const frameHeight = fit?.height ?? Math.round(maxWidth * (dimensions.height / dimensions.width));
  const displayWidth = frameWidth * zoomFactor;
  const displayHeight = frameHeight * zoomFactor;
  const pad = 48;
  const stageWidth = Math.max(
    viewport.width,
    displayWidth + pad * 2,
    viewport.width * Math.max(1, zoomFactor)
  );
  const stageHeight = Math.max(
    viewport.height,
    displayHeight + pad * 2,
    viewport.height * Math.max(1, zoomFactor)
  );

  useLayoutEffect(() => {
    const node = areaRef.current;
    if (!node || viewport.width <= 0) return;
    node.scrollLeft = Math.max(0, (stageWidth - viewport.width) / 2);
    node.scrollTop = Math.max(0, (stageHeight - viewport.height) / 2);
  }, [stageWidth, stageHeight, viewport.width, viewport.height, relativeZoom, fitNonce]);

  const endPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!panRef.current || panRef.current.id !== event.pointerId) return;
    panRef.current = null;
    setIsPanning(false);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Already released.
    }
  };

  const onPanDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if ((event.target as Element).closest('[data-video-layer]')) return;
    if (event.pointerType === 'touch' && zoomFactor <= 1) return;
    const node = areaRef.current;
    if (!node) return;
    panRef.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: node.scrollLeft,
      top: node.scrollTop,
    };
    setIsPanning(true);
    node.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const onPanMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const s = panRef.current;
    const node = areaRef.current;
    if (!s || s.id !== event.pointerId || !node) return;
    node.scrollLeft = s.left - (event.clientX - s.x);
    node.scrollTop = s.top - (event.clientY - s.y);
  };

  // Clicking empty canvas selects the main clip showing at the playhead (nothing above it).
  const selectBackground = () => {
    const top = topmostVisualAt(project, currentFrame);
    onSelect(top && top.track.kind === 'main' ? [top.item.id] : []);
  };

  return (
    <div
      ref={shellRef}
      className={cn(
        marketingEditorWorkspaceClassName,
        'flex min-h-0 flex-1 flex-col overflow-hidden',
        !isFullscreen && PREVIEW_SHELL_MIN_HEIGHT_CLASS,
        isFullscreen && 'h-dvh w-dvw'
      )}
    >
      <div
        ref={areaRef}
        className={cn(
          'relative min-h-0 flex-1 overflow-auto overscroll-contain',
          SCROLLBAR_HIDDEN,
          isPanning ? 'cursor-grabbing' : 'cursor-grab',
          zoomFactor > 1 && 'touch-none'
        )}
        onPointerDown={onPanDown}
        onPointerMove={onPanMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
      >
        <div
          className="relative flex items-center justify-center"
          style={{ width: stageWidth, height: stageHeight, minWidth: '100%', minHeight: '100%' }}
        >
          <PlanGateWatermarkOverlay fit="content" className="rounded-xl">
            <div
              className="relative shrink-0 overflow-hidden rounded-xl shadow-md"
              style={{ width: displayWidth, height: displayHeight }}
            >
              <div
                className="absolute left-0 top-0 overflow-hidden"
                style={{
                  width: frameWidth,
                  height: frameHeight,
                  transform: `scale(${zoomFactor})`,
                  transformOrigin: 'top left',
                }}
              >
                <div
                  className="relative size-full overflow-hidden bg-slate-950"
                  onPointerDown={selectBackground}
                >
                  <div className="pointer-events-none absolute inset-0 size-full">
                    <VideoRemotionPlayerV2
                      playerRef={playerRef}
                      compositionKey={compositionKey}
                      durationInFrames={durationInFrames}
                      fps={project.fps}
                      width={dimensions.width}
                      height={dimensions.height}
                      inputProps={inputProps}
                      previewMuted={muted}
                      onPlayerInstance={onPlayerInstance}
                    />
                  </div>
                  <VideoCanvasOverlayV2
                    project={project}
                    frame={currentFrame}
                    selectedIds={selectedIds}
                    typography={typography}
                    compositionScale={scaleForVideoFormat(dimensions.width, dimensions.height)}
                    previewWidthPx={frameWidth}
                    previewHeightPx={frameHeight}
                    compositionWidth={dimensions.width}
                    showSafeArea={showSafeArea}
                    snap={snap}
                    readOnly={readOnly}
                    onSelect={onSelect}
                    onPatch={onPatch}
                    onGestureEnd={onGestureEnd}
                  />
                </div>
              </div>
            </div>
          </PlanGateWatermarkOverlay>
        </div>
      </div>
      <VideoTransportBarV2
        currentFrame={currentFrame}
        durationInFrames={durationInFrames}
        fps={project.fps}
        isPlaying={isPlaying}
        muted={muted}
        isFullscreen={isFullscreen}
        onTogglePlay={onTogglePlay}
        onSeek={onSeek}
        onToggleMute={() => setMuted((value) => !value)}
        onToggleFullscreen={() => void toggleFullscreen()}
      />
    </div>
  );
});
