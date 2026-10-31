/**
 * Shared RHF field glue for the booking edit tabs.
 * Progress-rail forms use `WorkflowFormShell` separately.
 *
 * Relocated verbatim from the retired `BookingEditLayout.tsx` — no visual
 * changes here, `CollapsibleGroup` and `EditSectionJumpNav` were the only
 * pieces retired outright (replaced by real tabs in `BookingEditTabs.tsx`).
 */

import type { ReactNode, FocusEventHandler } from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { Input as ShadcnInput } from '@/components/ui/input';
import { cn } from '@/lib/utils';

import type { FieldError } from 'react-hook-form';

/** Matches shadcn Input — quiet border like view surfaces; focus via `field-focus`. */
export const fieldControlClass =
  'flex w-full min-w-0 rounded-lg border border-border/70 bg-card px-3.5 py-2.5 text-sm font-medium text-foreground transition-colors placeholder:text-muted-foreground/70 disabled:cursor-not-allowed disabled:opacity-50 hover:border-primary/30 field-focus';

/** @deprecated Prefer `fieldControlClass` — kept for textarea in tab files. */
export const inputClass = cn(fieldControlClass, 'resize-none');

export const Input = ShadcnInput;

export function fieldErrorId(fieldId: string): string {
  return `${fieldId}-error`;
}

export function fieldAriaProps(
  fieldId: string,
  error?: string
): {
  id: string;
  'aria-invalid'?: true;
  'aria-describedby'?: string;
} {
  if (!error) return { id: fieldId };
  return {
    id: fieldId,
    'aria-invalid': true,
    'aria-describedby': fieldErrorId(fieldId),
  };
}

/** Extracts a displayable message from an RHF `FieldError`, if any. */
export function fieldErrorMessage(error: FieldError | undefined): string | undefined {
  if (!error) return undefined;
  if (typeof error.message === 'string' && error.message) return error.message;
  return undefined;
}

/**
 * Sub-heading + divider for grouping fields inside a card body (nested workflow
 * forms, or multi-block tabs). Prefer separate `BookingDetailCard`s when the
 * groups match view-mode panels. Not a collapsible — tabs own top-level switch.
 */
export function Section({
  id,
  title,
  children,
  className,
}: {
  id?: string;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        'border-border/50 space-y-3.5 border-t pt-4 first:border-t-0 first:pt-0',
        className
      )}
    >
      <h3 className="text-overline">{title}</h3>
      {children}
    </section>
  );
}

export function Row2({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-4">{children}</div>;
}

export function Row3({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3 sm:gap-4">{children}</div>;
}

export function Field({
  label,
  required,
  error,
  htmlFor,
  fieldKey,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  error?: string;
  htmlFor?: string;
  /** Used for scroll-to-error (`data-field`) when htmlFor is absent. */
  fieldKey?: string;
  children: ReactNode;
  className?: string;
}) {
  const errorId = htmlFor ? fieldErrorId(htmlFor) : fieldKey ? fieldErrorId(fieldKey) : undefined;

  return (
    <div
      className={cn('flex min-w-0 flex-col gap-1.5', className)}
      data-field={fieldKey ?? htmlFor}
    >
      <label htmlFor={htmlFor} className="text-muted-foreground text-xs font-medium">
        {label}
        {required ? (
          <span className="text-destructive ml-0.5" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p id={errorId} role="alert" className="text-destructive text-xs leading-snug">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function CheckboxOption({
  label,
  className,
  checkboxClassName,
  checked,
  onCheckedChange,
  disabled,
  id,
  name,
  onBlur,
}: {
  label: ReactNode;
  className?: string;
  checkboxClassName?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  name?: string;
  onBlur?: FocusEventHandler<HTMLButtonElement>;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        'border-border/60 bg-muted/20 flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5',
        'hover:border-primary/25 hover:bg-muted/35 transition-colors',
        checked && 'border-primary/30 bg-primary/[0.04]',
        disabled && 'cursor-not-allowed opacity-50',
        className
      )}
    >
      <Checkbox
        id={id}
        name={name}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        disabled={disabled}
        onBlur={onBlur}
        className={checkboxClassName}
      />
      <span className="text-foreground min-w-0 text-sm font-medium leading-snug [overflow-wrap:anywhere]">
        {label}
      </span>
    </label>
  );
}
