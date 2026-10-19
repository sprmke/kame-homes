import { type ReactNode, useEffect, useRef } from 'react';

import { Maximize2, Minimize2, Pause, Play, Square, Volume2, VolumeX } from 'lucide-react';

import {
  useVideoPlayerTransport,
  type VideoPreviewMode,
} from '@/features/dashboard/marketing/components/video-editor/useVideoPlayerTransport';
import type { VideoProject } from '@/features/dashboard/marketing/lib/video/videoProjectTypes';
import { sceneStartFrame } from '@/features/dashboard/marketing/lib/video/videoProjectUtils';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import type { PlayerRef } from '@remotion/player';

type Props = {
  playerRef: React.RefObject<PlayerRef | null>;
  playerInstance: PlayerRef | null;
  project: VideoProject;
  selectedSceneIndex: number;
  previewMode: VideoPreviewMode;
  onPreviewModeChange: (mode: VideoPreviewMode) => void;
  compositionKey: string;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onPlayingChange?: (playing: boolean) => void;
  onMutedChange?: (muted: boolean) => void;
  sceneSegments: Array<{
    id: string;
    startPct: number;
    widthPct: number;
    index: number;
  }>;
  editingSceneIndex: number;
};

export function VideoPlaybackControls({
  playerRef,
  playerInstance,
  project,
  selectedSceneIndex,
  previewMode,
  onPreviewModeChange,
  compositionKey,
  isFullscreen,
  onToggleFullscreen,
  onPlayingChange,
  onMutedChange,
  sceneSegments,
  editingSceneIndex,
}: Props) {
  const transport = useVideoPlayerTransport({
    playerRef,
    playerInstance,
    project,
    selectedSceneIndex,
    previewMode,
    compositionKey,
  });

  useEffect(() => {
    onPlayingChange?.(transport.isPlaying);
  }, [transport.isPlaying, onPlayingChange]);

  useEffect(() => {
    onMutedChange?.(transport.isMuted);
  }, [transport.isMuted, onMutedChange]);

  const handleTogglePlay = () => {
    // Decide off the player's own live state, not `transport.isPlaying` —
    // that's React state updated via a player event listener and can lag a
    // render behind a mount/scene-switch, which was enough to make an early
    // click branch the wrong way and appear to do nothing.
    const playingNow = playerRef.current?.isPlaying() ?? transport.isPlaying;
    if (playingNow) {
      transport.togglePlay();
      return;
    }
    if (previewMode === 'clip') {
      transport.playSelectedClip();
      return;
    }
    transport.togglePlay();
  };

  const handlePreviewModeChange = (mode: VideoPreviewMode) => {
    onPreviewModeChange(mode);
    if (mode === 'all') {
      transport.seekToFrame(0);
      transport.pause();
      return;
    }
    transport.seekToScene(selectedSceneIndex);
  };

  const scrubMax =
    previewMode === 'clip'
      ? Math.max(
          1,
          transport.sceneEndFrame(selectedSceneIndex) -
            sceneStartFrame(project, selectedSceneIndex) -
            1
        )
      : Math.max(0, transport.durationInFrames - 1);

  const scrubValue =
    previewMode === 'clip'
      ? Math.max(0, transport.currentFrame - sceneStartFrame(project, selectedSceneIndex))
      : transport.currentFrame;

  const scrubProgressPct = scrubMax > 0 ? (scrubValue / scrubMax) * 100 : 0;
  const wasPlayingBeforeScrubRef = useRef(false);

  const seekToScrubValue = (value: number) => {
    if (previewMode === 'clip') {
      transport.seekToFrame(sceneStartFrame(project, selectedSceneIndex) + value);
      return;
    }
    transport.seekToFrame(value);
  };

  return (
    <div className="border-border bg-background shrink-0 border-t px-3 py-2 max-lg:py-1 sm:px-4">
      <div className="mx-auto w-full max-w-3xl space-y-2 max-lg:space-y-0.5">
        <VideoSeekSlider
          min={0}
          max={scrubMax}
          value={Math.min(scrubValue, scrubMax)}
          progressPct={scrubProgressPct}
          sceneSegments={previewMode === 'all' ? sceneSegments : []}
          editingSceneIndex={editingSceneIndex}
          onScrubStart={() => {
            wasPlayingBeforeScrubRef.current = transport.isPlaying;
            transport.pause();
          }}
          onScrub={(value) => seekToScrubValue(value)}
          onScrubEnd={() => {
            if (wasPlayingBeforeScrubRef.current) {
              void transport.play();
            }
          }}
        />

        <div className="flex flex-wrap items-center justify-between gap-2 max-lg:flex-nowrap max-lg:justify-center max-lg:gap-1">
          {/* Time readout is redundant on mobile — the scrubber + timeline show duration. */}
          <div className="text-muted-foreground text-xs tabular-nums max-lg:hidden sm:text-sm">
            <span className="text-foreground">
              {transport.formatTime(transport.displayCurrentSec)}
            </span>
            <span className="mx-1">/</span>
            <span>{transport.formatTime(transport.displayDurationSec)}</span>
          </div>

          <div className="flex items-center gap-0.5 sm:gap-1">
            <TransportButton label="Stop" onClick={transport.stop}>
              <Square className="size-3.5 fill-current" aria-hidden />
            </TransportButton>
            <TransportButton
              label={transport.isPlaying ? 'Pause' : 'Play'}
              onClick={handleTogglePlay}
              className="bg-primary-strong text-primary-foreground hover:bg-primary-strong/90 min-w-[44px]"
            >
              {transport.isPlaying ? (
                <Pause className="size-4 text-white" aria-hidden />
              ) : (
                <Play className="size-4 text-white" aria-hidden />
              )}
            </TransportButton>
            <TransportButton
              label={transport.isMuted ? 'Unmute' : 'Mute'}
              onClick={transport.toggleMute}
              pressed={transport.isMuted}
            >
              {transport.isMuted ? (
                <VolumeX className="size-4" aria-hidden />
              ) : (
                <Volume2 className="size-4" aria-hidden />
              )}
            </TransportButton>
          </div>

          <div className="flex items-center gap-1">
            <PreviewModeChip
              label="Clip"
              selected={previewMode === 'clip'}
              onClick={() => handlePreviewModeChange('clip')}
            />
            <PreviewModeChip
              label="All"
              selected={previewMode === 'all'}
              onClick={() => handlePreviewModeChange('all')}
            />
            <TransportButton
              label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              onClick={onToggleFullscreen}
            >
              {isFullscreen ? (
                <Minimize2 className="size-4" aria-hidden />
              ) : (
                <Maximize2 className="size-4" aria-hidden />
              )}
            </TransportButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function VideoSeekSlider({
  min,
  max,
  value,
  progressPct,
  sceneSegments,
  editingSceneIndex,
  onScrubStart,
  onScrub,
  onScrubEnd,
}: {
  min: number;
  max: number;
  value: number;
  progressPct: number;
  sceneSegments: Array<{ id: string; startPct: number; widthPct: number; index: number }>;
  editingSceneIndex: number;
  onScrubStart: () => void;
  onScrub: (value: number) => void;
  onScrubEnd: () => void;
}) {
  return (
    <div className="relative flex min-h-[44px] items-center py-1 max-lg:min-h-[30px] max-lg:py-0">
      <div
        className="bg-muted pointer-events-none absolute inset-x-0 h-1.5 overflow-hidden rounded-full"
        aria-hidden
      >
        {sceneSegments.map((segment) => (
          <div
            key={segment.id}
            className={cn(
              'border-background/70 absolute top-0 h-full border-r',
              segment.index === editingSceneIndex ? 'bg-primary/20' : 'bg-muted-foreground/10'
            )}
            style={{
              left: `${segment.startPct}%`,
              width: `${segment.widthPct}%`,
            }}
          />
        ))}
        <div
          className="bg-primary/50 absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        aria-label="Seek playback"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        onPointerDown={onScrubStart}
        onPointerUp={onScrubEnd}
        onPointerCancel={onScrubEnd}
        onChange={(event) => onScrub(Number(event.target.value))}
        onInput={(event) => onScrub(Number(event.currentTarget.value))}
        className={cn(
          'relative z-10 h-6 w-full cursor-pointer appearance-none bg-transparent',
          '[&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-transparent',
          '[&::-webkit-slider-thumb]:mt-[-5px] [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full',
          '[&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:shadow-md',
          'active:[&::-webkit-slider-thumb]:cursor-grabbing',
          '[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-transparent',
          '[&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:rounded-full',
          '[&::-moz-range-thumb]:border-background [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:shadow-md',
          'active:[&::-moz-range-thumb]:cursor-grabbing'
        )}
      />
    </div>
  );
}

function PreviewModeChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'min-h-[44px] rounded-md px-2.5 text-xs font-medium transition-colors max-lg:min-h-[38px] max-lg:px-2',
        selected
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      {label}
    </button>
  );
}

function TransportButton({
  children,
  label,
  onClick,
  disabled,
  pressed,
  className,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      onClick={onClick}
      className={cn(
        'text-foreground hover:bg-muted min-h-[44px] min-w-[44px] max-lg:size-9 max-lg:min-h-[38px] max-lg:min-w-[38px]',
        pressed && 'bg-muted',
        disabled && 'opacity-40',
        className
      )}
    >
      {children}
    </Button>
  );
}
