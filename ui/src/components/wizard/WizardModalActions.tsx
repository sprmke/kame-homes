import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type WizardModalActionsProps = {
  onCancel: () => void;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
  isFirstStep: boolean;
  isLastStep: boolean;
  submitPending?: boolean;
  submitLabel: string;
  pendingLabel?: string;
  canGoNext?: boolean;
  className?: string;
};

/**
 * Stepper modal footer: Back (left) · Cancel + Next/Submit (right).
 * Back is navigation; Cancel dismisses. Keep Cancel content-sized (not flex-1).
 */
export function WizardModalActions({
  onCancel,
  onBack,
  onNext,
  onSubmit,
  isFirstStep,
  isLastStep,
  submitPending = false,
  submitLabel,
  pendingLabel,
  canGoNext = true,
  className,
}: WizardModalActionsProps) {
  return (
    <div className={cn('flex w-full flex-row items-center gap-2', className)}>
      <div className="flex min-w-0 flex-1 justify-start">
        {!isFirstStep ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px]"
            onClick={onBack}
            disabled={submitPending}
          >
            Back
          </Button>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          className="min-h-[44px]"
          onClick={onCancel}
          disabled={submitPending}
        >
          Cancel
        </Button>
        {!isLastStep ? (
          <Button
            type="button"
            className="min-h-[44px]"
            onClick={onNext}
            disabled={submitPending || !canGoNext}
          >
            Next
          </Button>
        ) : (
          <Button
            type="button"
            className="gradient-primary text-primary-foreground shadow-soft min-h-[44px]"
            onClick={onSubmit}
            disabled={submitPending}
          >
            {submitPending ? <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden /> : null}
            {submitPending ? (pendingLabel ?? submitLabel) : submitLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
