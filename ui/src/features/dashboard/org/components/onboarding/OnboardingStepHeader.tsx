import { cn } from '@/lib/utils';

const ONBOARDING_STEP_COUNT = 3;

type OnboardingStep = 1 | 2 | 3;

const STEP_LABELS = ['Organization', 'Hosting', 'Verify'] as const;

function stepCopy(activeStep: OnboardingStep, verificationIntro: boolean) {
  if (activeStep === 1) {
    return { title: 'Organization', hint: 'Name and contact details' };
  }
  if (activeStep === 2) {
    return { title: 'Hosting', hint: 'Property, parking, or both' };
  }
  return {
    title: 'Verification',
    hint: verificationIntro ? 'How we verify hosts' : 'Upload required documents',
  };
}

type Props = {
  activeStep: OnboardingStep;
  verificationIntro?: boolean;
};

export function OnboardingStepHeader({ activeStep, verificationIntro = false }: Props) {
  const { title, hint } = stepCopy(activeStep, verificationIntro);
  const progressWidth = (activeStep / ONBOARDING_STEP_COUNT) * 100;

  return (
    <header>
      <div
        className="bg-muted h-1 w-full"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={ONBOARDING_STEP_COUNT}
        aria-valuenow={activeStep}
        aria-label={`Step ${activeStep} of ${ONBOARDING_STEP_COUNT}`}
      >
        <div
          className="bg-primary h-full transition-[width] duration-500 ease-out motion-reduce:transition-none"
          style={{ width: `${progressWidth}%` }}
        />
      </div>

      <nav aria-label="Onboarding steps" className="sr-only">
        <ol>
          {STEP_LABELS.map((label, index) => {
            const step = (index + 1) as OnboardingStep;
            return (
              <li key={label} aria-current={step === activeStep ? 'step' : undefined}>
                {label}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="flex items-start justify-between gap-4 px-4 pb-5 pt-5 sm:px-6 sm:pb-6 sm:pt-6">
        <div className="min-w-0 space-y-1">
          <h1 className="text-foreground text-lg font-semibold tracking-tight sm:text-xl">
            {title}
          </h1>
          <p className="text-muted-foreground text-sm leading-snug">{hint}</p>
        </div>
        <span
          className={cn(
            'border-border bg-muted/50 text-muted-foreground shrink-0 rounded-full border',
            'px-2.5 py-1 text-xs font-medium tabular-nums'
          )}
          aria-hidden
        >
          {activeStep}/{ONBOARDING_STEP_COUNT}
        </span>
      </div>
    </header>
  );
}
