import type { Ref } from 'react';

import { cn } from '@/lib/utils';

type WizardStepHeadingProps = {
  title: string;
  description?: string;
  headingRef?: Ref<HTMLHeadingElement>;
  className?: string;
};

/** Step title (+ optional one-liner). Same slot on every wizard step so layout stays stable. */
export function WizardStepHeading({
  title,
  description,
  headingRef,
  className,
}: WizardStepHeadingProps) {
  return (
    <div className={cn('space-y-1', className)}>
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-foreground text-sm font-semibold leading-snug outline-none"
      >
        {title}
      </h2>
      {description ? (
        <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
      ) : null}
    </div>
  );
}
