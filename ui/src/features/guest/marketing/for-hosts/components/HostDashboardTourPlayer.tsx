import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';

import { Player, type PlayerRef } from '@remotion/player';
import {
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  X,
} from 'lucide-react';

import { HostDashboardFilm } from '@/features/guest/marketing/for-hosts/components/HostDashboardFilm';
import {
  HOST_TOUR_CHAPTER_DURATIONS,
  HOST_TOUR_CHAPTER_STARTS,
  HOST_TOUR_DURATION_IN_FRAMES,
  HOST_TOUR_FPS,
  hostTourChapterIndexAtFrame,
  hostTourChapters,
} from '@/features/guest/marketing/for-hosts/data/hostTourChapters';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { usePrefersReducedMotion } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

function formatTourTime(frame: number) {
  const totalSeconds = Math.max(0, Math.round(frame / HOST_TOUR_FPS));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

const HOST_TOUR_TOTAL_LABEL = formatTourTime(HOST_TOUR_DURATION_IN_FRAMES);

/**
 * Hold frame used for a chapter when reduced motion disables playback. Sits well inside the
 * chapter (past its intro reveals, before the next chapter's overlapping transition start).
 */
function reducedMotionHoldFrame(index: number) {
  const start = HOST_TOUR_CHAPTER_STARTS[index] ?? 0;
  const duration = HOST_TOUR_CHAPTER_DURATIONS[index] ?? 1;
  return start + Math.max(1, Math.round(duration - 40));
}

function TourChapterStrip({
  activeChapterIndex,
  chapterProgress,
  onSelect,
  reducedMotion,
}: {
  activeChapterIndex: number;
  chapterProgress: number;
  onSelect: (index: number) => void;
  reducedMotion: boolean;
}) {
  const stripRef = useRef<HTMLDivElement>(null);
  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(false);

  const syncScrollEdges = useCallback(() => {
    const strip = stripRef.current;
    if (!strip) return;
    setCanScrollBack(strip.scrollLeft > 4);
    setCanScrollForward(strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    syncScrollEdges();
    strip.addEventListener('scroll', syncScrollEdges, { passive: true });
    const observer = new ResizeObserver(syncScrollEdges);
    observer.observe(strip);
    return () => {
      strip.removeEventListener('scroll', syncScrollEdges);
      observer.disconnect();
    };
  }, [syncScrollEdges]);

  useEffect(() => {
    const strip = stripRef.current;
    const active = strip?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!strip || !active) return;
    const left = active.offsetLeft - strip.clientWidth / 2 + active.clientWidth / 2;
    strip.scrollTo({ left, behavior: reducedMotion ? 'auto' : 'smooth' });
  }, [activeChapterIndex, reducedMotion]);

  const scrollByPage = (direction: -1 | 1) => {
    const strip = stripRef.current;
    if (!strip) return;
    strip.scrollBy({
      left: direction * strip.clientWidth * 0.75,
      behavior: reducedMotion ? 'auto' : 'smooth',
    });
  };

  const arrowClassName =
    'border-border bg-background text-foreground hover:bg-muted focus-visible:ring-ring absolute top-1/2 z-10 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full border shadow-sm transition-colors before:absolute before:-inset-1 before:content-[""] focus-visible:outline-none focus-visible:ring-2 sm:flex';

  return (
    <div className="relative mt-3">
      <div
        ref={stripRef}
        className="scrollbar-hide flex snap-x gap-2 overflow-x-auto scroll-smooth pb-1"
        aria-label="Dashboard tour chapters"
      >
        {hostTourChapters.map((chapter, index) => {
          // Intro / outro title cards are not features; they stay off the strip.
          if (chapter.bookend) return null;
          const active = index === activeChapterIndex;
          const complete = index < activeChapterIndex;
          return (
            <button
              key={chapter.id}
              type="button"
              onClick={() => onSelect(index)}
              aria-current={active ? 'step' : undefined}
              className={cn(
                'focus-visible:ring-ring relative flex h-11 shrink-0 snap-start items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-muted-foreground hover:bg-muted/70 hover:text-foreground'
              )}
            >
              <chapter.icon className="size-4 shrink-0" aria-hidden />
              <span className="whitespace-nowrap pr-1">{chapter.label}</span>
              <span
                className={cn(
                  'absolute inset-x-3 bottom-1.5 h-0.5 overflow-hidden rounded-full',
                  active ? 'bg-primary-foreground/25' : 'bg-muted'
                )}
              >
                <span
                  className={cn(
                    'block h-full rounded-full',
                    active ? 'bg-primary-foreground' : 'bg-primary'
                  )}
                  style={{
                    width: complete ? '100%' : active ? `${chapterProgress}%` : '0%',
                  }}
                />
              </span>
            </button>
          );
        })}
      </div>

      {canScrollBack ? (
        <>
          <div className="from-card pointer-events-none absolute inset-y-0 left-0 hidden w-16 bg-gradient-to-r to-transparent sm:block" />
          <button
            type="button"
            className={cn(arrowClassName, 'left-1 mt-[-2px]')}
            onClick={() => scrollByPage(-1)}
            aria-label="Show earlier features"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
        </>
      ) : null}
      {canScrollForward ? (
        <>
          <div className="from-card pointer-events-none absolute inset-y-0 right-0 hidden w-16 bg-gradient-to-l to-transparent sm:block" />
          <button
            type="button"
            className={cn(arrowClassName, 'right-1 mt-[-2px]')}
            onClick={() => scrollByPage(1)}
            aria-label="Show more features"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </>
      ) : null}
    </div>
  );
}

export type HostDashboardTourVariant = 'marketing' | 'compact';
export type HostDashboardTourChapterNav = 'strip' | 'minimal';

export interface HostDashboardTourPlayerProps {
  variant?: HostDashboardTourVariant;
  chapterNavigation?: HostDashboardTourChapterNav;
  expandablePreview?: boolean;
  className?: string;
  regionLabel?: string;
}

export function HostDashboardTourPlayer({
  variant = 'marketing',
  chapterNavigation,
  expandablePreview,
  className,
  regionLabel = 'Interactive dashboard tour',
}: HostDashboardTourPlayerProps) {
  const inlinePlayerRef = useRef<PlayerRef>(null);
  const modalPlayerRef = useRef<PlayerRef>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [modalStartFrame, setModalStartFrame] = useState(0);
  const [modalAutoPlay, setModalAutoPlay] = useState(false);
  const [modalPlayerReady, setModalPlayerReady] = useState(false);
  const [inlineStartFrame] = useState(() => (prefersReducedMotion ? reducedMotionHoldFrame(0) : 0));
  const [currentFrame, setCurrentFrame] = useState(inlineStartFrame);
  const [isPlaying, setIsPlaying] = useState(false);
  const [narrationMuted, setNarrationMuted] = useState(true);
  const filmProps = useMemo(() => ({ narrationMuted }), [narrationMuted]);
  const compact = variant === 'compact';
  const chapterNav = chapterNavigation ?? (compact ? 'minimal' : 'strip');
  const canExpandPreview = expandablePreview ?? true;

  const getActivePlayer = useCallback(
    () => (previewOpen ? modalPlayerRef.current : inlinePlayerRef.current),
    [previewOpen]
  );

  const activeChapterIndex = hostTourChapterIndexAtFrame(currentFrame);
  const activeChapter = hostTourChapters[activeChapterIndex];

  useEffect(() => {
    const player = previewOpen ? modalPlayerRef.current : inlinePlayerRef.current;
    if (!player) return;

    const syncFrame = () => setCurrentFrame(player.getCurrentFrame());
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    syncFrame();
    setIsPlaying(player.isPlaying());
    player.addEventListener('frameupdate', syncFrame);
    player.addEventListener('play', onPlay);
    player.addEventListener('pause', onPause);

    return () => {
      player.removeEventListener('frameupdate', syncFrame);
      player.removeEventListener('play', onPlay);
      player.removeEventListener('pause', onPause);
    };
  }, [prefersReducedMotion, previewOpen, modalPlayerReady]);

  useEffect(() => {
    if (previewOpen || prefersReducedMotion) return;

    let cancelled = false;
    let attempts = 0;
    let raf = 0;

    const ensureInlinePlayback = () => {
      if (cancelled) return;
      const player = inlinePlayerRef.current;
      if (!player) {
        if (attempts++ < 30) raf = window.requestAnimationFrame(ensureInlinePlayback);
        return;
      }
      setIsPlaying(player.isPlaying());
      if (!player.isPlaying()) void player.play();
    };

    raf = window.requestAnimationFrame(ensureInlinePlayback);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
    };
  }, [previewOpen, prefersReducedMotion]);

  useEffect(() => {
    if (!previewOpen) return;

    let attempts = 0;
    let raf = 0;
    const syncModalPlayer = () => {
      const modal = modalPlayerRef.current;
      if (!modal) {
        if (attempts++ < 24) raf = window.requestAnimationFrame(syncModalPlayer);
        return;
      }
      modal.seekTo(modalStartFrame);
      setCurrentFrame(modalStartFrame);
      setModalPlayerReady(true);
      if (modalAutoPlay) void modal.play();
    };

    raf = window.requestAnimationFrame(syncModalPlayer);
    return () => window.cancelAnimationFrame(raf);
  }, [previewOpen, modalStartFrame, modalAutoPlay]);

  const openPreview = useCallback(() => {
    const inline = inlinePlayerRef.current;
    const frame = inline?.getCurrentFrame() ?? currentFrame;
    const playing = inline?.isPlaying() ?? isPlaying;
    inline?.pause();
    setModalStartFrame(frame);
    setModalAutoPlay(playing && !prefersReducedMotion);
    setCurrentFrame(frame);
    setIsPlaying(playing);
    setPreviewOpen(true);
  }, [currentFrame, isPlaying, prefersReducedMotion]);

  const handlePreviewOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        openPreview();
        return;
      }
      const modal = modalPlayerRef.current;
      const inline = inlinePlayerRef.current;
      if (modal && inline) {
        const frame = modal.getCurrentFrame();
        const playing = modal.isPlaying();
        modal.pause();
        inline.seekTo(frame);
        setCurrentFrame(frame);
        setIsPlaying(playing);
        if (playing && !prefersReducedMotion) void inline.play();
      }
      setPreviewOpen(false);
      setModalAutoPlay(false);
      setModalPlayerReady(false);
    },
    [prefersReducedMotion, openPreview]
  );

  const seekToChapter = useCallback(
    (index: number) => {
      const player = getActivePlayer();
      if (!player) return;
      const target = prefersReducedMotion
        ? reducedMotionHoldFrame(index)
        : (HOST_TOUR_CHAPTER_STARTS[index] ?? 0);
      player.seekTo(target);
      setCurrentFrame(target);
      if (!prefersReducedMotion) void player.play();
    },
    [getActivePlayer, prefersReducedMotion]
  );

  const togglePlayback = useCallback(() => {
    const player = getActivePlayer();
    if (!player) return;
    if (isPlaying) {
      player.pause();
      return;
    }
    void player.play();
  }, [getActivePlayer, isPlaying]);

  const toggleNarration = useCallback(() => {
    setNarrationMuted((muted) => !muted);
  }, []);

  const restart = useCallback(() => {
    const player = getActivePlayer();
    if (!player) return;
    player.seekTo(0);
    setCurrentFrame(0);
    if (!prefersReducedMotion) void player.play();
  }, [getActivePlayer, prefersReducedMotion]);

  const chapterProgress = useMemo(() => {
    const start = HOST_TOUR_CHAPTER_STARTS[activeChapterIndex] ?? 0;
    const duration = HOST_TOUR_CHAPTER_DURATIONS[activeChapterIndex] ?? 1;
    return Math.min(100, Math.max(0, ((currentFrame - start) / duration) * 100));
  }, [currentFrame, activeChapterIndex]);

  const tourProgress = useMemo(
    () => Math.min(100, (currentFrame / HOST_TOUR_DURATION_IN_FRAMES) * 100),
    [currentFrame]
  );

  const goToPreviousChapter = useCallback(() => {
    if (activeChapterIndex > 0) seekToChapter(activeChapterIndex - 1);
  }, [activeChapterIndex, seekToChapter]);

  const goToNextChapter = useCallback(() => {
    if (activeChapterIndex < hostTourChapters.length - 1) seekToChapter(activeChapterIndex + 1);
  }, [activeChapterIndex, seekToChapter]);

  const renderTourVideo = (
    playerRef: RefObject<PlayerRef | null>,
    options: {
      showExpand?: boolean;
      roundedClass?: string;
      playerKey: 'inline' | 'modal';
      startFrame: number;
      autoPlay?: boolean;
      /** Fill a parent that is already a 16:9 box. Width-based aspect ratio overflows the modal. */
      fillFrame?: boolean;
    }
  ) => (
    <div
      className={cn(
        'bg-muted relative overflow-hidden',
        options.fillFrame ? 'h-full w-full' : 'shrink-0',
        options.roundedClass ?? (compact ? 'rounded-lg' : 'rounded-[1rem] sm:rounded-[1.4rem]')
      )}
    >
      <Player
        key={
          options.playerKey === 'modal'
            ? prefersReducedMotion
              ? 'modal-reduced'
              : 'modal'
            : prefersReducedMotion
              ? 'inline-reduced'
              : 'inline'
        }
        ref={playerRef}
        component={HostDashboardFilm}
        inputProps={filmProps}
        durationInFrames={HOST_TOUR_DURATION_IN_FRAMES}
        compositionWidth={1280}
        compositionHeight={720}
        fps={HOST_TOUR_FPS}
        autoPlay={options.autoPlay ?? false}
        initialFrame={options.startFrame}
        loop={!prefersReducedMotion}
        controls={false}
        clickToPlay={false}
        spaceKeyToPlayOrPause={false}
        acknowledgeRemotionLicense
        style={
          options.fillFrame
            ? { width: '100%', height: '100%', display: 'block' }
            : { width: '100%', aspectRatio: '16 / 9', display: 'block' }
        }
      />
      <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-slate-950/10 dark:ring-white/10" />
      {chapterNav === 'minimal' ? (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-black/35"
          role="progressbar"
          aria-valuenow={Math.round(tourProgress)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Tour progress"
        >
          <div
            className="bg-primary h-full transition-[width] duration-150"
            style={{ width: `${tourProgress}%` }}
          />
        </div>
      ) : null}
      {options.showExpand && canExpandPreview && chapterNav === 'minimal' && !previewOpen ? (
        <button
          type="button"
          className="focus-visible:ring-primary/40 absolute right-0 top-0 z-10 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-white/50 bg-white/80 p-2 text-slate-600 shadow-sm backdrop-blur-md transition-[background-color,color,box-shadow] hover:bg-white hover:text-slate-900 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"
          onClick={openPreview}
          aria-label="Expand workspace preview"
        >
          <Maximize2 className="size-4" strokeWidth={2.25} aria-hidden />
        </button>
      ) : null}
    </div>
  );

  const renderControlsPanel = (inModal = false) => (
    <div
      className={cn(
        'shrink-0 pt-3',
        inModal ? 'px-0 pb-0 pt-3' : compact ? 'px-1.5 pb-1.5' : 'px-1 pb-1 sm:px-2 sm:pb-2 sm:pt-4'
      )}
    >
      <div
        className={cn(
          'flex gap-2.5',
          chapterNav === 'minimal' ? 'items-start' : 'items-center',
          !compact && 'sm:gap-3'
        )}
      >
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="min-h-[44px] min-w-[44px] rounded-full"
            onClick={togglePlayback}
            aria-label={isPlaying ? 'Pause dashboard tour' : 'Play dashboard tour'}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" aria-hidden />
            ) : (
              <Play className="h-4 w-4" aria-hidden />
            )}
          </Button>
          <Button
            type="button"
            variant={narrationMuted ? 'default' : 'outline'}
            size="icon"
            className="min-h-[44px] min-w-[44px] rounded-full"
            onClick={toggleNarration}
            aria-label={narrationMuted ? 'Unmute narration' : 'Mute narration'}
            aria-pressed={!narrationMuted}
          >
            {narrationMuted ? (
              <VolumeX className="h-4 w-4" aria-hidden />
            ) : (
              <Volume2 className="h-4 w-4" aria-hidden />
            )}
          </Button>
        </div>
        <div className="min-w-0 flex-1">
          {chapterNav === 'minimal' && activeChapter ? (
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
                  <activeChapter.icon className="size-[18px]" aria-hidden />
                </span>
                <p className="text-foreground text-lg font-bold tracking-tight xl:text-xl">
                  {activeChapter.label}
                </p>
              </div>
              <p className="text-muted-foreground mt-1.5 line-clamp-2 text-xs leading-relaxed">
                {activeChapter.description}
              </p>
            </div>
          ) : (
            <>
              <p className="text-foreground truncate text-sm font-semibold sm:text-base">
                {activeChapter?.title}
              </p>
              <p className="text-muted-foreground mt-1 truncate text-xs">
                {activeChapter?.description}
              </p>
            </>
          )}
        </div>
        {!compact ? (
          <span className="text-muted-foreground hidden text-xs tabular-nums sm:block">
            {formatTourTime(currentFrame)} / {HOST_TOUR_TOTAL_LABEL}
          </span>
        ) : null}
        {chapterNav === 'minimal' ? (
          <div className="flex shrink-0 items-center gap-1 pt-0.5">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="min-h-[44px] min-w-[44px] rounded-full"
              onClick={goToPreviousChapter}
              disabled={activeChapterIndex === 0}
              aria-label="Previous feature"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="min-h-[44px] min-w-[44px] rounded-full"
              onClick={goToNextChapter}
              disabled={activeChapterIndex >= hostTourChapters.length - 1}
              aria-label="Next feature"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        ) : (
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="min-h-[44px] min-w-[44px] rounded-full"
              onClick={restart}
              aria-label="Restart dashboard tour"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
            </Button>
            {canExpandPreview && !inModal ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="min-h-[44px] min-w-[44px] rounded-full"
                onClick={openPreview}
                aria-label="Expand workspace preview"
                title="Full view"
              >
                <Maximize2 className="h-4 w-4" aria-hidden />
              </Button>
            ) : null}
          </div>
        )}
      </div>

      {chapterNav === 'strip' ? (
        <TourChapterStrip
          activeChapterIndex={activeChapterIndex}
          chapterProgress={chapterProgress}
          onSelect={seekToChapter}
          reducedMotion={prefersReducedMotion}
        />
      ) : null}

      <p className="sr-only" aria-live="polite">
        Showing {activeChapter?.label}: {activeChapter?.title}. {activeChapter?.narration}
      </p>
    </div>
  );

  const cardClassName = cn(
    compact
      ? 'border-border/80 bg-card/95 flex w-full flex-col rounded-xl border shadow-md backdrop-blur-sm'
      : 'border-border bg-card shadow-primary/10 mx-auto w-full max-w-[min(80rem,max(20rem,calc((100dvh-17rem)*16/9)))] rounded-[1.4rem] border p-2 shadow-2xl sm:rounded-[2rem] sm:p-3',
    compact ? 'p-2' : undefined,
    className
  );

  return (
    <>
      <div role="region" aria-label={regionLabel} className={cardClassName}>
        {renderTourVideo(inlinePlayerRef, {
          showExpand: true,
          playerKey: 'inline',
          startFrame: inlineStartFrame,
          autoPlay: !prefersReducedMotion && !previewOpen,
        })}
        {renderControlsPanel()}
      </div>

      {canExpandPreview ? (
        <Dialog open={previewOpen} onOpenChange={handlePreviewOpenChange}>
          <DialogContent
            showCloseButton={false}
            className="flex h-[min(94dvh,920px)] max-h-[min(94dvh,920px)] w-[min(calc(100vw-2rem),72rem)] max-w-none flex-col gap-4 overflow-hidden p-4 sm:max-w-none sm:gap-5 sm:p-5"
          >
            <div className="flex shrink-0 items-center justify-between gap-4">
              <DialogTitle className="text-foreground text-lg font-bold tracking-tight sm:text-xl">
                Workspace preview
              </DialogTitle>
              <DialogClose
                className="text-muted-foreground ring-offset-background hover:bg-muted focus-visible:ring-ring flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl opacity-80 transition-all hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                aria-label="Close expanded preview"
              >
                <X className="size-5 shrink-0" aria-hidden />
              </DialogClose>
            </div>
            <DialogDescription className="sr-only">
              Larger preview of the dashboard tour. Playback stays in sync with the inline player.
            </DialogDescription>
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden sm:gap-5">
              <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden [container-type:size]">
                {previewOpen ? (
                  <div
                    className="max-h-full max-w-full"
                    style={{
                      width: 'min(100cqw, calc(100cqh * 16 / 9))',
                      height: 'min(100cqh, calc(100cqw * 9 / 16))',
                    }}
                  >
                    {renderTourVideo(modalPlayerRef, {
                      roundedClass: 'rounded-lg',
                      playerKey: 'modal',
                      startFrame: modalStartFrame,
                      autoPlay: modalAutoPlay,
                      fillFrame: true,
                    })}
                  </div>
                ) : null}
              </div>
              {renderControlsPanel(true)}
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
