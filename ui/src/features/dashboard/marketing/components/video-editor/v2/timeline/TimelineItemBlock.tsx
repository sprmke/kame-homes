import { memo } from 'react';

import { Film, ImageIcon, Music, Type } from 'lucide-react';

import { TimelineWaveform } from '@/features/dashboard/marketing/components/video-editor/v2/timeline/TimelineWaveform';
import {
  itemAriaLabel,
  itemLabel,
} from '@/features/dashboard/marketing/lib/video/v2/editorCommands';
import { frameToPx } from '@/features/dashboard/marketing/lib/video/v2/timelineScale';
import { sourceDurationFrames } from '@/features/dashboard/marketing/lib/video/v2/timelineTiming';
import {
  isAudioItem,
  isLayerItem,
  isMediaItem,
  type VideoItem,
} from '@/features/dashboard/marketing/lib/video/v2/videoProjectV2Types';

import { cn } from '@/lib/utils';

type BlockPointerHandler = (
  event: React.PointerEvent<HTMLElement>,
  mode: 'move' | 'trim-start' | 'trim-end'
) => void;

type Props = {
  item: VideoItem;
  fps: number;
  pxPerFrame: number;
  /** Override used while dragging (preview geometry). */
  from?: number;
  durationInFrames?: number;
  height: number;
  selected: boolean;
  dimmed?: boolean;
  ghost?: boolean;
  locked?: boolean;
  /** Touch layout: swipes scroll the timeline, long-press arms a drag, handles are bigger. */
  touch?: boolean;
  peaks?: number[] | null;
  onPointerDown: BlockPointerHandler;
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>, item: VideoItem) => void;
  onFocusItem: (item: VideoItem) => void;
};

function Thumb({ item, height }: { item: VideoItem; height: number }) {
  if (!isMediaItem(item)) return null;
  const url = item.type === 'image' ? item.media.url : item.media.posterUrl;
  if (!url) {
    return (
      <span className="absolute inset-0 flex items-center justify-center bg-slate-700">
        {item.type === 'video' ? (
          <Film className="size-4 text-white/60" aria-hidden />
        ) : (
          <ImageIcon className="size-4 text-white/60" aria-hidden />
        )}
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="absolute inset-0 bg-repeat-x"
      style={{
        backgroundImage: `url("${url}")`,
        backgroundSize: `auto ${height}px`,
        backgroundPosition: 'left center',
      }}
    />
  );
}

export const TimelineItemBlock = memo(function TimelineItemBlock({
  item,
  fps,
  pxPerFrame,
  from = item.from,
  durationInFrames = item.durationInFrames,
  height,
  selected,
  dimmed,
  ghost,
  locked,
  touch,
  peaks,
  onPointerDown,
  onKeyDown,
  onFocusItem,
}: Props) {
  const left = frameToPx(from, pxPerFrame);
  const width = Math.max(6, frameToPx(durationInFrames, pxPerFrame));
  const audio = isAudioItem(item);
  const layer = isLayerItem(item);
  const label = itemLabel(item);

  let startRatio = 0;
  let endRatio = 1;
  if (audio) {
    const source = sourceDurationFrames(item.media, fps);
    if (source) {
      startRatio = (item.trimBeforeFrames ?? 0) / source;
      endRatio = Math.min(1, startRatio + durationInFrames / source);
    }
  }

  // 44 px touch targets, but never more than 45% of a short clip so the two never overlap.
  const handleClass = cn(
    'absolute inset-y-0 z-10 cursor-ew-resize touch-none bg-white/0 hover:bg-white/30 group-focus-within:bg-white/20',
    touch ? 'w-11 max-w-[45%]' : 'w-3'
  );

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={itemAriaLabel(item, fps)}
      aria-pressed={selected}
      data-timeline-item={item.id}
      onFocus={() => onFocusItem(item)}
      onKeyDown={(event) => onKeyDown(event, item)}
      // A tap selects; it must not reach the lane, which clears the selection on tap.
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => {
        if ((event.target as HTMLElement).closest('[data-trim]')) return;
        onPointerDown(event, 'move');
      }}
      className={cn(
        'group absolute top-0.5 select-none overflow-hidden rounded-md border text-white outline-none',
        touch ? 'touch-pan-x touch-pan-y' : 'touch-none',
        'focus-visible:ring-primary focus-visible:ring-2',
        layer && 'border-violet-400/60 bg-violet-600',
        audio && 'border-emerald-400/60 bg-emerald-700',
        !layer && !audio && 'border-sky-400/50 bg-slate-800',
        selected && 'ring-2 ring-white',
        dimmed && 'opacity-30',
        ghost && 'pointer-events-none opacity-70 shadow-lg',
        locked ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'
      )}
      style={{ left, width, height: height - 4 }}
    >
      <Thumb item={item} height={height - 4} />
      {audio ? (
        <TimelineWaveform
          peaks={peaks ?? null}
          startRatio={startRatio}
          endRatio={endRatio}
          className="absolute inset-x-0 bottom-0 h-2/3 w-full"
        />
      ) : null}
      {isMediaItem(item) ? <span className="absolute inset-0 bg-black/25" aria-hidden /> : null}
      <span className="relative flex h-full items-start gap-1 px-1.5 pt-0.5 text-[10px] font-medium leading-tight">
        {layer ? <Type className="mt-px size-3 shrink-0" aria-hidden /> : null}
        {audio ? <Music className="mt-px size-3 shrink-0" aria-hidden /> : null}
        <span className="truncate [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">{label}</span>
      </span>

      {!locked ? (
        <>
          <span
            data-trim="start"
            aria-hidden
            onPointerDown={(event) => onPointerDown(event, 'trim-start')}
            className={cn(handleClass, 'left-0')}
          />
          <span
            data-trim="end"
            aria-hidden
            onPointerDown={(event) => onPointerDown(event, 'trim-end')}
            className={cn(handleClass, 'right-0')}
          />
        </>
      ) : null}
    </div>
  );
});
