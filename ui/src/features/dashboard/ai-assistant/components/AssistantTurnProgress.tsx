import { useEffect, useMemo, useState } from 'react';

import { Check, Sparkles, X } from 'lucide-react';

import { StepFailureHint } from '@/features/dashboard/ai-assistant/components/StepFailureHint';
import {
  withActiveTurnStep,
  type TurnProgressLiveState,
} from '@/features/dashboard/ai-assistant/lib/assistantStream';

import { cn } from '@/lib/utils';

export type TurnProgressStep = {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'done' | 'failed';
  reason?: string;
};

type TurnProgressProps = {
  steps?: TurnProgressStep[];
  live?: TurnProgressLiveState | null;
  startedAtMs?: number;
};

const DEFAULT_WAIT_STEPS: Array<{ id: string; label: string; afterMs: number }> = [
  { id: 'understand', label: 'Understanding your question', afterMs: 0 },
  { id: 'gather', label: 'Gathering data from your account', afterMs: 1200 },
  { id: 'answer', label: 'Preparing your answer', afterMs: 4500 },
];

/** A step running at least this long shows its own timer so the host can see it is not frozen. */
const STEP_TIMER_AFTER_MS = 8000;
/** Past this, the default heading switches to "Still working". */
const SLOW_TURN_AFTER_MS = 30000;

function buildDefaultSteps(elapsedMs: number): TurnProgressStep[] {
  let lastActiveIndex = 0;
  DEFAULT_WAIT_STEPS.forEach((step, index) => {
    if (elapsedMs >= step.afterMs) lastActiveIndex = index;
  });
  return DEFAULT_WAIT_STEPS.map((step, index) => ({
    id: step.id,
    label: step.label,
    status:
      index < lastActiveIndex
        ? 'done'
        : index === lastActiveIndex
          ? 'active'
          : ('pending' as const),
  }));
}

function formatElapsed(ms: number): string {
  const totalSec = Math.max(1, Math.round(ms / 1000));
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}m ${String(sec).padStart(2, '0')}s`;
}

function SpinnerRing({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className={cn('text-primary motion-safe:animate-spin', className)}
      aria-hidden
    >
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity={0.18} strokeWidth="1.75" />
      <path
        d="M8 1.5a6.5 6.5 0 0 1 6.5 6.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function StepStatusIcon({ status }: { status: TurnProgressStep['status'] }) {
  if (status === 'active') return <SpinnerRing className="size-4" />;
  if (status === 'done') {
    return (
      <span className="bg-primary/15 text-primary flex size-4 items-center justify-center rounded-full">
        <Check className="size-2.5" strokeWidth={3} aria-hidden />
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="bg-destructive/15 text-destructive flex size-4 items-center justify-center rounded-full">
        <X className="size-2.5" strokeWidth={3} aria-hidden />
      </span>
    );
  }
  return (
    <span className="border-muted-foreground/30 size-3.5 rounded-full border-[1.5px]" aria-hidden />
  );
}

/** In-flight turn progress: live SSE tool rows when available, else generic phases. */
export function AssistantTurnProgress({ steps, live, startedAtMs }: TurnProgressProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [origin] = useState(() => startedAtMs ?? Date.now());
  const [activeSince, setActiveSince] = useState<{ id: string; at: number } | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, []);

  const turnStart = startedAtMs ?? origin;
  const elapsedMs = Math.max(0, nowMs - turnStart);

  const resolvedSteps = useMemo(() => {
    if (live?.steps.length) return withActiveTurnStep(live.steps);
    if (steps?.length) return withActiveTurnStep(steps);
    return buildDefaultSteps(elapsedMs);
  }, [live, steps, elapsedMs]);

  const activeStep = resolvedSteps.find((step) => step.status === 'active') ?? null;
  const activeKey = activeStep ? `${activeStep.id}:${activeStep.label}` : null;

  useEffect(() => {
    setActiveSince(activeKey ? { id: activeKey, at: Date.now() } : null);
  }, [activeKey]);

  const activeElapsedMs =
    activeSince && activeSince.id === activeKey ? Math.max(0, nowMs - activeSince.at) : 0;
  const heading =
    live?.planTitle ?? (elapsedMs >= SLOW_TURN_AFTER_MS ? 'Still working' : 'Working on it');

  return (
    <div className="flex justify-start">
      <div
        className={cn(
          'border-border/60 bg-card w-full max-w-[92%] space-y-3 rounded-2xl rounded-bl-md border px-3 py-3 shadow-sm',
          'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-200'
        )}
      >
        <p role="status" className="sr-only">
          {activeStep ? activeStep.label : heading}
        </p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-foreground inline-flex min-w-0 items-center gap-2.5 text-sm font-medium">
            <span className="bg-primary/10 flex size-7 shrink-0 items-center justify-center rounded-full">
              <Sparkles className="text-primary size-3.5" aria-hidden />
            </span>
            <span className="truncate">{heading}</span>
          </span>
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums" aria-hidden>
            {formatElapsed(elapsedMs)}
          </span>
        </div>
        <ol className="pl-1.5">
          {resolvedSteps.map((step, index) => {
            const isLast = index === resolvedSteps.length - 1;
            const showStepTimer =
              step.status === 'active' && activeElapsedMs >= STEP_TIMER_AFTER_MS;
            return (
              <li
                key={step.id}
                className={cn(
                  'relative flex items-center gap-2.5 text-xs',
                  !isLast && 'pb-2.5',
                  'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-left-1 motion-safe:duration-200'
                )}
              >
                {!isLast && (
                  <span
                    className={cn(
                      'absolute bottom-0.5 left-[7.5px] top-[18px] w-px',
                      step.status === 'done' ? 'bg-primary/25' : 'bg-border'
                    )}
                    aria-hidden
                  />
                )}
                <span className="relative flex size-4 shrink-0 items-center justify-center">
                  <StepStatusIcon status={step.status} />
                </span>
                <span
                  className={cn(
                    'min-w-0 leading-4 transition-colors duration-200',
                    step.status === 'active' && 'text-foreground font-medium',
                    step.status === 'done' && 'text-muted-foreground',
                    step.status === 'pending' && 'text-muted-foreground/70',
                    step.status === 'failed' && 'text-muted-foreground'
                  )}
                >
                  {step.label}
                </span>
                {step.status === 'failed' && (
                  <StepFailureHint reason={step.reason} className="-ml-1" />
                )}
                {showStepTimer && (
                  <span
                    className="text-muted-foreground ml-auto shrink-0 text-[11px] tabular-nums"
                    aria-hidden
                  >
                    {formatElapsed(activeElapsedMs)}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
