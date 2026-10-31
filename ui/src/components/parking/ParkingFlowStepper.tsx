import { cn } from '@/lib/utils';

export type ParkingFlowStepItem = {
  id: string;
  label: string;
};

type Props = {
  steps: readonly ParkingFlowStepItem[];
  /** 0-based active index. */
  activeIndex: number;
  className?: string;
  /** When set, step labels jump to that index. */
  onStepSelect?: (index: number) => void;
  /** When false, only the active step label is shown (Setup Guide listing pane). */
  showAllLabels?: boolean;
};

/**
 * Shared parking-flow stepper — all labels · trail + fraction + segmented bar.
 * Same chrome on registration form, guest status, host booking detail, and the
 * Setup Guide listing pane.
 */
export function ParkingFlowStepper({
  steps,
  activeIndex,
  className,
  onStepSelect,
  showAllLabels = true,
}: Props) {
  const safeIndex = Math.min(Math.max(activeIndex, 0), Math.max(steps.length - 1, 0));
  const current = steps[safeIndex];
  const displayIndex = safeIndex + 1;
  const interactive = typeof onStepSelect === 'function';

  return (
    <nav aria-label="Progress" className={cn('w-full', className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-muted-foreground min-w-0 text-xs font-medium uppercase tracking-wide">
          {showAllLabels ? (
            steps.map((step, index) => {
              const currentStep = index === safeIndex;
              const labelClass = cn(currentStep && 'text-foreground font-semibold');
              return (
                <span key={step.id}>
                  {index > 0 ? <span className="text-border mx-1.5">·</span> : null}
                  {interactive ? (
                    <button
                      type="button"
                      onClick={() => onStepSelect?.(index)}
                      aria-current={currentStep ? 'step' : undefined}
                      className={cn(
                        'hover:text-foreground inline-flex min-h-11 items-center rounded-sm sm:min-h-0',
                        'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
                        labelClass
                      )}
                    >
                      {step.label}
                    </button>
                  ) : (
                    <span className={labelClass} aria-current={currentStep ? 'step' : undefined}>
                      {step.label}
                    </span>
                  )}
                </span>
              );
            })
          ) : interactive ? (
            <button
              type="button"
              onClick={() => onStepSelect?.(safeIndex)}
              aria-current="step"
              className={cn(
                'text-foreground inline-flex min-h-11 items-center rounded-sm font-semibold sm:min-h-0',
                'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1'
              )}
            >
              {current?.label ?? 'Step'}
            </button>
          ) : (
            <span className="text-foreground font-semibold" aria-current="step">
              {current?.label ?? 'Step'}
            </span>
          )}
        </div>
        <p className="text-muted-foreground shrink-0 text-xs tabular-nums">
          {displayIndex}/{steps.length}
        </p>
      </div>
      <div
        className="mt-2.5 flex items-center gap-1"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuenow={displayIndex}
        aria-valuetext={`Step ${displayIndex} of ${steps.length}: ${current?.label ?? ''}`}
      >
        {steps.map((step, index) => (
          <span
            key={step.id}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors duration-300',
              index <= safeIndex ? 'bg-primary' : 'bg-muted'
            )}
            aria-hidden
          />
        ))}
      </div>
    </nav>
  );
}

export const PARKING_REQUEST_FORM_STEPS: ParkingFlowStepItem[] = [
  { id: 'guest', label: 'Guest' },
  { id: 'booking', label: 'Booking' },
  { id: 'vehicle', label: 'Vehicle' },
];

export const PARKING_STATUS_FLOW_STEPS: ParkingFlowStepItem[] = [
  { id: 'match', label: 'Match' },
  { id: 'pay', label: 'Pay' },
  { id: 'done', label: 'Done' },
];

export function parkingStatusFlowIndex(status: string): number {
  if (status === 'PENDING_HOST_ACCEPTANCE') return 0;
  if (status === 'PENDING_PAYMENT') return 1;
  if (status === 'PENDING_REVIEW' || status === 'READY_FOR_CHECKIN' || status === 'COMPLETED') {
    return 2;
  }
  return 0;
}
