import { useEffect, useState } from 'react';

import { CheckCircle2, Circle, Loader2 } from 'lucide-react';

import type { MarketingGenerationJob } from '@/features/dashboard/marketing/lib/marketingGenerationTypes';

import { cn } from '@/lib/utils';

type Props = {
  job: MarketingGenerationJob;
};

const STEPS: Array<{ key: MarketingGenerationJob['jobStatus']; label: string }> = [
  { key: 'pending', label: 'Queued' },
  { key: 'processing', label: 'Rendering' },
  { key: 'finalizing', label: 'Saving' },
];

const STEP_ORDER: Record<string, number> = { pending: 0, processing: 1, finalizing: 2 };

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Elapsed timer + status ladder for an in-flight video job. Veo latency ranges from
 * ~11s to ~6min, so this exists to keep the host from assuming something is stuck —
 * see marketingGenerationProgress.ts's STUCK_PROCESSING_MS for the actual stuck cutoff.
 */
export function AiStudioVideoProgress({ job }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const startedAt = Date.parse(job.createdAt);
  const elapsedMs = Number.isFinite(startedAt) ? now - startedAt : 0;
  const currentStep = STEP_ORDER[job.jobStatus] ?? 0;

  return (
    <div className="flex flex-col items-center gap-3 p-4 text-center">
      <div className="flex items-center gap-2">
        {STEPS.map((step, index) => (
          <div key={step.key} className="flex items-center gap-1.5">
            {index < currentStep ? (
              <CheckCircle2 className="text-primary size-4 shrink-0" />
            ) : index === currentStep ? (
              <Loader2 className="text-primary size-4 shrink-0 animate-spin" />
            ) : (
              <Circle className="text-muted-foreground/40 size-4 shrink-0" />
            )}
            <span
              className={cn(
                'text-xs',
                index <= currentStep ? 'text-foreground' : 'text-muted-foreground/60'
              )}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>
      <span className="text-muted-foreground text-[11px] tabular-nums">
        {formatElapsed(elapsedMs)} elapsed
      </span>
    </div>
  );
}
