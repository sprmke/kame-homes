import { Maximize2, Minimize2, Pause, Play, Volume2, VolumeX } from 'lucide-react';

import { formatTimecode } from '@/features/dashboard/marketing/lib/video/v2/timelineTiming';

import { Button } from '@/components/ui/button';

type Props = {
  currentFrame: number;
  durationInFrames: number;
  fps: number;
  isPlaying: boolean;
  muted: boolean;
  isFullscreen: boolean;
  onTogglePlay: () => void;
  onSeek: (frame: number) => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
};

export function VideoTransportBarV2({
  currentFrame,
  durationInFrames,
  fps,
  isPlaying,
  muted,
  isFullscreen,
  onTogglePlay,
  onSeek,
  onToggleMute,
  onToggleFullscreen,
}: Props) {
  const max = Math.max(1, durationInFrames - 1);
  return (
    <div className="border-border bg-background flex items-center gap-2 border-t px-2 py-1.5">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-11 lg:size-9"
        aria-label={isPlaying ? 'Pause' : 'Play'}
        onClick={onTogglePlay}
      >
        {isPlaying ? (
          <Pause className="size-5" aria-hidden />
        ) : (
          <Play className="size-5" aria-hidden />
        )}
      </Button>
      <span className="text-muted-foreground w-[88px] shrink-0 text-xs tabular-nums">
        {formatTimecode(currentFrame, fps, true)} / {formatTimecode(durationInFrames, fps)}
      </span>
      <input
        type="range"
        min={0}
        max={max}
        step={1}
        value={Math.min(currentFrame, max)}
        aria-label="Seek"
        className="accent-primary h-1 min-w-0 flex-1 cursor-pointer"
        onChange={(event) => onSeek(Number(event.target.value))}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-11 lg:size-9"
        aria-label={muted ? 'Unmute preview' : 'Mute preview'}
        aria-pressed={muted}
        onClick={onToggleMute}
      >
        {muted ? (
          <VolumeX className="size-4" aria-hidden />
        ) : (
          <Volume2 className="size-4" aria-hidden />
        )}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="hidden size-9 lg:inline-flex"
        aria-label={isFullscreen ? 'Exit full screen' : 'Full screen'}
        onClick={onToggleFullscreen}
      >
        {isFullscreen ? (
          <Minimize2 className="size-4" aria-hidden />
        ) : (
          <Maximize2 className="size-4" aria-hidden />
        )}
      </Button>
    </div>
  );
}
