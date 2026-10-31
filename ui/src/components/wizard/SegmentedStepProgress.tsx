import { cn } from '@/lib/utils';

type SegmentedStepProgressProps = {
  labels: readonly string[];
  currentIndex: number;
  disabled?: boolean;
};

/**
 * Segmented wizard progress — shared by Import with AI and Marketing generate modals.
 * Labels are for screen readers; the active step title lives in the body heading.
 */
export function SegmentedStepProgress({
  labels,
  currentIndex,
  disabled,
}: SegmentedStepProgressProps) {
  const current = labels[currentIndex] ?? '';

  return (
    <div className={cn('flex items-center gap-2', disabled && 'pointer-events-none opacity-60')}>
      <div
        className="flex flex-1 items-center gap-1"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={labels.length}
        aria-valuenow={currentIndex + 1}
        aria-valuetext={`Step ${currentIndex + 1} of ${labels.length}: ${current}`}
      >
        {labels.map((label, index) => (
          <span
            key={label}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors',
              index <= currentIndex ? 'bg-primary' : 'bg-muted'
            )}
            aria-hidden
          />
        ))}
      </div>
      <span className="text-muted-foreground shrink-0 text-xs font-medium tabular-nums" aria-hidden>
        {currentIndex + 1}/{labels.length}
      </span>
    </div>
  );
}
