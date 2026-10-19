import { Check } from 'lucide-react';

import type {
  GuestFormStepConfig,
  GuestFormStepId,
} from '@/features/guest/form/lib/guestFormSteps';

import { cn } from '@/lib/utils';

/** Horizontal inset so the track runs center-to-center on equal flex columns. */
function trackInset(stepCount: number): string {
  return `calc(100% / ${stepCount * 2})`;
}

/** Keep connector lines readable — wider forms get a bit more rail, never full bleed. */
function stepperDesktopWidthClass(stepCount: number): string {
  if (stepCount <= 3) return 'max-w-md';
  if (stepCount === 4) return 'max-w-lg';
  return 'max-w-xl';
}

function StepTrack({ stepCount, activeIndex }: { stepCount: number; activeIndex: number }) {
  if (stepCount <= 1) return null;

  const progressPct = (activeIndex / (stepCount - 1)) * 100;

  return (
    <div
      className="pointer-events-none absolute top-[1.125rem] h-0.5 -translate-y-1/2"
      style={{ left: trackInset(stepCount), right: trackInset(stepCount) }}
      aria-hidden
    >
      <div className="bg-border absolute inset-0 rounded-full" />
      <div
        className="bg-primary absolute inset-y-0 left-0 rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none"
        style={{ width: `${progressPct}%` }}
      />
    </div>
  );
}

function StepNode({
  step,
  activeStep,
}: {
  step: GuestFormStepConfig;
  activeStep: GuestFormStepId;
}) {
  const done = activeStep > step.id;
  const current = activeStep === step.id;
  const upcoming = !done && !current;
  const Icon = step.icon;

  return (
    <li className="relative z-10 flex min-w-0 flex-1 flex-col items-center">
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200',
          // Opaque fill masks the track so the line reads as passing behind the node.
          'bg-background',
          done && 'border-primary bg-primary-strong text-primary-foreground',
          current && 'border-primary text-primary shadow-sm',
          upcoming && 'border-border text-muted-foreground'
        )}
        aria-current={current ? 'step' : undefined}
      >
        {done ? (
          <Check className="size-4" strokeWidth={2.5} aria-hidden />
        ) : (
          <Icon className="size-4" strokeWidth={current ? 2.25 : 2} aria-hidden />
        )}
      </span>

      <p
        className={cn(
          'mt-2.5 max-w-full truncate px-0.5 text-center text-xs leading-tight',
          current && 'text-foreground font-semibold',
          done && !current && 'text-foreground font-medium',
          upcoming && 'text-muted-foreground font-normal'
        )}
      >
        {step.title}
      </p>
    </li>
  );
}

export function GuestFormStepper({
  activeStep,
  steps,
}: {
  activeStep: GuestFormStepId;
  steps: GuestFormStepConfig[];
}) {
  const activeIndex = Math.max(
    0,
    steps.findIndex((step) => step.id === activeStep)
  );
  const progressPct =
    steps.length <= 1 ? 100 : Math.round((activeIndex / (steps.length - 1)) * 100);
  const current = steps[activeIndex] ?? steps[0];
  const displayIndex = activeIndex + 1;

  return (
    <nav aria-label="Form steps" className="w-full">
      {/* Mobile */}
      <div className="space-y-2.5 sm:hidden">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-foreground text-sm font-semibold tracking-tight">
            {current?.title ?? 'Step'}
          </p>
          <p className="text-muted-foreground text-xs tabular-nums">
            {displayIndex} / {steps.length}
          </p>
        </div>
        <div
          className="bg-border h-1 overflow-hidden rounded-full"
          role="progressbar"
          aria-valuenow={displayIndex}
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-label={`Step ${displayIndex} of ${steps.length}`}
        >
          <div
            className="bg-primary h-full rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Desktop — one continuous track, nodes on top */}
      <ol
        className={cn(
          'relative mx-auto hidden w-full pb-0.5 sm:flex',
          stepperDesktopWidthClass(steps.length)
        )}
      >
        <StepTrack stepCount={steps.length} activeIndex={activeIndex} />
        {steps.map((step) => (
          <StepNode key={step.id} step={step} activeStep={activeStep} />
        ))}
      </ol>
    </nav>
  );
}
