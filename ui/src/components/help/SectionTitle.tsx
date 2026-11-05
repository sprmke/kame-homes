import type { ReactNode } from 'react';

import { InfoHint } from '@/components/help/InfoHint';
import { cn } from '@/lib/utils';

type SectionTitleProps = {
  title: string;
  /** Hint copy. Omit for self-explanatory sections. */
  hint?: string;
  /** Accessible name for the hint. Defaults to the title. */
  hintLabel?: string;
  /** Heading level. Defaults to h2. */
  as?: 'h2' | 'h3' | 'h4';
  /** Trailing actions, kept clear of the truncating title. */
  actions?: ReactNode;
  className?: string;
  id?: string;
};

/**
 * Section / card title with an optional `i` hint. The title truncates and the
 * hint never shrinks, so a long title cannot push the hint off-screen.
 */
export function SectionTitle({
  title,
  hint,
  hintLabel,
  as: Heading = 'h2',
  actions,
  className,
  id,
}: SectionTitleProps) {
  return (
    <div className={cn('flex min-w-0 items-center gap-1.5', className)}>
      <Heading id={id} className="text-section-title min-w-0 truncate">
        {title}
      </Heading>
      {hint ? <InfoHint label={hintLabel ?? title} text={hint} variant="section" /> : null}
      {actions ? <div className="ml-auto shrink-0">{actions}</div> : null}
    </div>
  );
}
