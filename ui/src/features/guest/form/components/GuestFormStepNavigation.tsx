import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

import type { GuestFormStepId } from '@/features/guest/form/lib/guestFormSteps';

import { ContextualActionBar } from '@/components/mobile/ContextualActionBar';
import { Button } from '@/components/ui/button';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

type GuestFormStepNavigationProps = {
  currentStep: GuestFormStepId;
  stepCount: number;
  isSubmitting: boolean;
  canProceed: boolean;
  /** False briefly after landing on the last step so a Continue click cannot hit Submit. */
  submitReady: boolean;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
  /** When true, omit the top border (host already provides a modal footer separator). */
  bare?: boolean;
  /** Label for the final-step submit button. */
  submitLabel?: string;
  /**
   * `'floating'` (default): a full-page wizard — claims the shared bottom
   * band via `ContextualActionBar` on phone/tablet (`<lg`), hiding the tab
   * bar while this step is mounted. `'inline'`: stays a plain row wherever
   * it's rendered (modal/sheet footers already own their own scroll + chrome).
   */
  mobileVariant?: 'floating' | 'inline';
};

export function GuestFormStepNavigation({
  currentStep,
  stepCount,
  isSubmitting,
  canProceed,
  submitReady,
  onBack,
  onNext,
  onSubmit,
  bare = false,
  submitLabel = 'Submit guest form',
  mobileVariant = 'inline',
}: GuestFormStepNavigationProps) {
  const isFirst = currentStep === 1;
  const isLast = currentStep === stepCount;
  const isBelowLg = useIsBelowLg();
  const floating = mobileVariant === 'floating' && isBelowLg;

  const actions = (
    <div
      className={cn(
        isFirst
          ? 'flex justify-end'
          : 'flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between',
        !floating && !bare ? 'border-separator border-t pt-5' : null
      )}
    >
      {!isFirst ? (
        <Button
          type="button"
          variant="outline"
          className="min-h-[44px] w-full sm:w-auto"
          disabled={isSubmitting}
          onClick={onBack}
        >
          <ChevronLeft className="mr-1 size-4 shrink-0" aria-hidden />
          Back
        </Button>
      ) : null}

      {isLast ? (
        <Button
          type="button"
          variant="success"
          disabled={isSubmitting || !canProceed || !submitReady}
          onClick={onSubmit}
          className="shadow-primary/15 min-h-[44px] w-full shadow-md sm:w-auto"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              Submitting…
            </>
          ) : (
            submitLabel
          )}
        </Button>
      ) : (
        <Button
          type="button"
          className={
            isFirst
              ? 'shadow-primary/15 min-h-[44px] w-auto min-w-[8.5rem] shadow-md'
              : 'shadow-primary/15 min-h-[44px] w-full shadow-md sm:ml-auto sm:w-auto'
          }
          disabled={isSubmitting || !canProceed}
          onMouseDown={(event) => event.preventDefault()}
          onClick={onNext}
        >
          Continue
          <ChevronRight className="ml-1 size-4 shrink-0" aria-hidden />
        </Button>
      )}
    </div>
  );

  if (floating) {
    return <ContextualActionBar>{actions}</ContextualActionBar>;
  }

  return actions;
}
