import type { ComponentProps, ReactNode } from 'react';

import { AlertCircle } from 'lucide-react';

import { FieldLabel, RequiredMark } from '@/components/forms/FieldLabel';
import { Button } from '@/components/ui/button';
import { Input, type InputProps } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export { FieldLabel as SettingsFieldLabel, RequiredMark };

export function SettingsField({
  id,
  label,
  required = false,
  error,
  children,
  help,
  className,
}: {
  id?: string;
  label: string;
  required?: boolean;
  error?: string | null;
  children: ReactNode;
  /** Tooltip on a ? next to the label. */
  help?: string;
  className?: string;
}) {
  return (
    <div className={cn('space-y-2', className)}>
      <FieldLabel htmlFor={id} label={label} required={required} help={help} />
      {children}
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}

export function PropertySettingsSectionAlert({
  message,
  variant = 'warning',
}: {
  message: string;
  variant?: 'warning' | 'error';
}) {
  return (
    <div
      className={cn(
        'flex gap-2.5 rounded-lg border px-3 py-2.5 sm:px-4',
        variant === 'error'
          ? 'border-destructive/40 bg-destructive/5'
          : 'border-amber-500/35 bg-amber-500/10'
      )}
      role="status"
    >
      <AlertCircle
        className={cn(
          'mt-0.5 size-4 shrink-0',
          variant === 'error' ? 'text-destructive' : 'text-amber-700 dark:text-amber-300'
        )}
        aria-hidden
      />
      <p
        className={cn(
          'text-sm',
          variant === 'error' ? 'text-destructive' : 'text-amber-900 dark:text-amber-100'
        )}
      >
        {message}
      </p>
    </div>
  );
}

export function SectionNavIssueDot({ className }: { className?: string }) {
  return (
    <span className={cn('bg-destructive size-2 shrink-0 rounded-full', className)} aria-hidden />
  );
}

type SettingsManageButtonProps = Omit<ComponentProps<typeof Button>, 'children'> & {
  /** When true, appends * (matches section nav attention dot). */
  needsAttention?: boolean;
};

export function SettingsManageButton({
  needsAttention = false,
  className,
  variant = 'outline',
  size = 'sm',
  ...props
}: SettingsManageButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      className={cn('settings-action shrink-0', className)}
      aria-label={needsAttention ? 'Manage, action needed' : 'Manage'}
      {...props}
    >
      Manage
      {needsAttention ? (
        <span className="text-destructive" aria-hidden>
          *
        </span>
      ) : null}
    </Button>
  );
}

type LimitedCountInputProps = Omit<InputProps, 'maxLength' | 'value'> & {
  maxLength: number;
  value: string;
};

/** Single-line input with `{current}/{max}` counter inside the field on the right. */
export function LimitedCountInput({
  maxLength,
  value,
  className,
  id,
  ...props
}: LimitedCountInputProps) {
  const counterId = id ? `${id}-counter` : undefined;

  return (
    <div className="relative min-w-0 flex-1">
      <Input
        {...props}
        id={id}
        value={value}
        maxLength={maxLength}
        className={cn('pr-[3.25rem]', className)}
        aria-describedby={counterId}
      />
      <span
        id={counterId}
        className="text-muted-foreground pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs tabular-nums"
        aria-hidden
      >
        {value.length}/{maxLength}
      </span>
    </div>
  );
}
