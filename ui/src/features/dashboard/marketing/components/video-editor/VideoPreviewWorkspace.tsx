import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useActiveSceneIndex } from '@/features/dashboard/marketing/components/video-editor/useActiveSceneIndex';
import type { VideoPreviewMode } from '@/features/dashboard/marketing/components/video-editor/useVideoPlayerTransport';
import type { VideoCompositionProps } from '@/features/dashboard/marketing/components/video-editor/VideoCompositions';
import { VideoPlaybackControls } from '@/features/dashboard/marketing/components/video-editor/VideoPlaybackControls';
import { VideoRemotionPlayer } from '@/features/dashboard/marketing/components/video-editor/VideoRemotionPlayer';
import { VideoTextPositionOverlay } from '@/features/dashboard/marketing/components/video-editor/VideoTextPositionOverlay';
import { marketingEditorWorkspaceClassName } from '@/features/dashboard/marketing/lib/marketingEditorWorkspace';
import {
  VIDEO_FORMAT_DIMENSIONS,
  VIDEO_PREVIEW_SHELL_MIN_HEIGHT_CLASS,
  fitVideoPreviewFrameSize,
} from '@/features/dashboard/marketing/lib/video/videoFormatDimensions';
import type {
  VideoFormat,
  VideoProject,
} from '@/features/dashboard/marketing/lib/video/videoProjectTypes';
import {
  sceneStartFrame,
  updateScene,
} from '@/features/dashboard/marketing/lib/video/videoProjectUtils';
import {
  updateSceneLayerPosition,
  updateSceneLayer,
} from '@/features/dashboard/marketing/lib/video/videoSceneLayers';
import { resolveVideoTypographyContext } from '@/features/dashboard/marketing/lib/video/videoTemplateTypography';
import { scaleForVideoFormat } from '@/features/dashboard/marketing/lib/video/videoTextSlotContent';
import { PlanGateWatermarkOverlay } from '@/features/dashboard/plans/components/PlanGateWatermarkOverlay';

import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

import type { PlayerRef } from '@remotion/player';

/** Hide scrollbars while keeping overflow scroll for pan. */
const SCROLLBAR_HIDDEN_CLASS =
  '[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden';

export type VideoPreviewWorkspaceHandle = {
  fitToView: () => void;
  toggleFullscreen: () => void;
};

type Props = {
  playerRef: React.RefObject<PlayerRef | null>;
  project: VideoProject;
  format: VideoFormat;
  durationInFrames: number;
  inputProps: VideoCompositionProps;
  selectedSceneIndex: number;
  previewMode: VideoPreviewMode;
  onPreviewModeChange: (mode: VideoPreviewMode) => void;
  onPlayingChange?: (playing: boolean) => void;
  onProjectChange: (project: VideoProject) => void;
  compositionKey: string;
  selectedElementId?: string | null;
  onHighlightElement?: (layerId: string) => void;
  onCanvasSelectElement?: (layerId: string, sceneId: string) => void;
  /** Relative zoom percent (100 = fit). Magnifies via CSS scale — does not letterbox. */
  relativeZoom?: number;
};

type PanSession = {
  pointerId: number;
  startX: number;
  startY: number;
  scrollLeft: number;
  scrollTop: number;
};

export const VideoPreviewWorkspace = forwardRef<VideoPreviewWorkspaceHandle, Props>(
  function VideoPreviewWorkspace(
    {
      playerRef,
      project,
      format,
      durationInFrames,
      inputProps,
      selectedSceneIndex,
      previewMode,
      onPreviewModeChange,
      onPlayingChange,
      onProjectChange,
      compositionKey,
      selectedElementId = null,
      onHighlightElement,
      onCanvasSelectElement,
      relativeZoom = 100,
    },
    ref
  ) {
    const isBelowLg = useIsBelowLg();
    const shellRef = useRef<HTMLDivElement>(null);
    const previewAreaRef = useRef<HTMLDivElement>(null);
    const panSessionRef = useRef<PanSession | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [previewPlaying, setPreviewPlaying] = useState(false);
    const [previewMuted, setPreviewMuted] = useState(false);
    const [playerInstance, setPlayerInstance] = useState<PlayerRef | null>(null);
    const [isPanning, setIsPanning] = useState(false);
    /** Fit size at 100% zoom — zoom is applied with CSS transform, not by resizing. */
    const [fitSize, setFitSize] = useState<{ width: number; height: number } | null>(null);
    const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
    const [fitNonce, setFitNonce] = useState(0);

    const dimensions = VIDEO_FORMAT_DIMENSIONS[format];
    // Desktop caps the preview so it doesn't sprawl; on phones the editor column is
    // already narrow, so let the frame use the full available width.
    const previewMaxWidth = isBelowLg
      ? 4096
      : format === 'landscape'
        ? 640
        : format === 'instagram-post'
          ? 400
          : 360;
    const compositionScale = scaleForVideoFormat(dimensions.width, dimensions.height);
    const zoomFactor = Math.max(0.5, Math.min(2, relativeZoom / 100));

    const templateTypography = useMemo(
      () =>
        inputProps.typography ??
        resolveVideoTypographyContext(
          project.templateId,
          inputProps.brandColor,
          project.palette,
          inputProps.theme
        ),
      [
        inputProps.typography,
        inputProps.brandColor,
        inputProps.theme,
        project.templateId,
        project.palette,
      ]
    );

    const handlePlayerInstance = useCallback((instance: PlayerRef | null) => {
      setPlayerInstance(instance);
    }, []);

    const measurePreviewFrame = useCallback(() => {
      const node = previewAreaRef.current;
      if (!node) return;

      const rect = node.getBoundingClientRect();
      setViewportSize((prev) =>
        prev.width === rect.width && prev.height === rect.height
          ? prev
          : { width: rect.width, height: rect.height }
      );

      const maxWidth = isFullscreen ? rect.width : previewMaxWidth;
      // Always measure the fit size at 100% — zoom must not change layout aspect.
      const next = fitVideoPreviewFrameSize(rect.width, rect.height, format, maxWidth, 100);
      setFitSize((prev) =>
        prev?.width === next.width && prev?.height === next.height ? prev : next
      );
    }, [format, isFullscreen, previewMaxWidth]);

    useLayoutEffect(() => {
      measurePreviewFrame();
      const node = previewAreaRef.current;
      if (!node) return;

      const observer = new ResizeObserver(() => measurePreviewFrame());
      observer.observe(node);
      return () => observer.disconnect();
    }, [measurePreviewFrame]);

    const editingSceneIndex = useActiveSceneIndex(
      playerRef,
      project,
      previewMode,
      selectedSceneIndex,
      previewPlaying
    );
    const editingScene = project.scenes[editingSceneIndex];

    useEffect(() => {
      onPlayingChange?.(previewPlaying);
    }, [previewPlaying, onPlayingChange]);

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

    const fitToView = useCallback(() => {
      setFitNonce((n) => n + 1);
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        fitToView,
        toggleFullscreen: () => {
          void toggleFullscreen();
        },
      }),
      [fitToView, toggleFullscreen]
    );

    useEffect(() => {
      const onFullscreenChange = () => {
        setIsFullscreen(Boolean(document.fullscreenElement));
        requestAnimationFrame(() => measurePreviewFrame());
      };
      document.addEventListener('fullscreenchange', onFullscreenChange);
      return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
    }, [measurePreviewFrame]);

    const frameWidth = fitSize?.width ?? previewMaxWidth;
    const frameHeight =
      fitSize?.height ?? Math.round(previewMaxWidth * (dimensions.height / dimensions.width));
    const displayWidth = frameWidth * zoomFactor;
    const displayHeight = frameHeight * zoomFactor;

    // Stage is at least the viewport, and grows with zoom so the white workspace is pannable.
    const stagePad = 48;
    const stageWidth = Math.max(
      viewportSize.width,
      displayWidth + stagePad * 2,
      viewportSize.width * Math.max(1, zoomFactor)
    );
    const stageHeight = Math.max(
      viewportSize.height,
      displayHeight + stagePad * 2,
      viewportSize.height * Math.max(1, zoomFactor)
    );

    // Keep the video centered in the stage when zoom / viewport changes (or Fit is pressed).
    useLayoutEffect(() => {
      const node = previewAreaRef.current;
      if (!node || viewportSize.width <= 0) return;
      node.scrollLeft = Math.max(0, (stageWidth - viewportSize.width) / 2);
      node.scrollTop = Math.max(0, (stageHeight - viewportSize.height) / 2);
    }, [stageWidth, stageHeight, viewportSize.width, viewportSize.height, relativeZoom, fitNonce]);

    const endPan = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
      const session = panSessionRef.current;
      if (!session || session.pointerId !== event.pointerId) return;
      panSessionRef.current = null;
      setIsPanning(false);
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // Already released.
      }
    }, []);

    const handlePanPointerDown = useCallback(
      (event: React.PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) return;
        const target = event.target as Element | null;
        // Layer drag / resize stays on the video canvas — don't steal those gestures.
        if (target?.closest?.('[data-video-layer]')) return;
        // On touch, only hijack the gesture when there is something to pan (zoomed in) —
        // otherwise let the page / sheet scroll normally.
        if (event.pointerType === 'touch' && zoomFactor <= 1) return;

        const node = previewAreaRef.current;
        if (!node) return;

        panSessionRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          scrollLeft: node.scrollLeft,
          scrollTop: node.scrollTop,
        };
        setIsPanning(true);
        node.setPointerCapture(event.pointerId);
        event.preventDefault();
      },
      [zoomFactor]
    );

    const handlePanPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
      const session = panSessionRef.current;
      if (!session || session.pointerId !== event.pointerId) return;
      const node = previewAreaRef.current;
      if (!node) return;

      node.scrollLeft = session.scrollLeft - (event.clientX - session.startX);
      node.scrollTop = session.scrollTop - (event.clientY - session.startY);
    }, []);

    const sceneSegments = useMemo(() => {
      return project.scenes.map((scene, index) => {
        const start = sceneStartFrame(project, index);
        const end =
          index + 1 < project.scenes.length
            ? sceneStartFrame(project, index + 1)
            : durationInFrames;
        const span = Math.max(1, end - start);
        return {
          id: scene.id,
          startPct: (start / durationInFrames) * 100,
          widthPct: (span / durationInFrames) * 100,
          index,
        };
      });
    }, [project, durationInFrames]);

    return (
      <div
        ref={shellRef}
        className={cn(
          marketingEditorWorkspaceClassName,
          'flex min-h-0 flex-1 flex-col overflow-hidden',
          !isFullscreen && VIDEO_PREVIEW_SHELL_MIN_HEIGHT_CLASS,
          isFullscreen && 'h-dvh w-dvw'
        )}
      >
        {/* Scrollable workspace — pan via drag; scrollbars hidden. */}
        <div
          ref={previewAreaRef}
          className={cn(
            'relative min-h-0 flex-1 overflow-auto overscroll-contain',
            SCROLLBAR_HIDDEN_CLASS,
            isPanning ? 'cursor-grabbing' : 'cursor-grab',
            // When zoomed in on touch, take the gesture for panning instead of scroll.
            zoomFactor > 1 && 'touch-none'
          )}
          onPointerDown={handlePanPointerDown}
          onPointerMove={handlePanPointerMove}
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
                style={{
                  width: displayWidth,
                  height: displayHeight,
                }}
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
                  <div className="relative size-full overflow-hidden bg-slate-950">
                    <div className="pointer-events-none absolute inset-0 size-full">
                      <VideoRemotionPlayer
                        playerRef={playerRef}
                        compositionKey={compositionKey}
                        durationInFrames={durationInFrames}
                        fps={project.fps}
                        width={dimensions.width}
                        height={dimensions.height}
                        inputProps={inputProps}
                        previewMuted={previewMuted}
                        onPlayerInstance={handlePlayerInstance}
                      />
                    </div>
                    {editingScene ? (
                      <VideoTextPositionOverlay
                        scene={editingScene}
                        templateTypography={templateTypography}
                        compositionScale={compositionScale}
                        previewWidthPx={frameWidth}
                        compositionWidth={dimensions.width}
                        selectedElementId={selectedElementId}
                        onSelectElement={onHighlightElement}
                        onActivateElement={(layerId) =>
                          onCanvasSelectElement?.(layerId, editingScene.id)
                        }
                        onLayerPositionChange={(layerId, position) => {
                          onProjectChange(
                            updateScene(
                              project,
                              editingScene.id,
                              updateSceneLayerPosition(editingScene, layerId, position)
                            )
                          );
                        }}
                        onLayerWidthChange={(layerId, widthPct) => {
                          onProjectChange(
                            updateScene(
                              project,
                              editingScene.id,
                              updateSceneLayer(editingScene, layerId, { widthPct })
                            )
                          );
                        }}
                      />
                    ) : null}
                  </div>
                </div>
              </div>
            </PlanGateWatermarkOverlay>
          </div>
        </div>

        <VideoPlaybackControls
          playerRef={playerRef}
          playerInstance={playerInstance}
          project={project}
          selectedSceneIndex={selectedSceneIndex}
          previewMode={previewMode}
          onPreviewModeChange={onPreviewModeChange}
          compositionKey={compositionKey}
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => void toggleFullscreen()}
          onPlayingChange={setPreviewPlaying}
          onMutedChange={setPreviewMuted}
          sceneSegments={sceneSegments}
          editingSceneIndex={editingSceneIndex}
        />
      </div>
    );
  }
);

VideoPreviewWorkspace.displayName = 'VideoPreviewWorkspace';
