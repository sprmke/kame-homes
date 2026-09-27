import { useEffect, useState } from 'react';

import { Sparkles } from 'lucide-react';

import type { AiReviewPeriodKind } from '@/features/dashboard/analytics/lib/aiReviewPeriod';
import { AI_REVIEW_PERIOD_LABEL } from '@/features/dashboard/analytics/lib/aiReviewPeriod';

import { cn } from '@/lib/utils';

const STATUS_LINES = [
  'Reading your metrics',
  'Comparing to the prior period',
  'Drafting what is working',
  'Writing what to improve',
] as const;

type Props = {
  periodKind?: AiReviewPeriodKind | null;
  className?: string;
};

/**
 * In-card generating stage for AI Performance Review. Soft aurora + orbit ring with
 * cycling status lines (same motion tokens as Marketing AI Studio).
 */
export function AiPerformanceReviewGeneratingStage({ periodKind = null, className }: Props) {
  const [statusIndex, setStatusIndex] = useState(0);
  const periodLabel = periodKind ? AI_REVIEW_PERIOD_LABEL[periodKind] : 'this period';

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    const id = window.setInterval(() => {
      setStatusIndex((current) => (current + 1) % STATUS_LINES.length);
    }, 2000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Analyzing ${periodLabel}`}
      className={cn(
        'border-border/60 bg-muted/20 relative flex min-h-[14rem] flex-col items-center justify-center overflow-hidden rounded-xl border px-4 py-10 sm:min-h-[16rem]',
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="bg-primary/20 animate-ai-gen-aurora absolute -left-1/4 -top-1/4 size-[70%] rounded-full blur-3xl" />
        <div
          className="bg-primary/10 animate-ai-gen-aurora absolute -bottom-1/4 -right-1/4 size-[65%] rounded-full blur-3xl"
          style={{ animationDelay: '1.4s' }}
        />
        <div className="from-background/0 via-primary/10 to-background/0 animate-ai-gen-shimmer absolute inset-0 bg-gradient-to-r" />
      </div>

      <div className="relative z-[1] flex flex-col items-center gap-4 text-center">
        <div className="relative flex size-16 items-center justify-center sm:size-20">
          <div className="bg-primary/20 animate-ai-gen-orb absolute inset-2 rounded-full blur-md" />
          <svg className="absolute inset-0 size-full -rotate-90" viewBox="0 0 80 80" aria-hidden>
            <circle
              cx="40"
              cy="40"
              r="32"
              fill="none"
              className="stroke-border/50"
              strokeWidth="3"
            />
            <circle
              cx="40"
              cy="40"
              r="32"
              fill="none"
              className="stroke-primary animate-ai-gen-ring"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="201"
            />
          </svg>
          <Sparkles
            className="text-primary animate-ai-gen-spark relative size-6 sm:size-7"
            aria-hidden
          />
        </div>

        <div className="space-y-1">
          <p className="text-foreground text-sm font-semibold tracking-tight">
            Analyzing {periodLabel}
          </p>
          <p
            key={statusIndex}
            className="text-muted-foreground animate-in fade-in-0 min-h-[1.25rem] text-xs duration-300 motion-reduce:animate-none"
          >
            {STATUS_LINES[statusIndex]}
          </p>
        </div>
      </div>
    </div>
  );
}
