import type { ReactNode } from 'react';

import { InfoHint } from '@/components/help/InfoHint';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export function RequiredMark() {
  return (
    <span className="text-destructive" aria-hidden>
      {' '}
      *
    </span>
  );
}

type FieldLabelProps = {
  htmlFor?: string;
  label: string;
  required?: boolean;
  /** Optional help copy shown in the ? next to the label. */
  help?: string;
  className?: string;
};

/**
 * Shared ? help control used by FieldLabel and section titles. Thin wrapper over
 * `InfoHint` so the hint opens on tap as well as hover.
 */
export function FieldHelpTooltip({ label, help }: { label: string; help: string }) {
  return <InfoHint label={label} text={help} variant="field" />;
}

export function FieldLabel({ htmlFor, label, required = false, help, className }: FieldLabelProps) {
  const helpText = help?.trim() ?? '';
  const labelEl: ReactNode = (
    <Label htmlFor={htmlFor} className={cn(helpText && 'mb-0', !helpText && className)}>
      {label}
      {required ? <RequiredMark /> : null}
    </Label>
  );

  if (!helpText) {
    return labelEl;
  }

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {labelEl}
      <FieldHelpTooltip label={label} help={helpText} />
    </div>
  );
}
