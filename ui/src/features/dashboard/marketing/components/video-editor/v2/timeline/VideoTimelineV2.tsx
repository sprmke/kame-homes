import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { Eye, EyeOff, Lock, Unlock, Volume2, VolumeX } from 'lucide-react';

import { TimelineItemBlock } from '@/features/dashboard/marketing/components/video-editor/v2/timeline/TimelineItemBlock';
import { TimelineRuler } from '@/features/dashboard/marketing/components/video-editor/v2/timeline/TimelineRuler';
import { TimelineToolbar } from '@/features/dashboard/marketing/components/video-editor/v2/timeline/TimelineToolbar';
import {
  hasMediaDrag,
  readMediaDrag,
  type MediaDragPayload,
} from '@/features/dashboard/marketing/lib/media/mediaDrag';
import { trackLabel } from '@/features/dashboard/marketing/lib/video/v2/editorCommands';
import {
  commitDrag,
  resolveDrag,
  resolveMediaDrop,
  type DragMode,
  type DragPreview,
  type DragStart,
} from '@/features/dashboard/marketing/lib/video/v2/timelineDrag';
import {
  splitItems,
  updateTrack,
  type OpResult,
} from '@/features/dashboard/marketing/lib/video/v2/timelineOps';
import {
  clampZoom,
  fitPxPerFrame,
  frameToPx,
  pxToFrame,
  scrollAfterZoom,
  scrollToReveal,
  snapThresholdFrames,
  stepZoom,
  timelineContentWidth,
  visibleFrameRange,
  type LaneRect,
} from '@/features/dashboard/marketing/lib/video/v2/timelineScale';
import {
  isItemActiveAt,
  projectDurationInFrames,
} from '@/features/dashboard/marketing/lib/video/v2/timelineTiming';
import {
  isAudioItem,
  type VideoItem,
  type VideoProjectV2,
  type VideoTrack,
} from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';

import { cn } from '@/lib/utils';

/** How long a finger rests on a clip before it can be dragged (a quicker swipe scrolls). */
const LONG_PRESS_MS = 320;
/** Finger travel that turns a press into a scroll. */
const LONG_PRESS_SLOP_PX = 8;

const MAIN_LANE_HEIGHT = 56;
const FREE_LANE_HEIGHT = 36;
const HEADER_WIDTH = 104;

type TimelineHandlers = {
  undo: () => void;
  redo: () => void;
  duplicate: () => void;
  remove: (ripple: boolean) => void;
  addText: () => void;
  addMedia: () => void;
  addAudio: () => void;
};

type Props = {
  project: VideoProjectV2;
  currentFrame: number;
  isPlaying: boolean;
  selectedIds: string[];
  zoom: number;
  snapEnabled: boolean;
  canUndo: boolean;
  canRedo: boolean;
  readOnly?: boolean;
  /**
   * Touch layout (CapCut style): the playhead stays centred and scrolling the lanes scrubs, pinch
   * zooms, a long-press arms a clip drag. The editor supplies its own action bar.
   */
  mobile?: boolean;
  peaksFor: (item: VideoItem) => number[] | null;
  onSeek: (frame: number) => void;
  onSelect: (ids: string[]) => void;
  onZoomChange: (zoom: number) => void;
  onToggleSnap: () => void;
  /** Run an operation on the latest project; the editor stores the result and shows notices. */
  onApply: (build: (project: VideoProjectV2) => OpResult) => void;
  onDropMedia: (
    payload: MediaDragPayload,
    target: { frame: number; trackId: string | null; onMain: boolean }
  ) => void;
  handlers: TimelineHandlers;
  className?: string;
};

type ActiveDrag = {
  start: DragStart;
  preview: DragPreview;
  pointerId: number;
};

const laneHeight = (track: VideoTrack) =>
  track.kind === 'main' ? MAIN_LANE_HEIGHT : FREE_LANE_HEIGHT;

export function VideoTimelineV2({
  project,
  currentFrame,
  isPlaying,
  selectedIds,
  zoom,
  snapEnabled,
  canUndo,
  canRedo,
  readOnly = false,
  mobile = false,
  peaksFor,
  onSeek,
  onSelect,
  onZoomChange,
  onToggleSnap,
  onApply,
  onDropMedia,
  handlers,
  className,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lanesRef = useRef<HTMLDivElement>(null);
  const [viewportPx, setViewportPx] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [drag, setDrag] = useState<ActiveDrag | null>(null);
  const dragRef = useRef<ActiveDrag | null>(null);
  dragRef.current = drag;
  const [dropMarker, setDropMarker] = useState<{ frame: number; trackId: string | null } | null>(
    null
  );
  const scrubbingRef = useRef(false);

  const fps = project.fps;
  const totalFrames = projectDurationInFrames(project);
  const fitPx = fitPxPerFrame(viewportPx - 8, totalFrames);
  const pxPerFrame = fitPx * zoom;
  // Touch layout: half a screen of padding each side lets frame 0 and the last frame reach the
  // fixed centre playhead; lane x = scroll x - pad.
  const pad = mobile ? Math.round(viewportPx / 2) : 0;
  const contentWidth = mobile
    ? Math.max(1, Math.ceil(frameToPx(totalFrames, pxPerFrame)))
    : timelineContentWidth(totalFrames, pxPerFrame, viewportPx);
  const range = visibleFrameRange(scrollLeft - pad, viewportPx, pxPerFrame);
  const userScrollAtRef = useRef(0);
  const programmaticScrollRef = useRef(false);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  const lanes = useMemo<LaneRect[]>(() => {
    let top = 0;
    // Visual order: top track first (CapCut), main last.
    return [...project.tracks].reverse().map((track) => {
      const rect = { id: track.id, top, height: laneHeight(track) };
      top += laneHeight(track) + 2;
      return rect;
    });
  }, [project.tracks]);
  const orderedTracks = useMemo(() => [...project.tracks].reverse(), [project.tracks]);
  const lanesHeight = lanes.length
    ? lanes[lanes.length - 1]!.top + lanes[lanes.length - 1]!.height
    : 0;

  // ── viewport size and scroll tracking ────────────────────────────────────
  useLayoutEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const measure = () => setViewportPx(node.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Follow the playhead while playing, and when it is moved out of view.
  useEffect(() => {
    const node = scrollRef.current;
    if (!node || drag || mobile) return;
    const next = scrollToReveal(currentFrame, node.scrollLeft, node.clientWidth, pxPerFrame);
    if (next !== null && (isPlaying || scrubbingRef.current === false)) node.scrollLeft = next;
  }, [currentFrame, isPlaying, pxPerFrame, drag, mobile]);

  // Touch layout: the lanes slide under the centred playhead. A finger scroll seeks; a seek from
  // anywhere else (play, buttons) moves the lanes. Skip the echo while the finger is scrolling.
  useEffect(() => {
    const node = scrollRef.current;
    if (!node || !mobile || drag) return;
    if (!isPlaying && Date.now() - userScrollAtRef.current < 250) return;
    const target = Math.round(frameToPx(currentFrame, pxPerFrame));
    if (Math.abs(node.scrollLeft - target) < 1) return;
    programmaticScrollRef.current = true;
    node.scrollLeft = target;
    requestAnimationFrame(() => {
      programmaticScrollRef.current = false;
    });
  }, [mobile, currentFrame, pxPerFrame, pad, isPlaying, drag]);

  const onLanesScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const left = event.currentTarget.scrollLeft;
    setScrollLeft(left);
    if (!mobile || programmaticScrollRef.current) return;
    userScrollAtRef.current = Date.now();
    const frame = Math.max(0, Math.min(totalFrames - 1, Math.round(pxToFrame(left, pxPerFrame))));
    if (frame !== currentFrame) onSeek(frame);
  };

  // Touch layout: two fingers zoom. One finger keeps the browser's native pan.
  useEffect(() => {
    const node = scrollRef.current;
    if (!node || !mobile) return;
    let startDistance = 0;
    let startZoom = 1;
    const distance = (event: TouchEvent) =>
      Math.hypot(
        event.touches[0]!.clientX - event.touches[1]!.clientX,
        event.touches[0]!.clientY - event.touches[1]!.clientY
      );
    const onStart = (event: TouchEvent) => {
      if (event.touches.length !== 2) return;
      startDistance = distance(event);
      startZoom = zoomRef.current;
    };
    const onMove = (event: TouchEvent) => {
      if (event.touches.length !== 2 || startDistance <= 0) return;
      event.preventDefault();
      onZoomChange(clampZoom(startZoom * (distance(event) / startDistance)));
    };
    const onEnd = () => {
      startDistance = 0;
    };
    node.addEventListener('touchstart', onStart, { passive: true });
    node.addEventListener('touchmove', onMove, { passive: false });
    node.addEventListener('touchend', onEnd);
    node.addEventListener('touchcancel', onEnd);
    return () => {
      node.removeEventListener('touchstart', onStart);
      node.removeEventListener('touchmove', onMove);
      node.removeEventListener('touchend', onEnd);
      node.removeEventListener('touchcancel', onEnd);
    };
  }, [mobile, onZoomChange]);

  // ── zoom with ctrl/cmd + wheel, anchored on the pointer ──────────────────
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const rect = node.getBoundingClientRect();
      const anchor = event.clientX - rect.left;
      const nextZoom = clampZoom(zoom * (event.deltaY < 0 ? 1.15 : 1 / 1.15));
      const nextPx = fitPx * nextZoom;
      node.scrollLeft = scrollAfterZoom(node.scrollLeft, anchor, pxPerFrame, nextPx);
      onZoomChange(nextZoom);
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [zoom, fitPx, pxPerFrame, onZoomChange]);

  // ── scrubbing on the ruler ───────────────────────────────────────────────
  const frameFromClientX = useCallback(
    (clientX: number) => {
      const node = scrollRef.current;
      if (!node) return 0;
      const rect = node.getBoundingClientRect();
      return Math.max(
        0,
        Math.min(
          totalFrames - 1,
          Math.round(pxToFrame(clientX - rect.left + node.scrollLeft - pad, pxPerFrame))
        )
      );
    },
    [pxPerFrame, totalFrames, pad]
  );

  const onRulerPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    scrubbingRef.current = true;
    onSeek(frameFromClientX(event.clientX));
    const move = (e: PointerEvent) => onSeek(frameFromClientX(e.clientX));
    const up = () => {
      scrubbingRef.current = false;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // ── clip drag / trim ─────────────────────────────────────────────────────
  const dragContext = useCallback(
    () => ({
      pxPerFrame,
      lanes,
      snapEnabled,
      playheadFrame: currentFrame,
      thresholdFrames: snapThresholdFrames(pxPerFrame),
    }),
    [pxPerFrame, lanes, snapEnabled, currentFrame]
  );

  const pointerInLanes = (clientX: number, clientY: number) => {
    const lanesNode = lanesRef.current;
    const rect = lanesNode?.getBoundingClientRect();
    return { x: clientX, y: rect ? clientY - rect.top : 0 };
  };

  const beginDrag = (
    item: VideoItem,
    track: VideoTrack,
    mode: DragMode,
    point: { clientX: number; clientY: number; pointerId: number }
  ) => {
    const start: DragStart = {
      mode,
      itemId: item.id,
      startX: point.clientX,
      startY: pointerInLanes(point.clientX, point.clientY).y,
      originFrom: item.from,
      originDuration: item.durationInFrames,
      originTrackId: track.id,
    };
    const initial: ActiveDrag = {
      start,
      pointerId: point.pointerId,
      preview: resolveDrag(project, start, { x: point.clientX, y: start.startY }, dragContext()),
    };
    dragRef.current = initial;
    setDrag(initial);

    const move = (e: PointerEvent) => {
      const current = dragRef.current;
      if (!current || e.pointerId !== current.pointerId) return;
      const p = pointerInLanes(e.clientX, e.clientY);
      const preview = resolveDrag(project, current.start, p, dragContext());
      const next = { ...current, preview };
      dragRef.current = next;
      setDrag(next);
      // Edge auto-scroll while dragging near the viewport edges (the touch layout keeps its
      // centred playhead; there the lanes scroll with the finger instead).
      const node = scrollRef.current;
      if (node && !mobile) {
        const rect = node.getBoundingClientRect();
        if (e.clientX > rect.right - 32) node.scrollLeft += 12;
        else if (e.clientX < rect.left + 32) node.scrollLeft -= 12;
      }
    };
    // Once a clip is picked up, the finger must not scroll the page or the lanes.
    const blockScroll = (e: TouchEvent) => e.preventDefault();
    const finish = (e: PointerEvent, cancelled: boolean) => {
      const current = dragRef.current;
      if (!current || e.pointerId !== current.pointerId) return;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('touchmove', blockScroll);
      dragRef.current = null;
      setDrag(null);
      if (!cancelled && current.preview.active) {
        onApply((p) => commitDrag(p, current.start, current.preview));
      }
    };
    const up = (e: PointerEvent) => finish(e, false);
    const cancel = (e: PointerEvent) => finish(e, true);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    if (mobile) window.addEventListener('touchmove', blockScroll, { passive: false });
  };

  /**
   * Touch: a clip moves only after the finger rests on it. Moving sooner is a scroll, so the
   * lanes keep their native swipe and a stray drag never rearranges the video.
   */
  const armLongPress = (
    item: VideoItem,
    track: VideoTrack,
    mode: DragMode,
    point: { clientX: number; clientY: number; pointerId: number }
  ) => {
    let last = point;
    const cleanup = () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== point.pointerId) return;
      last = { clientX: e.clientX, clientY: e.clientY, pointerId: e.pointerId };
      if (Math.hypot(e.clientX - point.clientX, e.clientY - point.clientY) > LONG_PRESS_SLOP_PX) {
        cleanup();
      }
    };
    const end = (e: PointerEvent) => {
      if (e.pointerId === point.pointerId) cleanup();
    };
    const timer = window.setTimeout(() => {
      cleanup();
      beginDrag(item, track, mode, last);
    }, LONG_PRESS_MS);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  };

  const onItemPointerDown = (
    event: React.PointerEvent<HTMLElement>,
    item: VideoItem,
    track: VideoTrack,
    mode: DragMode
  ) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    const additive = event.shiftKey || event.metaKey || event.ctrlKey;
    if (additive) {
      onSelect(
        selectedIds.includes(item.id)
          ? selectedIds.filter((id) => id !== item.id)
          : [...selectedIds, item.id]
      );
    } else if (!selectedIds.includes(item.id)) {
      onSelect([item.id]);
    }
    if (readOnly || track.locked || additive) return;

    const point = { clientX: event.clientX, clientY: event.clientY, pointerId: event.pointerId };
    if (mobile && event.pointerType === 'touch' && mode === 'move') {
      armLongPress(item, track, mode, point);
      return;
    }
    beginDrag(item, track, mode, point);
  };

  // Escape cancels a drag in progress.
  useEffect(() => {
    if (!drag) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      dragRef.current = null;
      setDrag(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drag]);

  const onItemKeyDown = (event: React.KeyboardEvent<HTMLElement>, item: VideoItem) => {
    if (readOnly) return;
    const step = event.shiftKey ? project.fps : 1;
    const arrow = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!arrow) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSelect([item.id]);
      }
      return;
    }
    event.preventDefault();
    if (event.altKey) {
      // Alt + arrows trims the end edge.
      onApply((p) => {
        const dur = item.durationInFrames + arrow * step;
        return commitDrag(
          p,
          {
            mode: 'trim-end',
            itemId: item.id,
            startX: 0,
            startY: 0,
            originFrom: item.from,
            originDuration: item.durationInFrames,
            originTrackId: '',
          },
          {
            from: item.from,
            durationInFrames: dur,
            trackId: '',
            reorderMain: false,
            mainIndex: null,
            snapTarget: null,
            active: true,
          }
        );
      });
      return;
    }
    onApply((p) => {
      const track = p.tracks.find((t) => t.items.some((i) => i.id === item.id));
      if (!track) return { project: p, ok: false, reason: 'not_found' };
      return commitDrag(
        p,
        {
          mode: 'move',
          itemId: item.id,
          startX: 0,
          startY: 0,
          originFrom: item.from,
          originDuration: item.durationInFrames,
          originTrackId: track.id,
        },
        {
          from: Math.max(0, item.from + arrow * step),
          durationInFrames: item.durationInFrames,
          trackId: track.id,
          reorderMain: track.kind === 'main',
          mainIndex: null,
          snapTarget: null,
          active: true,
        }
      );
    });
  };

  // ── media drops from the library ─────────────────────────────────────────
  const dropTarget = (event: React.DragEvent) => {
    const scroller = scrollRef.current;
    const lanesNode = lanesRef.current;
    if (!scroller || !lanesNode) return null;
    const sRect = scroller.getBoundingClientRect();
    const lRect = lanesNode.getBoundingClientRect();
    return resolveMediaDrop(
      project,
      {
        xInTimeline: event.clientX - sRect.left + scroller.scrollLeft - pad,
        yInLanes: event.clientY - lRect.top,
      },
      dragContext()
    );
  };

  const onDragOver = (event: React.DragEvent) => {
    if (readOnly || !hasMediaDrag(event.dataTransfer)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    const target = dropTarget(event);
    if (target) setDropMarker({ frame: target.frame, trackId: target.trackId });
  };

  const onDrop = (event: React.DragEvent) => {
    setDropMarker(null);
    if (readOnly) return;
    const payload = readMediaDrag(event.dataTransfer);
    if (!payload) return;
    event.preventDefault();
    const target = dropTarget(event);
    if (target) onDropMedia(payload, target);
  };

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const canSplit = useMemo(
    () =>
      selectedIds.some((id) =>
        project.tracks.some((track) =>
          track.items.some(
            (i) => i.id === id && isItemActiveAt(i, currentFrame) && currentFrame > i.from
          )
        )
      ) ||
      (selectedIds.length === 0 &&
        project.tracks.some((track) =>
          track.items.some(
            (i) => currentFrame > i.from && isItemActiveAt(i, currentFrame) && !track.locked
          )
        )),
    [selectedIds, project.tracks, currentFrame]
  );

  const split = () => {
    const ids = selectedIds.length
      ? selectedIds
      : project.tracks.flatMap((track) =>
          track.locked
            ? []
            : track.items
                .filter(
                  (i) => isItemActiveAt(i, currentFrame) && currentFrame > i.from && !isAudioItem(i)
                )
                .map((i) => i.id)
        );
    onApply((p) => splitItems(p, ids, currentFrame));
  };

  return (
    <div className={cn('bg-background flex min-h-0 flex-col', className)} aria-label="Timeline">
      {mobile ? null : (
        <TimelineToolbar
          canUndo={canUndo}
          canRedo={canRedo}
          hasSelection={selectedIds.length > 0}
          canSplit={canSplit}
          snapEnabled={snapEnabled}
          readOnly={readOnly}
          onUndo={handlers.undo}
          onRedo={handlers.redo}
          onSplit={split}
          onDelete={() => handlers.remove(false)}
          onDuplicate={handlers.duplicate}
          onToggleSnap={onToggleSnap}
          onZoomIn={() => onZoomChange(stepZoom(zoom, 1))}
          onZoomOut={() => onZoomChange(stepZoom(zoom, -1))}
          onFit={() => {
            onZoomChange(1);
            if (scrollRef.current) scrollRef.current.scrollLeft = 0;
          }}
          onAddText={handlers.addText}
          onAddMedia={handlers.addMedia}
          onAddAudio={handlers.addAudio}
        />
      )}

      <div
        className={cn(
          'flex min-h-0 overflow-y-auto',
          mobile ? 'max-h-[220px] overscroll-contain' : 'max-h-[260px]'
        )}
      >
        {/* Track headers */}
        {mobile ? null : (
          <div
            className="bg-background border-border sticky left-0 z-30 shrink-0 border-r"
            style={{ width: HEADER_WIDTH }}
          >
            <div className="bg-muted/60 border-border h-6 border-b" />
            <div className="relative" style={{ height: lanesHeight }}>
              {orderedTracks.map((track, index) => {
                const rect = lanes[index]!;
                const kindIndex = project.tracks
                  .filter((t) => t.kind === track.kind)
                  .indexOf(track);
                const canMute =
                  track.kind === 'audio' || track.kind === 'main' || track.kind === 'overlay';
                return (
                  <div
                    key={track.id}
                    className="border-border/60 absolute inset-x-0 flex items-center gap-0.5 border-b px-1"
                    style={{ top: rect.top, height: rect.height }}
                  >
                    <span className="text-muted-foreground min-w-0 flex-1 truncate text-[10px] font-medium">
                      {track.name ?? trackLabel(track.kind, kindIndex)}
                    </span>
                    {track.kind !== 'audio' ? (
                      <button
                        type="button"
                        aria-label={track.hidden ? 'Show track' : 'Hide track'}
                        aria-pressed={Boolean(track.hidden)}
                        className="text-muted-foreground hover:text-foreground flex size-5 items-center justify-center"
                        onClick={() =>
                          onApply((p) => updateTrack(p, track.id, { hidden: !track.hidden }))
                        }
                      >
                        {track.hidden ? (
                          <EyeOff className="size-3" aria-hidden />
                        ) : (
                          <Eye className="size-3" aria-hidden />
                        )}
                      </button>
                    ) : null}
                    {canMute ? (
                      <button
                        type="button"
                        aria-label={track.muted ? 'Unmute track' : 'Mute track'}
                        aria-pressed={Boolean(track.muted)}
                        className="text-muted-foreground hover:text-foreground flex size-5 items-center justify-center"
                        onClick={() =>
                          onApply((p) => updateTrack(p, track.id, { muted: !track.muted }))
                        }
                      >
                        {track.muted ? (
                          <VolumeX className="size-3" aria-hidden />
                        ) : (
                          <Volume2 className="size-3" aria-hidden />
                        )}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      aria-label={track.locked ? 'Unlock track' : 'Lock track'}
                      aria-pressed={Boolean(track.locked)}
                      className="text-muted-foreground hover:text-foreground flex size-5 items-center justify-center"
                      onClick={() =>
                        onApply((p) => updateTrack(p, track.id, { locked: !track.locked }))
                      }
                    >
                      {track.locked ? (
                        <Lock className="size-3" aria-hidden />
                      ) : (
                        <Unlock className="size-3" aria-hidden />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Scrollable lanes. The touch layout wraps them so the playhead can stay put. */}
        <div className="relative min-w-0 flex-1">
          <div
            ref={scrollRef}
            className={cn(
              'relative w-full overflow-x-auto overflow-y-hidden overscroll-x-contain',
              mobile &&
                'touch-pan-x touch-pan-y [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
            )}
            onScroll={onLanesScroll}
            onDragOver={onDragOver}
            onDragLeave={() => setDropMarker(null)}
            onDrop={onDrop}
            // A touch scroll starts with a press: clear the selection on a tap, not on a swipe.
            onPointerDown={mobile ? undefined : () => onSelect([])}
            onClick={mobile ? () => onSelect([]) : undefined}
          >
            <div className="relative" style={{ width: contentWidth + pad * 2 }}>
              <div className="relative" style={{ marginLeft: pad, width: contentWidth }}>
                <TimelineRuler
                  fps={fps}
                  pxPerFrame={pxPerFrame}
                  startFrame={range.start}
                  endFrame={Math.min(range.end, Math.ceil(contentWidth / pxPerFrame))}
                  width={contentWidth}
                  onPointerDown={onRulerPointerDown}
                  inert={mobile}
                />
                <div ref={lanesRef} className="relative" style={{ height: lanesHeight }}>
                  {orderedTracks.map((track, index) => {
                    const rect = lanes[index]!;
                    const isDropLane = dropMarker?.trackId === track.id;
                    return (
                      <div
                        key={track.id}
                        data-lane={track.id}
                        className={cn(
                          'border-border/60 absolute inset-x-0 border-b',
                          track.kind === 'main' ? 'bg-muted/30' : 'bg-background',
                          track.hidden && 'opacity-50',
                          isDropLane && 'bg-primary/10'
                        )}
                        style={{ top: rect.top, height: rect.height }}
                      >
                        {track.items.map((item) => {
                          const end = item.from + item.durationInFrames;
                          const dragging = drag?.start.itemId === item.id && drag.preview.active;
                          if (!dragging && (end < range.start || item.from > range.end))
                            return null;
                          return (
                            <TimelineItemBlock
                              key={item.id}
                              item={item}
                              fps={fps}
                              pxPerFrame={pxPerFrame}
                              height={rect.height}
                              selected={selectedSet.has(item.id)}
                              dimmed={dragging}
                              locked={track.locked || readOnly}
                              touch={mobile}
                              peaks={isAudioItem(item) ? peaksFor(item) : null}
                              onPointerDown={(event, mode) =>
                                onItemPointerDown(event, item, track, mode)
                              }
                              onKeyDown={onItemKeyDown}
                              onFocusItem={() => undefined}
                            />
                          );
                        })}
                        {drag?.preview.active && drag.preview.trackId === track.id
                          ? (() => {
                              const found = project.tracks
                                .flatMap((t) => t.items)
                                .find((i) => i.id === drag.start.itemId);
                              if (!found) return null;
                              return (
                                <TimelineItemBlock
                                  item={found}
                                  fps={fps}
                                  pxPerFrame={pxPerFrame}
                                  from={drag.preview.from}
                                  durationInFrames={drag.preview.durationInFrames}
                                  height={rect.height}
                                  selected
                                  ghost
                                  onPointerDown={() => undefined}
                                  onKeyDown={() => undefined}
                                  onFocusItem={() => undefined}
                                />
                              );
                            })()
                          : null}
                      </div>
                    );
                  })}

                  {/* Drop / snap guides */}
                  {dropMarker ? (
                    <div
                      aria-hidden
                      className="bg-primary pointer-events-none absolute inset-y-0 w-0.5"
                      style={{ left: frameToPx(dropMarker.frame, pxPerFrame) }}
                    />
                  ) : null}
                  {drag?.preview.active && drag.preview.snapTarget !== null ? (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-y-0 w-px bg-amber-400"
                      style={{ left: frameToPx(drag.preview.snapTarget, pxPerFrame) }}
                    />
                  ) : null}
                </div>

                {/* Playhead (the touch layout draws it fixed in the centre below) */}
                {mobile ? null : (
                  <div
                    aria-hidden
                    className="bg-primary pointer-events-none absolute bottom-0 top-0 z-30 w-px"
                    style={{ left: frameToPx(currentFrame, pxPerFrame) }}
                  >
                    <span className="bg-primary absolute -left-[5px] top-0 size-[11px] rounded-b-sm [clip-path:polygon(0_0,100%_0,50%_100%)]" />
                  </div>
                )}
              </div>
            </div>
          </div>
          {mobile ? (
            <div
              aria-hidden
              className="bg-primary pointer-events-none absolute bottom-0 left-1/2 top-0 z-30 w-0.5 -translate-x-1/2"
            >
              <span className="bg-primary absolute -left-[5px] top-0 size-[12px] rounded-b-sm [clip-path:polygon(0_0,100%_0,50%_100%)]" />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
