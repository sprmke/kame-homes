import { useEffect, useState } from 'react';

import { Sparkles } from 'lucide-react';

import { cn } from '@/lib/utils';

const STATUS_LINES = [
  'Reading your prompt',
  'Composing the shot',
  'Rendering detail',
  'Almost ready',
] as const;

type Props = {
  /** Compact card for the gallery grid; default is the empty-state hero stage. */
  variant?: 'hero' | 'card';
  mediaType?: 'image' | 'video';
  className?: string;
};

/**
 * Generating stage — Midjourney / Leonardo-style focus: soft aurora, orbit ring,
 * cycling status. Hero fills the empty results pane; card sits in the gallery grid.
 */
export function AiStudioGeneratingStage({
  variant = 'hero',
  mediaType = 'image',
  className,
}: Props) {
  const [statusIndex, setStatusIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setStatusIndex((current) => (current + 1) % STATUS_LINES.length);
    }, 2200);
    return () => window.clearInterval(id);
  }, []);

  const label = mediaType === 'video' ? 'Generating video' : 'Generating image';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn(
        'border-border/60 relative overflow-hidden rounded-2xl border',
        variant === 'hero' &&
          'bg-muted/20 flex min-h-[16rem] flex-col items-center justify-center p-8 sm:min-h-[22rem]',
        variant === 'card' && 'bg-muted/30 aspect-square',
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="bg-primary/25 animate-ai-gen-aurora absolute -left-1/4 -top-1/4 size-[70%] rounded-full blur-3xl" />
        <div
          className="bg-primary/15 animate-ai-gen-aurora absolute -bottom-1/4 -right-1/4 size-[65%] rounded-full blur-3xl"
          style={{ animationDelay: '1.4s' }}
        />
        <div className="from-background/0 via-primary/10 to-background/0 animate-ai-gen-shimmer absolute inset-0 bg-gradient-to-r" />
      </div>

      <div className="relative z-[1] flex flex-col items-center gap-4 text-center">
        <div className="relative flex size-20 items-center justify-center sm:size-24">
          <div className="bg-primary/20 animate-ai-gen-orb absolute inset-2 rounded-full blur-md" />
          <svg className="absolute inset-0 size-full -rotate-90" viewBox="0 0 96 96" aria-hidden>
            <circle
              cx="48"
              cy="48"
              r="40"
              fill="none"
              className="stroke-border/50"
              strokeWidth="3"
            />
            <circle
              cx="48"
              cy="48"
              r="40"
              fill="none"
              className="stroke-primary animate-ai-gen-ring"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="251"
            />
          </svg>
          <Sparkles
            className="text-primary animate-ai-gen-spark relative size-7 sm:size-8"
            aria-hidden
          />
        </div>

        <div className="space-y-1">
          <p className="text-foreground text-sm font-semibold tracking-tight">{label}</p>
          <p className="text-muted-foreground min-h-[1.25rem] text-xs tabular-nums">
            {STATUS_LINES[statusIndex]}
          </p>
        </div>
      </div>
    </div>
  );
}
