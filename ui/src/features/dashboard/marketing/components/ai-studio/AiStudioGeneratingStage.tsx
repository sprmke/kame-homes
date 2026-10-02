import { useEffect, useState } from 'react';

import type { MarketingGenerationJob } from '@/features/dashboard/marketing/lib/marketingGenerationTypes';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const IMAGE_LINES = [
  'Reading your prompt',
  'Framing the space',
  'Setting the light',
  'Adding final details',
] as const;

const VIDEO_LINES = [
  'Reading your prompt',
  'Planning the walkthrough',
  'Rendering frames',
  'Adding final details',
] as const;

const VIDEO_RENDER_LINES = [
  'Rendering frames',
  'Smoothing motion',
  'Adding final details',
] as const;

const STEP_MS = 2800;

/** Time constants for the eased progress estimate (images 5-15s, video 11s to 6min). */
const EXPECTED_MS = { image: 12_000, video: 90_000 } as const;

type Props = {
  /**
   * `hero` fills the empty results pane, `card` is a standalone gallery card shaped
   * like a finished job card, `fill` covers the media area of an existing card.
   */
  variant?: 'hero' | 'card' | 'fill';
  mediaType?: 'image' | 'video';
  /** In-flight job row: drives the status line, elapsed time and progress start. */
  job?: MarketingGenerationJob;
  label?: string;
  className?: string;
};

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function useElapsed(startedAt: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);
  return Math.max(0, now - startedAt);
}

function estimateProgress(
  elapsedMs: number,
  mediaType: 'image' | 'video',
  status?: MarketingGenerationJob['jobStatus']
): number {
  const eased = 1 - Math.exp(-elapsedMs / EXPECTED_MS[mediaType]);
  const floor = status === 'finalizing' ? 0.9 : status === 'processing' ? 0.12 : 0.03;
  return Math.min(0.96, Math.max(floor, 0.03 + eased * 0.9));
}

function statusLine(
  step: number,
  mediaType: 'image' | 'video',
  status?: MarketingGenerationJob['jobStatus']
): string {
  if (status === 'finalizing') return 'Saving';
  if (mediaType === 'video' && status === 'pending') return 'Queued';
  if (mediaType === 'video' && status === 'processing') {
    return VIDEO_RENDER_LINES[step % VIDEO_RENDER_LINES.length];
  }
  const lines = mediaType === 'video' ? VIDEO_LINES : IMAGE_LINES;
  return lines[Math.min(step, lines.length - 1)];
}

/** One continuous stroke (floor, walls, roof, door) that draws, holds, and clears. */
function HomeMark({ large }: { large: boolean }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      className={cn('text-primary shrink-0', large ? 'size-11' : 'size-9')}
      aria-hidden
    >
      <path
        className="ai-gen-house"
        pathLength={1}
        d="M20.5 40H11V21L24 10l13 11v19h-9.5v-9h-7Z"
        stroke="currentColor"
        strokeWidth={large ? 1.75 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Generating stage in the Airbnb / Apple Photos register: a quiet surface with a slow
 * neutral shimmer, a line-drawn home, one status line and a hairline progress estimate
 * (never a percentage). Video adds an elapsed timer since renders can take minutes.
 */
export function AiStudioGeneratingStage({
  variant = 'hero',
  mediaType = 'image',
  job,
  label,
  className,
}: Props) {
  const [mountedAt] = useState(() => Date.now());
  const jobStartedAt = job ? Date.parse(job.createdAt) : NaN;
  const startedAt = Number.isFinite(jobStartedAt) ? Math.min(jobStartedAt, mountedAt) : mountedAt;
  const elapsedMs = useElapsed(startedAt);

  const status = job?.jobStatus;
  const title = label ?? (mediaType === 'video' ? 'Generating video' : 'Generating image');
  const line = statusLine(Math.floor(elapsedMs / STEP_MS), mediaType, status);
  const progress = estimateProgress(elapsedMs, mediaType, status);
  const elapsed = mediaType === 'video' ? formatElapsed(elapsedMs) : null;
  const large = variant === 'hero';
  const announcement =
    status === 'finalizing'
      ? `${title}. Saving.`
      : status === 'pending'
        ? `${title}. Queued.`
        : title;

  const stage = (
    <div
      role="status"
      className={cn(
        'bg-muted/40 relative flex flex-col items-center justify-center overflow-hidden',
        variant === 'hero' && 'border-border/60 min-h-[16rem] rounded-2xl border sm:min-h-[22rem]',
        variant === 'card' && 'aspect-square',
        variant === 'fill' && 'absolute inset-0',
        variant !== 'card' && className
      )}
    >
      <span className="sr-only">{announcement}</span>
      <div
        className="via-foreground/[0.04] animate-ai-gen-shimmer pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent to-transparent"
        aria-hidden
      />

      <div
        className={cn(
          'relative flex w-full flex-col items-center text-center',
          large ? 'gap-4 px-6' : 'gap-3 px-4'
        )}
        aria-hidden
      >
        <HomeMark large={large} />
        <div className="w-full min-w-0 space-y-1">
          <p
            className={cn(
              'text-foreground truncate font-semibold tracking-tight',
              large ? 'text-sm' : 'text-[13px]'
            )}
          >
            {title}
          </p>
          <p className="text-muted-foreground flex items-center justify-center gap-1.5 text-xs">
            <span key={line} className="animate-ai-gen-status min-w-0 truncate">
              {line}
            </span>
            {elapsed && <span className="shrink-0 tabular-nums">· {elapsed}</span>}
          </p>
        </div>
      </div>

      <div className="bg-foreground/[0.06] absolute inset-x-0 bottom-0 h-0.5" aria-hidden>
        <div
          className="bg-primary h-full origin-left transition-transform duration-700 ease-out rtl:origin-right"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>
    </div>
  );

  if (variant !== 'card') return stage;

  return (
    <article
      className={cn(
        'border-border/70 bg-card flex flex-col overflow-hidden rounded-2xl border shadow-sm',
        className
      )}
    >
      {stage}
      <div className="flex flex-1 flex-col gap-2.5 p-3" aria-hidden>
        <Skeleton className="h-3.5 w-4/5" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="mt-auto h-11 w-full rounded-lg sm:h-9" />
      </div>
    </article>
  );
}
